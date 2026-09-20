"""
Tests for Farm Years API

Covers:
  · Create a farm year (valid, duplicate, bad year)
  · Attaching a plot (auto-creates 2 lifecycles with correct dates)
  · Updating transition_date recalculates lifecycle dates
  · Safe delete — blocked when plots enrolled
  · Owner isolation — user A cannot see/modify user B's farm years or plots
"""

import pytest
from datetime import date
from httpx import AsyncClient

pytestmark = pytest.mark.anyio  # run every async test with anyio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_farm_year(client: AsyncClient, year: int = 2026, transition_date=None) -> dict:
    payload = {"year": year}
    if transition_date:
        payload["transition_date"] = str(transition_date)
    r = await client.post("/api/v1/farm-years", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


async def _enroll_plot(client: AsyncClient, farm_year_id: str, plot_id: str, **kwargs) -> dict:
    payload = {"plot_id": plot_id, "farm_year_id": farm_year_id, **kwargs}
    r = await client.post(f"/api/v1/farm-years/{farm_year_id}/plots", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ===========================================================================
# FARM YEAR CREATION
# ===========================================================================

async def test_create_farm_year_defaults(client: AsyncClient):
    """Creating year=2026 sets canonical Apr-Mar dates."""
    fy = await _create_farm_year(client, year=2026)

    assert fy["year"] == 2026
    assert fy["start_date"] == "2026-04-01"
    assert fy["end_date"] == "2027-03-31"
    assert fy["transition_date"] is None
    # effective_transition_date defaults to Oct 1
    assert fy["effective_transition_date"] == "2026-10-01"
    assert fy["plot_count"] == 0


async def test_create_farm_year_custom_transition(client: AsyncClient):
    """Custom transition_date is stored and reflected as effective_transition_date."""
    fy = await _create_farm_year(client, year=2025, transition_date=date(2025, 9, 15))

    assert fy["transition_date"] == "2025-09-15"
    assert fy["effective_transition_date"] == "2025-09-15"


async def test_create_farm_year_duplicate_is_rejected(client: AsyncClient):
    """Cannot create two farm years for the same calendar year."""
    await _create_farm_year(client, year=2024)
    r = await client.post("/api/v1/farm-years", json={"year": 2024})
    assert r.status_code == 409
    assert "already exists" in r.json()["detail"]


async def test_create_farm_year_bad_transition_rejected(client: AsyncClient):
    """transition_date outside the season window is rejected."""
    r = await client.post(
        "/api/v1/farm-years",
        json={"year": 2026, "transition_date": "2025-01-01"},  # before start_date
    )
    assert r.status_code == 422


# ===========================================================================
# LIST + GET
# ===========================================================================

async def test_list_farm_years(client: AsyncClient):
    await _create_farm_year(client, year=2023)
    await _create_farm_year(client, year=2024)

    r = await client.get("/api/v1/farm-years")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 2
    years = [item["year"] for item in data["items"]]
    # Newest first
    assert years == sorted(years, reverse=True)


async def test_get_farm_year_single(client: AsyncClient):
    fy = await _create_farm_year(client, year=2022)
    r = await client.get(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 200
    assert r.json()["year"] == 2022


async def test_get_nonexistent_farm_year(client: AsyncClient):
    import uuid
    r = await client.get(f"/api/v1/farm-years/{uuid.uuid4()}")
    assert r.status_code == 404


# ===========================================================================
# PLOT ENROLLMENT + LIFECYCLE DATES
# ===========================================================================

async def test_enroll_plot_creates_two_lifecycles(client: AsyncClient, test_plot):
    """Enrolling a plot auto-creates vegetative + fruit_production lifecycle rows."""
    fy = await _create_farm_year(client, year=2026)
    pfy = await _enroll_plot(client, fy["id"], str(test_plot.id))

    lcs = {lc["lifecycle_type"]: lc for lc in pfy["lifecycles"]}
    assert set(lcs.keys()) == {"vegetative", "fruit_production"}


async def test_lifecycle_dates_default_transition(client: AsyncClient, test_plot):
    """
    Default transition = Oct 1.
    vegetative   : 2026-04-01 → 2026-09-30
    production   : 2026-10-01 → 2027-03-31
    """
    fy = await _create_farm_year(client, year=2026)
    pfy = await _enroll_plot(client, fy["id"], str(test_plot.id))

    lcs = {lc["lifecycle_type"]: lc for lc in pfy["lifecycles"]}

    assert lcs["vegetative"]["start_date"]    == "2026-04-01"
    assert lcs["vegetative"]["end_date"]      == "2026-09-30"   # Oct 1 - 1 day
    assert lcs["fruit_production"]["start_date"] == "2026-10-01"
    assert lcs["fruit_production"]["end_date"]   == "2027-03-31"


async def test_lifecycle_dates_custom_transition(client: AsyncClient, test_plot):
    """
    Custom transition = Sep 15 2026.
    vegetative   : 2026-04-01 → 2026-09-14
    production   : 2026-09-15 → 2027-03-31
    """
    fy = await _create_farm_year(client, year=2026, transition_date=date(2026, 9, 15))
    pfy = await _enroll_plot(client, fy["id"], str(test_plot.id))

    lcs = {lc["lifecycle_type"]: lc for lc in pfy["lifecycles"]}

    assert lcs["vegetative"]["end_date"]         == "2026-09-14"
    assert lcs["fruit_production"]["start_date"] == "2026-09-15"


async def test_enroll_same_plot_twice_rejected(client: AsyncClient, test_plot):
    """A plot can only be enrolled once per farm year."""
    fy = await _create_farm_year(client, year=2026)
    await _enroll_plot(client, fy["id"], str(test_plot.id))

    r = await client.post(
        f"/api/v1/farm-years/{fy['id']}/plots",
        json={"plot_id": str(test_plot.id), "farm_year_id": fy["id"]},
    )
    assert r.status_code == 409


async def test_enroll_foreign_plot_rejected(client: AsyncClient, test_user, other_user, db_session):
    """Cannot enroll a plot owned by a different user."""
    from app.models.plot import Plot
    other_plot = Plot(owner_id=other_user.id, name="Other Plot", size_acres=1.0)
    db_session.add(other_plot)
    await db_session.flush()

    fy = await _create_farm_year(client, year=2026)
    r = await client.post(
        f"/api/v1/farm-years/{fy['id']}/plots",
        json={"plot_id": str(other_plot.id), "farm_year_id": fy["id"]},
    )
    assert r.status_code == 404


# ===========================================================================
# UPDATE — TRANSITION DATE RECALCULATION
# ===========================================================================

async def test_update_transition_date_recalculates_lifecycles(client: AsyncClient, test_plot):
    """
    After patching transition_date, existing lifecycle rows update automatically.
    """
    fy = await _create_farm_year(client, year=2026)          # default Oct 1
    await _enroll_plot(client, fy["id"], str(test_plot.id))

    # Move transition to Nov 1
    r = await client.patch(
        f"/api/v1/farm-years/{fy['id']}",
        json={"transition_date": "2026-11-01"},
    )
    assert r.status_code == 200
    detail = r.json()

    lcs = {lc["lifecycle_type"]: lc for lc in detail["plot_farm_years"][0]["lifecycles"]}
    assert lcs["vegetative"]["end_date"]         == "2026-10-31"   # Nov 1 - 1 day
    assert lcs["fruit_production"]["start_date"] == "2026-11-01"


async def test_clear_transition_date_reverts_to_default(client: AsyncClient, test_plot):
    """
    Patching transition_date=null reverts effective date back to Oct 1.
    """
    fy = await _create_farm_year(client, year=2026, transition_date=date(2026, 9, 15))
    await _enroll_plot(client, fy["id"], str(test_plot.id))

    r = await client.patch(
        f"/api/v1/farm-years/{fy['id']}",
        json={"transition_date": None},
    )
    assert r.status_code == 200
    detail = r.json()

    lcs = {lc["lifecycle_type"]: lc for lc in detail["plot_farm_years"][0]["lifecycles"]}
    # Back to Oct 1 default
    assert lcs["fruit_production"]["start_date"] == "2026-10-01"


# ===========================================================================
# SAFE DELETE
# ===========================================================================

async def test_delete_empty_farm_year(client: AsyncClient):
    """Deleting a farm year with no plots enrolled succeeds."""
    fy = await _create_farm_year(client, year=2021)
    r = await client.delete(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 204


async def test_delete_farm_year_with_plots_blocked(client: AsyncClient, test_plot):
    """Deleting a farm year that has enrolled plots returns 409."""
    fy = await _create_farm_year(client, year=2026)
    await _enroll_plot(client, fy["id"], str(test_plot.id))

    r = await client.delete(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 409
    assert "plot(s) are enrolled" in r.json()["detail"]


async def test_remove_plot_then_delete_farm_year(client: AsyncClient, test_plot):
    """After removing the enrolled plot, the farm year can be deleted."""
    fy = await _create_farm_year(client, year=2026)
    pfy = await _enroll_plot(client, fy["id"], str(test_plot.id))

    # Remove the plot enrollment
    r = await client.delete(f"/api/v1/farm-years/{fy['id']}/plots/{pfy['id']}")
    assert r.status_code == 204

    # Now delete the farm year
    r = await client.delete(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 204


# ===========================================================================
# OWNER ISOLATION
# ===========================================================================

async def test_owner_cannot_see_other_farm_years(client: AsyncClient, other_client: AsyncClient):
    """User A's farm years are not visible to user B."""
    fy = await _create_farm_year(client, year=2026)

    import uuid
    # Other user tries to GET the same farm_year_id
    r = await other_client.get(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 404


async def test_other_user_list_returns_only_own(client: AsyncClient, other_client: AsyncClient):
    """list endpoint returns only the current user's farm years."""
    await _create_farm_year(client, year=2026)
    # Other user creates their own
    await _create_farm_year(other_client, year=2026)

    r_main = await client.get("/api/v1/farm-years")
    r_other = await other_client.get("/api/v1/farm-years")

    main_ids  = {item["id"] for item in r_main.json()["items"]}
    other_ids = {item["id"] for item in r_other.json()["items"]}

    # No overlap
    assert main_ids.isdisjoint(other_ids)


async def test_owner_cannot_patch_other_farm_year(client: AsyncClient, other_client: AsyncClient):
    """User B cannot patch user A's farm year."""
    fy = await _create_farm_year(client, year=2026)
    r = await other_client.patch(
        f"/api/v1/farm-years/{fy['id']}",
        json={"transition_date": "2026-11-01"},
    )
    assert r.status_code == 404


async def test_owner_cannot_delete_other_farm_year(client: AsyncClient, other_client: AsyncClient):
    """User B cannot delete user A's farm year."""
    fy = await _create_farm_year(client, year=2026)
    r = await other_client.delete(f"/api/v1/farm-years/{fy['id']}")
    assert r.status_code == 404
