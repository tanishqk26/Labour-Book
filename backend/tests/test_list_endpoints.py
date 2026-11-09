"""Regression tests for list / summary endpoints rewritten to use fewer queries
(window-function totals, outer-join names, grouped aggregates)."""

import pytest

pytestmark = pytest.mark.asyncio


async def _labour(client, name, wage=500):
    res = await client.post("/api/v1/labours", json={"name": name, "daily_wage": wage})
    assert res.status_code == 201, res.text
    return res.json()


async def test_labours_pagination_totals(client):
    for n in ("A", "B", "C"):
        await _labour(client, n)

    p1 = (await client.get("/api/v1/labours", params={"page": 1, "page_size": 2})).json()
    assert p1["total"] == 3 and len(p1["items"]) == 2 and p1["has_more"] is True
    assert [i["name"] for i in p1["items"]] == ["A", "B"]

    p2 = (await client.get("/api/v1/labours", params={"page": 2, "page_size": 2})).json()
    assert p2["total"] == 3 and len(p2["items"]) == 1 and p2["has_more"] is False

    # past the end: total must still be right (fallback count)
    p9 = (await client.get("/api/v1/labours", params={"page": 9, "page_size": 2})).json()
    assert p9["total"] == 3 and p9["items"] == [] and p9["has_more"] is False


async def test_empty_lists(client):
    for path in ("labours", "teams", "plots", "contracts", "payments"):
        res = await client.get(f"/api/v1/{path}")
        assert res.status_code == 200, (path, res.text)
        body = res.json()
        assert body["total"] == 0 and body["items"] == [], path
    assert (await client.get("/api/v1/payments/entities")).json() == []


async def test_teams_list_member_counts(client):
    l1, l2 = await _labour(client, "M1"), await _labour(client, "M2")
    team = (await client.post("/api/v1/teams", json={"name": "T1", "daily_wage": 400})).json()
    await client.post(f"/api/v1/teams/{team['id']}/members", json={"labour_ids": [l1["id"], l2["id"]]})
    await client.post("/api/v1/teams", json={"name": "T2", "daily_wage": 400})

    body = (await client.get("/api/v1/teams")).json()
    assert body["total"] == 2
    counts = {t["name"]: t["member_count"] for t in body["items"]}
    assert counts == {"T1": 2, "T2": 0}


async def test_contracts_and_payments_lists_have_names(client):
    labour = await _labour(client, "Ramesh")
    team = (await client.post("/api/v1/teams", json={"name": "Team X", "daily_wage": 400})).json()
    plot = (await client.post("/api/v1/plots", json={"name": "North", "size_acres": 2})).json()

    for body in (
        {"entity_type": "individual", "labour_id": labour["id"], "plot_id": plot["id"]},
        {"entity_type": "team", "team_id": team["id"]},
    ):
        res = await client.post(
            "/api/v1/contracts",
            json={"title": "Job", "amount": 1000, "assigned_date": "2026-01-10", **body},
        )
        assert res.status_code == 201, res.text

    contracts = (await client.get("/api/v1/contracts")).json()
    assert contracts["total"] == 2
    by_type = {c["entity_type"]: c for c in contracts["items"]}
    assert by_type["individual"]["entity_name"] == "Ramesh"
    assert by_type["individual"]["plot"]["name"] == "North"
    assert by_type["team"]["entity_name"] == "Team X"
    assert by_type["team"]["plot"] is None

    await client.post("/api/v1/payments", json={"labour_id": labour["id"], "date": "2026-01-10", "amount": 100})
    await client.post("/api/v1/payments", json={"team_id": team["id"], "date": "2026-01-11", "amount": 200})
    pays = (await client.get("/api/v1/payments")).json()
    assert pays["total"] == 2
    assert [p["entity_name"] for p in pays["items"]] == ["Team X", "Ramesh"]  # newest first


