"""Regression tests for create/update endpoints that were trimmed to avoid
extra database round-trips (no refresh / reload after flush)."""

import pytest

pytestmark = pytest.mark.asyncio


async def _labour(client, name="Ramesh", wage=500):
    res = await client.post("/api/v1/labours", json={"name": name, "daily_wage": wage})
    assert res.status_code == 201, res.text
    return res.json()


async def test_labour_create_and_update(client):
    created = await _labour(client)
    assert created["created_at"] and created["updated_at"]

    res = await client.patch(f"/api/v1/labours/{created['id']}", json={"daily_wage": 650})
    assert res.status_code == 200, res.text
    assert res.json()["daily_wage"] == 650
    assert res.json()["updated_at"]


async def test_plot_create_and_update(client):
    res = await client.post("/api/v1/plots", json={"name": "North", "size_acres": 2.5})
    assert res.status_code == 201, res.text
    plot = res.json()
    assert plot["created_at"]

    res = await client.patch(f"/api/v1/plots/{plot['id']}", json={"name": "North 2"})
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "North 2"


async def test_payment_create_and_update(client):
    labour = await _labour(client)
    res = await client.post(
        "/api/v1/payments",
        json={"labour_id": labour["id"], "date": "2026-01-10", "amount": 300, "method": "cash"},
    )
    assert res.status_code == 201, res.text
    pay = res.json()
    assert pay["entity_name"] == "Ramesh"
    assert pay["created_at"]

    res = await client.patch(f"/api/v1/payments/{pay['id']}", json={"amount": 350})
    assert res.status_code == 200, res.text
    assert res.json()["amount"] == 350
    assert res.json()["entity_name"] == "Ramesh"


async def test_team_create_members_and_update(client):
    labour = await _labour(client)
    res = await client.post("/api/v1/teams", json={"name": "Team A", "daily_wage": 400})
    assert res.status_code == 201, res.text
    team = res.json()
    assert team["member_count"] == 0 and team["members"] == []

    res = await client.post(f"/api/v1/teams/{team['id']}/members", json={"labour_ids": [labour["id"]]})
    assert res.status_code == 200, res.text
    assert res.json()["member_count"] == 1

    res = await client.patch(f"/api/v1/teams/{team['id']}", json={"car_rent": 100})
    assert res.status_code == 200, res.text
    assert res.json()["car_rent"] == 100
    assert res.json()["member_count"] == 1

    res = await client.request(
        "DELETE", f"/api/v1/teams/{team['id']}/members", json={"labour_ids": [labour["id"]]}
    )
    assert res.status_code == 200, res.text
    assert res.json()["member_count"] == 0


async def test_contract_create_and_update_with_plot(client):
    labour = await _labour(client)
    plot_a = (await client.post("/api/v1/plots", json={"name": "A", "size_acres": 1})).json()
    plot_b = (await client.post("/api/v1/plots", json={"name": "B", "size_acres": 3})).json()

    res = await client.post(
        "/api/v1/contracts",
        json={
            "title": "Pruning",
            "entity_type": "individual",
            "labour_id": labour["id"],
            "plot_id": plot_a["id"],
            "amount": 1000,
            "assigned_date": "2026-01-10",
        },
    )
    assert res.status_code == 201, res.text
    contract = res.json()
    assert contract["entity_name"] == "Ramesh"
    assert contract["plot"]["name"] == "A"

    # status-only update keeps the plot
    res = await client.patch(f"/api/v1/contracts/{contract['id']}", json={"status": "completed"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "completed"
    assert res.json()["plot"]["name"] == "A"
    assert res.json()["entity_name"] == "Ramesh"

    # changing the plot returns the new plot
    res = await client.patch(f"/api/v1/contracts/{contract['id']}", json={"plot_id": plot_b["id"]})
    assert res.status_code == 200, res.text
    assert res.json()["plot"]["name"] == "B"


async def test_contract_rejects_other_owners_plot(client, other_client):
    # Plot owned by the primary user; the other user must not be able to use it.
    plot = (await client.post("/api/v1/plots", json={"name": "Mine", "size_acres": 1})).json()
    labour = await _labour(other_client)
    body = {
        "title": "X",
        "entity_type": "individual",
        "labour_id": labour["id"],
        "plot_id": plot["id"],
        "amount": 10,
        "assigned_date": "2026-01-10",
    }
    res = await other_client.post("/api/v1/contracts", json=body)
    assert res.status_code == 404, res.text

    # same on update: other user's contract cannot be repointed to a foreign plot
    body.pop("plot_id")
    created = await other_client.post("/api/v1/contracts", json=body)
    assert created.status_code == 201, created.text
    res = await other_client.patch(f"/api/v1/contracts/{created.json()['id']}", json={"plot_id": plot["id"]})
    assert res.status_code == 404, res.text
