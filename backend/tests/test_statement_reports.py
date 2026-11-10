"""Downloadable statements: labour work / pay, operations, expenses, contracts."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.farm_transaction import FarmTransaction

pytestmark = pytest.mark.anyio

S = "/api/v1/statements"


@pytest_asyncio.fixture(autouse=True)
async def _table(db_session):
    # Same dev convenience as test_expenses: the table may not exist in the shared DB yet.
    await db_session.run_sync(lambda s: FarmTransaction.__table__.create(s.connection(), checkfirst=True))


async def _labour(client, name="Ramesh", wage=400) -> dict:
    r = await client.post("/api/v1/labours", json={"name": name, "daily_wage": wage})
    assert r.status_code == 201, r.text
    return r.json()


async def _att(client, body: dict):
    r = await client.post("/api/v1/attendance", json=body)
    assert r.status_code in (200, 201), r.text


async def _pay(client, labour_id, d, amount, method="cash"):
    r = await client.post("/api/v1/payments", json={"labour_id": labour_id, "date": d, "amount": amount, "method": method})
    assert r.status_code == 201, r.text


async def _plot(client, name="A", acres=2) -> dict:
    r = await client.post("/api/v1/plots", json={"name": name, "size_acres": acres, "crop_name": "Grapes"})
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Labour work statement
# ---------------------------------------------------------------------------

async def test_work_statement_has_days_but_no_money(client: AsyncClient):
    lab = await _labour(client)
    await _att(client, {"labour_id": lab["id"], "date": "2026-11-02", "status": "present", "task": "Pruning",
                        "work_start_time": "08:00", "work_end_time": "17:00"})
    await _att(client, {"labour_id": lab["id"], "date": "2026-11-03", "status": "half_day"})
    await _att(client, {"labour_id": lab["id"], "date": "2026-11-04", "status": "absent"})
    await _att(client, {"labour_id": lab["id"], "date": "2026-10-01", "status": "present"})   # outside range

    r = await client.get(f"{S}/labour/work/individual/{lab['id']}", params={"date_from": "2026-11-01", "date_to": "2026-11-30"})
    assert r.status_code == 200, r.text
    st = r.json()
    assert [row["status"] for row in st["rows"]] == ["present", "half_day", "absent"]
    assert st["rows"][0]["task"] == "Pruning" and st["rows"][0]["work_start_time"] == "08:00"
    assert all("wage_earned" not in row for row in st["rows"])
    s = st["summary"]
    assert (s["days_present"], s["days_half"], s["days_absent"], s["days_worked"]) == (1, 1, 1, 1.5)
    assert s["labour_days"] is None


async def test_team_work_statement_counts_labour_days(client: AsyncClient):
    team = (await client.post("/api/v1/teams", json={"name": "Shinde group", "daily_wage": 400})).json()
    await _att(client, {"team_id": team["id"], "date": "2026-11-02", "status": "present", "num_labourers": 10})
    await _att(client, {"team_id": team["id"], "date": "2026-11-03", "status": "half_day", "num_labourers": 4})
    s = (await client.get(f"{S}/labour/work/team/{team['id']}")).json()["summary"]
    assert s["days_worked"] == 1.5 and s["labour_days"] == 12


# ---------------------------------------------------------------------------
# Labour pay statement
# ---------------------------------------------------------------------------

async def test_pay_statement_daily_earning_weekly_payment(client: AsyncClient):
    lab = await _labour(client, wage=400)
    # Mon 2 Nov .. Sat 7 Nov: 5 full days + 1 half day, paid on Saturday
    for d in ("2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"):
        await _att(client, {"labour_id": lab["id"], "date": d, "status": "present"})
    await _att(client, {"labour_id": lab["id"], "date": "2026-11-07", "status": "half_day"})
    await _pay(client, lab["id"], "2026-11-07", 2000, "upi")
    # next week: one day worked, an advance mid-week
    await _att(client, {"labour_id": lab["id"], "date": "2026-11-09", "status": "present"})
    await _pay(client, lab["id"], "2026-11-10", 800)

    st = (await client.get(f"{S}/labour/pay/individual/{lab['id']}", params={"date_from": "2026-11-02", "date_to": "2026-11-15"})).json()
    s = st["summary"]
    assert s["opening_balance"] == 0
    assert (s["wages_earned"], s["total_paid"], s["closing_balance"]) == (2600, 2800, -200)
    assert s["days_worked"] == 6.5

    by_date = {r["date"]: r for r in st["rows"]}
    assert by_date["2026-11-02"]["earned"] == 400 and by_date["2026-11-02"]["paid"] == 0
    sat = by_date["2026-11-07"]
    assert (sat["earned"], sat["paid"], sat["balance"]) == (200, 2000, 200)     # 2200 earned - 2000 paid
    assert sat["earn_items"][0]["kind"] == "half_wage" and sat["paid_items"][0]["method"] == "upi"
    assert by_date["2026-11-10"]["balance"] == -200                              # advance beyond what was earned

    weeks = st["weeks"]
    assert [(w["week_start"], w["week_end"]) for w in weeks] == [("2026-11-02", "2026-11-08"), ("2026-11-09", "2026-11-15")]
    assert (weeks[0]["earned"], weeks[0]["paid"], weeks[0]["closing_balance"]) == (2200, 2000, 200)
    assert (weeks[1]["earned"], weeks[1]["paid"], weeks[1]["closing_balance"]) == (400, 800, -200)


async def test_pay_statement_brings_balance_forward_and_counts_contracts(client: AsyncClient):
    lab = await _labour(client, wage=500)
    # before the period: earned 1000, paid 300 -> 700 still due
    await _att(client, {"labour_id": lab["id"], "date": "2026-10-20", "status": "present"})
    await _att(client, {"labour_id": lab["id"], "date": "2026-10-21", "status": "present"})
    await _pay(client, lab["id"], "2026-10-21", 300)
    # in the period: a completed contract and a payment
    c = (await client.post("/api/v1/contracts", json={
        "title": "Tying", "entity_type": "individual", "labour_id": lab["id"], "amount": 3000, "assigned_date": "2026-10-25",
    })).json()
    await client.patch(f"/api/v1/contracts/{c['id']}", json={"status": "completed", "completed_date": "2026-11-05"})
    await _pay(client, lab["id"], "2026-11-06", 3700)
    # cancelled contracts never count
    x = (await client.post("/api/v1/contracts", json={
        "title": "X", "entity_type": "individual", "labour_id": lab["id"], "amount": 999, "assigned_date": "2026-11-02",
    })).json()
    await client.patch(f"/api/v1/contracts/{x['id']}", json={"status": "cancelled"})

    st = (await client.get(f"{S}/labour/pay/individual/{lab['id']}", params={"date_from": "2026-11-01", "date_to": "2026-11-30"})).json()
    s = st["summary"]
    assert s["opening_balance"] == 700
    assert (s["contract_earned"], s["total_paid"], s["closing_balance"]) == (3000, 3700, 0)
    contract_row = next(r for r in st["rows"] if r["date"] == "2026-11-05")
    assert contract_row["earn_items"][0] == {"kind": "contract", "label": "Tying", "amount": 3000, "num_labourers": None}

    # all-time closing balance agrees with the Payments module
    all_time = (await client.get(f"{S}/labour/pay/individual/{lab['id']}")).json()["summary"]
    pending = (await client.get(f"/api/v1/payments/entity/individual/{lab['id']}/summary")).json()["pending"]
    assert all_time["closing_balance"] == pending


async def test_labour_statements_are_owner_scoped(client: AsyncClient, other_client: AsyncClient):
    theirs = await _labour(other_client, "Secret")
    assert (await client.get(f"{S}/labour/work/individual/{theirs['id']}")).status_code == 404
    assert (await client.get(f"{S}/labour/pay/individual/{theirs['id']}")).status_code == 404


# ---------------------------------------------------------------------------
# Operations report
# ---------------------------------------------------------------------------

async def test_operations_report_season_with_products_workers_and_cost(client: AsyncClient, other_client: AsyncClient):
    a, b = await _plot(client, "A"), await _plot(client, "B")
    lab = await _labour(client, "Suresh")
    op = (await client.post("/api/v1/plot-operations", json={
        "plot_id": a["id"], "operation_date": "2026-09-10", "operation_type": "Spraying", "notes": "Morning spray",
        "details": {"products": [{"name": "Movento", "dose": "2 ml/L"}, {"name": "Score"}]},
    })).json()
    await client.post(f"/api/v1/plot-operations/{op['id']}/workers", json={"labour_id": lab["id"]})
    await client.post("/api/v1/expenses", json={"kind": "expense", "txn_date": "2026-09-10", "category": "medicine",
                                                "amount": 1800, "amount_paid": 1800, "operation_id": op["id"], "plot_id": a["id"]})
    await client.post("/api/v1/plot-operations", json={
        "plot_id": b["id"], "operation_date": "2026-05-01", "operation_type": "Spraying",
        "details": {"products": [{"name": "movento", "dose": "1 ml"}]},
    })
    await client.post("/api/v1/plot-operations", json={"plot_id": a["id"], "operation_date": "2026-03-31", "operation_type": "Other"})  # last season
    other_plot = await _plot(other_client, "THEIRS")
    await other_client.post("/api/v1/plot-operations", json={"plot_id": other_plot["id"], "operation_date": "2026-09-10", "operation_type": "Other"})

    r = (await client.get(f"{S}/operations", params={"year": 2026})).json()
    assert r["period"] == {"year": 2026, "date_from": "2026-04-01", "date_to": "2027-03-31"}
    assert r["total"] == 2 and [x["date"] for x in r["rows"]] == ["2026-05-01", "2026-09-10"]
    sep = r["rows"][1]
    assert sep["plot_name"] == "A" and sep["workers"] == ["Suresh"] and sep["cost"] == 1800
    assert sep["stage"] == "fruit_production" and r["rows"][0]["stage"] == "vegetative"
    assert [p["name"] for p in sep["products"]] == ["Movento", "Score"]
    assert r["products"][0] == {"name": "Movento", "times": 2, "plots": ["A", "B"]}
    assert r["by_category"] == [{"name": "Spraying", "count": 2}]
    assert r["linked_cost"] == 1800

    one_plot = (await client.get(f"{S}/operations", params={"year": 2026, "plot_id": b["id"]})).json()
    assert one_plot["total"] == 1 and one_plot["plot_name"] == "B"
    ranged = (await client.get(f"{S}/operations", params={"date_from": "2026-09-01", "date_to": "2026-09-30"})).json()
    assert ranged["total"] == 1
    assert (await client.get(f"{S}/operations", params={"plot_id": other_plot["id"]})).status_code == 404
    assert (await client.get(f"{S}/operations", params={"date_from": "2026-09-30", "date_to": "2026-09-01"})).status_code == 422


# ---------------------------------------------------------------------------
# Expense report
# ---------------------------------------------------------------------------

async def test_expense_report_totals(client: AsyncClient):
    a = await _plot(client, "A")

    async def add(**kw):
        body = {"kind": "expense", "txn_date": "2026-09-10", "category": "medicine", "amount": 1000, "amount_paid": 1000}
        body.update(kw)
        r = await client.post("/api/v1/expenses", json=body)
        assert r.status_code == 201, r.text

    await add(plot_id=a["id"])
    await add(category="fuel", amount=600, amount_paid=0, party="Pump")                 # on credit, whole farm
    await add(amount=None, amount_paid=0)                                               # price pending
    await add(kind="income", category="sale", amount=50000, amount_paid=30000, plot_id=a["id"], txn_date="2027-02-01")
    await add(txn_date="2027-04-01")                                                    # next season

    r = (await client.get(f"{S}/expenses", params={"year": 2026})).json()
    assert len(r["rows"]) == 4
    assert (r["income"], r["expense"], r["profit"]) == (50000, 1600, 48400)
    assert r["unpriced_count"] == 1 and r["you_owe"] == 600 and r["owed_to_you"] == 20000
    cats = {(c["kind"], c["category"]): c for c in r["by_category"]}
    assert cats[("expense", "medicine")] == {"kind": "expense", "category": "medicine", "total": 1000, "count": 2, "unpriced_count": 1}
    plots = {p["plot_name"]: p for p in r["by_plot"]}
    assert plots["A"]["profit"] == 49000 and plots[None]["expense"] == 600
    assert r["by_plot"][-1]["plot_name"] is None                                         # whole farm last

    only_a = (await client.get(f"{S}/expenses", params={"year": 2026, "plot_id": a["id"]})).json()
    assert len(only_a["rows"]) == 2 and only_a["plot_name"] == "A"


# ---------------------------------------------------------------------------
# Contracts report
# ---------------------------------------------------------------------------

async def test_contracts_report(client: AsyncClient, other_client: AsyncClient):
    lab = await _labour(client, "Ramesh")
    team = (await client.post("/api/v1/teams", json={"name": "Shinde group", "daily_wage": 400})).json()
    plot = await _plot(client, "North", 2)

    async def con(**kw):
        body = {"title": "Job", "amount": 1000, "assigned_date": "2026-06-01"}
        body.update(kw)
        r = await client.post("/api/v1/contracts", json=body)
        assert r.status_code == 201, r.text
        return r.json()

    await con(title="Tying", entity_type="individual", labour_id=lab["id"], plot_id=plot["id"], amount_per_acre=4000, amount=8000)
    done = await con(title="Thinning", entity_type="team", team_id=team["id"], amount=5000, assigned_date="2026-10-01")
    await client.patch(f"/api/v1/contracts/{done['id']}", json={"status": "completed", "completed_date": "2026-10-20"})
    gone = await con(title="Cancelled", entity_type="individual", labour_id=lab["id"], amount=700)
    await client.patch(f"/api/v1/contracts/{gone['id']}", json={"status": "cancelled"})
    await con(title="Old", entity_type="individual", labour_id=lab["id"], assigned_date="2026-02-01")   # last season
    o_lab = await _labour(other_client, "X")
    await other_client.post("/api/v1/contracts", json={"title": "Theirs", "entity_type": "individual", "labour_id": o_lab["id"],
                                                       "amount": 1, "assigned_date": "2026-06-01"})

    r = (await client.get(f"{S}/contracts", params={"year": 2026})).json()
    assert r["total_count"] == 3 and r["total_value"] == 13000
    rows = {x["title"]: x for x in r["rows"]}
    assert rows["Tying"]["entity_name"] == "Ramesh" and rows["Tying"]["plot_name"] == "North" and rows["Tying"]["size_acres"] == 2
    assert rows["Thinning"]["entity_name"] == "Shinde group" and rows["Thinning"]["completed_date"] == "2026-10-20"
    assert [s["status"] for s in r["by_status"]] == ["active", "completed", "cancelled"]
    assert "Theirs" not in rows

    # plot wise: North has only Tying; contracts without a plot come last
    assert [(p["plot_name"], p["count"], p["total_value"]) for p in r["by_plot"]] == [("North", 1, 8000), (None, 2, 5000)]
    north = (await client.get(f"{S}/contracts", params={"year": 2026, "plot_id": plot["id"]})).json()
    assert north["plot_name"] == "North" and [x["title"] for x in north["rows"]] == ["Tying"]
    assert north["total_value"] == 8000
    o_plot = await _plot(other_client, "THEIRS")
    assert (await client.get(f"{S}/contracts", params={"plot_id": o_plot["id"]})).status_code == 404