async def test_entity_summaries_and_overall_summary(client):
    labour = await _labour(client, "Ramesh", wage=500)
    idle = await _labour(client, "Idle", wage=300)

    # earned: 500 attendance + 1000 contract; paid: 300
    await client.post("/api/v1/attendance", json={"labour_id": labour["id"], "date": "2026-01-10", "status": "present"})
    await client.post(
        "/api/v1/contracts",
        json={"title": "J", "entity_type": "individual", "labour_id": labour["id"], "amount": 1000, "assigned_date": "2026-01-10"},
    )
    await client.post("/api/v1/payments", json={"labour_id": labour["id"], "date": "2026-01-10", "amount": 300})

    entities = (await client.get("/api/v1/payments/entities")).json()
    by_name = {e["entity_name"]: e for e in entities}
    r = by_name["Ramesh"]
    assert (r["total_earned"], r["total_paid"], r["pending"]) == (1500, 300, 1200)
    assert r["payment_status"] == "partially_paid"
    i = by_name["Idle"]
    assert (i["total_earned"], i["total_paid"], i["pending"]) == (0, 0, 0)
    assert i["payment_status"] == "pending"

    # single-entity endpoint agrees with the bulk one
    single = (await client.get(f"/api/v1/payments/entity/individual/{labour['id']}/summary")).json()
    assert (single["total_earned"], single["total_paid"], single["pending"]) == (1500, 300, 1200)

    overall = (await client.get("/api/v1/payments/summary")).json()
    assert (overall["total_earned"], overall["total_paid"], overall["total_pending"]) == (1500, 300, 1200)

    # entity_type filter
    only_teams = (await client.get("/api/v1/payments/entities", params={"entity_type": "team"})).json()
    assert only_teams == []
    assert idle["id"]


async def test_attendance_history_and_statements(client):
    labour = await _labour(client, "Ramesh")
    team = (await client.post("/api/v1/teams", json={"name": "T", "daily_wage": 400})).json()
    l2 = await _labour(client, "Member")
    await client.post(f"/api/v1/teams/{team['id']}/members", json={"labour_ids": [l2["id"]]})

    await client.post("/api/v1/attendance", json={"labour_id": labour["id"], "date": "2026-01-10", "status": "present"})
    await client.post("/api/v1/attendance", json={"labour_id": labour["id"], "date": "2026-01-11", "status": "absent"})
    await client.post(
        "/api/v1/attendance",
        json={"team_id": team["id"], "date": "2026-01-10", "status": "present", "num_labourers": 3},
    )

    hist = (await client.get("/api/v1/attendance/history", params={"page_size": 2})).json()
    assert hist["total"] == 3 and len(hist["items"]) == 2 and hist["has_more"] is True
    assert all(i["labour"] or i["team"] for i in hist["items"])

    only_team = (await client.get("/api/v1/attendance/history", params={"entity_type": "team"})).json()
    assert only_team["total"] == 1 and only_team["items"][0]["team"]["name"] == "T"

    beyond = (await client.get("/api/v1/attendance/history", params={"page": 5, "page_size": 2})).json()
    assert beyond["total"] == 3 and beyond["items"] == []

    stmt = (await client.get(f"/api/v1/statements/work/team/{team['id']}")).json()
    assert stmt["entity"]["member_count"] == 1
    assert stmt["summary"]["total_days_present"] == 1

    stmt = (await client.get(f"/api/v1/statements/combined/individual/{labour['id']}")).json()
    assert stmt["summary"]["total_days_present"] == 1 and stmt["summary"]["total_days_absent"] == 1


async def test_settings_stats_counts(client):
    await _labour(client, "A")
    await _labour(client, "B")
    await client.post("/api/v1/teams", json={"name": "T", "daily_wage": 1})
    stats = (await client.get("/api/v1/settings/stats")).json()
    assert stats["total_labours"] == 2 and stats["active_labours"] == 2
    assert stats["total_teams"] == 1 and stats["active_teams"] == 1
    assert stats["total_attendance_records"] == 0 and stats["total_payments"] == 0


async def test_lists_are_owner_scoped(client, other_client):
    await _labour(client, "Mine")
    assert (await other_client.get("/api/v1/labours")).json()["total"] == 0
    assert (await other_client.get("/api/v1/payments/entities")).json() == []
