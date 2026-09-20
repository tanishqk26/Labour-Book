"""
Tests for Plot Operations API

Covers:
  · Create operation (valid, invalid operation_type)
  · Create with lifecycle validation (correct plot, wrong plot, wrong user)
  · List with all filter combinations
  · Get single / 404
  · Update (date, type, notes, lifecycle change)
  · Delete
  · Owner isolation — user B cannot access user A's operations
"""

import pytest
from datetime import date, timedelta
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

async def _create_farm_year(client: AsyncClient, year: int = 2026) -> dict:
    r = await client.post("/api/v1/farm-years", json={"year": year})
    assert r.status_code == 201, r.text
    return r.json()


async def _enroll_plot(client: AsyncClient, farm_year_id: str, plot_id: str) -> dict:
    r = await client.post(
        f"/api/v1/farm-years/{farm_year_id}/plots",
        json={"plot_id": plot_id, "farm_year_id": farm_year_id},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _create_op(
    client: AsyncClient,
    plot_id: str,
    *,
    operation_type: str = "irrigation",
    operation_date: str = "2026-06-15",
    lifecycle_id: str | None = None,
    notes: str | None = None,
) -> dict:
    payload = {
        "plot_id": plot_id,
        "operation_date": operation_date,
        "operation_type": operation_type,
    }
    if lifecycle_id:
        payload["plot_lifecycle_id"] = lifecycle_id
    if notes:
        payload["notes"] = notes
    r = await client.post("/api/v1/plot-operations", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# Pytest fixtures that set up a farm year + enrolled plot + both lifecycle ids

@pytest.fixture
async def farm_setup(client: AsyncClient, test_plot):
    """Returns dict with farm_year, pfy (PlotFarmYear), veg_id, prod_id."""
    fy = await _create_farm_year(client, year=2026)
    pfy = await _enroll_plot(client, fy["id"], str(test_plot.id))
    lcs = {lc["lifecycle_type"]: lc for lc in pfy["lifecycles"]}
    return {
        "farm_year": fy,
        "pfy": pfy,
        "veg_id": lcs["vegetative"]["id"],
        "prod_id": lcs["fruit_production"]["id"],
        "plot_id": str(test_plot.id),
    }


# ===========================================================================
# CREATE
# ===========================================================================

async def test_create_operation_minimal(client: AsyncClient, test_plot):
    """Create operation without a lifecycle — should succeed."""
    op = await _create_op(client, str(test_plot.id))

    assert op["operation_type"] == "irrigation"
    assert op["operation_date"] == "2026-06-15"
    assert op["plot_id"] == str(test_plot.id)
    assert op["plot_lifecycle_id"] is None
    assert op["lifecycle"] is None


async def test_create_operation_with_lifecycle(client: AsyncClient, test_plot, farm_setup):
    """Create operation linked to the vegetative lifecycle."""
    op = await _create_op(
        client,
        str(test_plot.id),
        lifecycle_id=farm_setup["veg_id"],
        notes="Applied drip irrigation",
    )

    assert op["plot_lifecycle_id"] == farm_setup["veg_id"]
    assert op["lifecycle"]["lifecycle_type"] == "vegetative"
    assert op["notes"] == "Applied drip irrigation"


async def test_create_all_operation_types(client: AsyncClient, test_plot):
    """Every valid operation_type should be accepted."""
    from app.models.plot_operation import OPERATION_TYPES
    plot_id = str(test_plot.id)
    for op_type in OPERATION_TYPES:
        op = await _create_op(client, plot_id, operation_type=op_type)
        assert op["operation_type"] == op_type


async def test_create_invalid_operation_type(client: AsyncClient, test_plot):
    """Unknown operation_type is rejected with 422."""
    r = await client.post(
        "/api/v1/plot-operations",
        json={
            "plot_id": str(test_plot.id),
            "operation_date": "2026-06-15",
            "operation_type": "unknown_type",
        },
    )
    assert r.status_code == 422


async def test_create_operation_wrong_plot(client: AsyncClient, other_user, db_session):
    """Cannot create an operation on another user's plot (returns 404)."""
    from app.models.plot import Plot
    other_plot = Plot(owner_id=other_user.id, name="Other's Plot", size_acres=1.0)
    db_session.add(other_plot)
    await db_session.flush()

    r = await client.post(
        "/api/v1/plot-operations",
        json={
            "plot_id": str(other_plot.id),
            "operation_date": "2026-06-15",
            "operation_type": "irrigation",
        },
    )
    assert r.status_code == 404


async def test_create_operation_lifecycle_wrong_plot(
    client: AsyncClient, test_plot, farm_setup, test_user, db_session
):
    """Lifecycle from plot A cannot be attached to an operation on plot B."""
    from app.models.plot import Plot
    plot_b = Plot(owner_id=test_user.id, name="Plot B", size_acres=1.0)
    db_session.add(plot_b)
    await db_session.flush()

    r = await client.post(
        "/api/v1/plot-operations",
        json={
            "plot_id": str(plot_b.id),
            "operation_date": "2026-06-15",
            "operation_type": "irrigation",
            "plot_lifecycle_id": farm_setup["veg_id"],  # belongs to test_plot, not plot_b
        },
    )
    assert r.status_code == 404


# ===========================================================================
# LIST + FILTERS
# ===========================================================================

async def test_list_all_operations(client: AsyncClient, test_plot):
    """List returns all operations for the current user."""
    plot_id = str(test_plot.id)
    await _create_op(client, plot_id, operation_type="irrigation", operation_date="2026-05-01")
    await _create_op(client, plot_id, operation_type="weeding",    operation_date="2026-06-01")

    r = await client.get("/api/v1/plot-operations")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 2
    # Newest first
    dates = [item["operation_date"] for item in data["items"]]
    assert dates == sorted(dates, reverse=True)


async def test_filter_by_plot(client: AsyncClient, test_user, db_session):
    """Filtering by plot_id returns only that plot's operations."""
    from app.models.plot import Plot

    plot_a = Plot(owner_id=test_user.id, name="A", size_acres=1.0)
    plot_b = Plot(owner_id=test_user.id, name="B", size_acres=1.0)
    db_session.add_all([plot_a, plot_b])
    await db_session.flush()

    await _create_op(client, str(plot_a.id))
    await _create_op(client, str(plot_b.id))

    r = await client.get("/api/v1/plot-operations", params={"plot_id": str(plot_a.id)})
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(item["plot_id"] == str(plot_a.id) for item in items)


async def test_filter_by_operation_type(client: AsyncClient, test_plot):
    """Filter by operation_type returns only matching rows."""
    plot_id = str(test_plot.id)
    await _create_op(client, plot_id, operation_type="irrigation")
    await _create_op(client, plot_id, operation_type="weeding")

    r = await client.get("/api/v1/plot-operations", params={"operation_type": "irrigation"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(item["operation_type"] == "irrigation" for item in items)


async def test_filter_by_lifecycle(client: AsyncClient, test_plot, farm_setup):
    """Filter by lifecycle_id returns only operations for that lifecycle."""
    plot_id = str(test_plot.id)
    veg_id = farm_setup["veg_id"]
    prod_id = farm_setup["prod_id"]

    await _create_op(client, plot_id, lifecycle_id=veg_id)
    await _create_op(client, plot_id, lifecycle_id=prod_id)
    await _create_op(client, plot_id)  # no lifecycle

    r = await client.get("/api/v1/plot-operations", params={"lifecycle_id": veg_id})
    items = r.json()["items"]
    assert all(item["plot_lifecycle_id"] == veg_id for item in items)
    assert len(items) >= 1


async def test_filter_by_date_range(client: AsyncClient, test_plot):
    """date_from / date_to narrow the result set correctly."""
    plot_id = str(test_plot.id)
    await _create_op(client, plot_id, operation_date="2026-04-01")
    await _create_op(client, plot_id, operation_date="2026-06-15")
    await _create_op(client, plot_id, operation_date="2026-09-01")

    r = await client.get(
        "/api/v1/plot-operations",
        params={"date_from": "2026-05-01", "date_to": "2026-07-31"},
    )
    items = r.json()["items"]
    for item in items:
        d = date.fromisoformat(item["operation_date"])
        assert date(2026, 5, 1) <= d <= date(2026, 7, 31)


# ===========================================================================
# GET SINGLE
# ===========================================================================

async def test_get_single_operation(client: AsyncClient, test_plot):
    op = await _create_op(client, str(test_plot.id))
    r = await client.get(f"/api/v1/plot-operations/{op['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == op["id"]


async def test_get_nonexistent_operation(client: AsyncClient):
    import uuid
    r = await client.get(f"/api/v1/plot-operations/{uuid.uuid4()}")
    assert r.status_code == 404


# ===========================================================================
# UPDATE
# ===========================================================================

async def test_update_notes(client: AsyncClient, test_plot):
    op = await _create_op(client, str(test_plot.id), notes="Old note")
    r = await client.patch(f"/api/v1/plot-operations/{op['id']}", json={"notes": "Updated note"})
    assert r.status_code == 200
    assert r.json()["notes"] == "Updated note"


async def test_update_operation_type(client: AsyncClient, test_plot):
    op = await _create_op(client, str(test_plot.id), operation_type="irrigation")
    r = await client.patch(
        f"/api/v1/plot-operations/{op['id']}",
        json={"operation_type": "weeding"},
    )
    assert r.status_code == 200
    assert r.json()["operation_type"] == "weeding"


async def test_update_invalid_type_rejected(client: AsyncClient, test_plot):
    op = await _create_op(client, str(test_plot.id))
    r = await client.patch(
        f"/api/v1/plot-operations/{op['id']}",
        json={"operation_type": "bad_type"},
    )
    assert r.status_code == 422


async def test_update_lifecycle(client: AsyncClient, test_plot, farm_setup):
    """Can reassign to a different lifecycle on the same plot."""
    op = await _create_op(client, str(test_plot.id), lifecycle_id=farm_setup["veg_id"])

    r = await client.patch(
        f"/api/v1/plot-operations/{op['id']}",
        json={"plot_lifecycle_id": farm_setup["prod_id"]},
    )
    assert r.status_code == 200
    assert r.json()["plot_lifecycle_id"] == farm_setup["prod_id"]


async def test_update_lifecycle_wrong_plot_rejected(
    client: AsyncClient, test_plot, farm_setup, test_user, db_session
):
    """Cannot switch lifecycle to one belonging to a different plot."""
    from app.models.plot import Plot
    plot_b = Plot(owner_id=test_user.id, name="Plot B for update test", size_acres=1.0)
    db_session.add(plot_b)
    await db_session.flush()

    # Create op on plot_b (no lifecycle)
    op = await _create_op(client, str(plot_b.id))

    # Try to attach a lifecycle that belongs to test_plot
    r = await client.patch(
        f"/api/v1/plot-operations/{op['id']}",
        json={"plot_lifecycle_id": farm_setup["veg_id"]},
    )
    assert r.status_code == 404


# ===========================================================================
# DELETE
# ===========================================================================

async def test_delete_operation(client: AsyncClient, test_plot):
    op = await _create_op(client, str(test_plot.id))
    r = await client.delete(f"/api/v1/plot-operations/{op['id']}")
    assert r.status_code == 204

    # Confirm gone
    r2 = await client.get(f"/api/v1/plot-operations/{op['id']}")
    assert r2.status_code == 404


# ===========================================================================
# OWNER ISOLATION
# ===========================================================================

async def test_other_user_cannot_get_operation(
    client: AsyncClient, other_client: AsyncClient, test_plot
):
    op = await _create_op(client, str(test_plot.id))
    r = await other_client.get(f"/api/v1/plot-operations/{op['id']}")
    assert r.status_code == 404


async def test_other_user_list_returns_empty(
    client: AsyncClient, other_client: AsyncClient, test_plot
):
    """User B's list should not include user A's operations."""
    await _create_op(client, str(test_plot.id))

    r = await other_client.get("/api/v1/plot-operations")
    assert r.status_code == 200
    # Other user has no plots/operations so total should be 0
    assert r.json()["total"] == 0


async def test_other_user_cannot_update_operation(
    client: AsyncClient, other_client: AsyncClient, test_plot
):
    op = await _create_op(client, str(test_plot.id))
    r = await other_client.patch(
        f"/api/v1/plot-operations/{op['id']}",
        json={"notes": "Hacked"},
    )
    assert r.status_code == 404


async def test_other_user_cannot_delete_operation(
    client: AsyncClient, other_client: AsyncClient, test_plot
):
    op = await _create_op(client, str(test_plot.id))
    r = await other_client.delete(f"/api/v1/plot-operations/{op['id']}")
    assert r.status_code == 404
