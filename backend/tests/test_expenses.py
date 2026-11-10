"""Expenses / income ledger tests."""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.farm_transaction import FarmTransaction

pytestmark = pytest.mark.anyio

URL = "/api/v1/expenses"


@pytest_asyncio.fixture(autouse=True)
async def _table(db_session):
    # Dev convenience: lets the suite run before the migration SQL has been applied
    # to the shared database. DDL is transactional, so this is rolled back too.
    await db_session.run_sync(lambda s: FarmTransaction.__table__.create(s.connection(), checkfirst=True))


async def _plot(client: AsyncClient, name: str, acres: float) -> dict:
    r = await client.post("/api/v1/plots", json={"name": name, "size_acres": acres, "crop_name": "Grapes"})
    assert r.status_code == 201, r.text
    return r.json()


def _exp(**kw):
    base = {"kind": "expense", "txn_date": "2026-09-10", "category": "medicine", "amount": 1000, "amount_paid": 1000}
    base.update(kw)
    return base


async def _add(client, **kw) -> dict:
    if "amount_paid" not in kw and kw.get("amount", 1000) is not None:
        kw["amount_paid"] = kw.get("amount", 1000)          # default: paid in full
    r = await client.post(URL, json=_exp(**kw))
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Create / validate
# ---------------------------------------------------------------------------

async def test_status_paid_credit_partial_and_pending(client: AsyncClient):
    assert (await _add(client))["status"] == "paid"
    credit = await _add(client, amount_paid=0, party="Patil Agro")
    assert credit["status"] == "credit" and credit["balance"] == 1000
    part = await _add(client, amount_paid=400)
    assert part["status"] == "partial" and part["balance"] == 600
    pending = await _add(client, amount=None, amount_paid=0)
    assert pending["status"] == "price_pending" and pending["amount"] is None and pending["balance"] is None


async def test_validation_rules(client: AsyncClient):
    # income needs an amount
    r = await client.post(URL, json=_exp(kind="income", category="sale", amount=None))
    assert r.status_code == 422
    # category must fit the kind
    assert (await client.post(URL, json=_exp(kind="income", category="medicine"))).status_code == 422
    assert (await client.post(URL, json=_exp(category="sale"))).status_code == 422
    # cannot have paid more than the bill
    assert (await client.post(URL, json=_exp(amount=500, amount_paid=800))).status_code == 422
    assert (await client.post(URL, json=_exp(amount=-5))).status_code == 422


async def test_price_filled_in_later(client: AsyncClient):
    e = await _add(client, amount=None, amount_paid=0, party="Kisan Centre")
    r = await client.patch(f"{URL}/{e['id']}", json={"amount": 2500})
    assert r.status_code == 200 and r.json()["status"] == "credit" and r.json()["balance"] == 2500
    # paying more than the bill is refused
    assert (await client.patch(f"{URL}/{e['id']}", json={"amount_paid": 9999})).status_code == 422
    # a plot can be cleared again
    p = await _plot(client, "A", 2)
    assert (await client.patch(f"{URL}/{e['id']}", json={"plot_id": p["id"]})).json()["plot_name"] == "A"
    assert (await client.patch(f"{URL}/{e['id']}", json={"plot_id": None})).json()["plot_id"] is None


# ---------------------------------------------------------------------------
# Owner isolation
# ---------------------------------------------------------------------------

async def test_owner_isolation(client: AsyncClient, other_client: AsyncClient):
    theirs_plot = await _plot(other_client, "THEIRS", 1)
    theirs = await _add(other_client, party="Secret Shop")
    mine = await _add(client)

    assert (await client.post(URL, json=_exp(plot_id=theirs_plot["id"]))).status_code == 404
    assert (await client.get(f"{URL}/{theirs['id']}")).status_code == 404
    assert (await client.patch(f"{URL}/{theirs['id']}", json={"amount": 1})).status_code == 404
    assert (await client.delete(f"{URL}/{theirs['id']}")).status_code == 404

    ids = [i["id"] for i in (await client.get(URL)).json()["items"]]
    assert ids == [mine["id"]]
    assert "Secret Shop" not in (await client.get(f"{URL}/parties")).json()
    assert await client.get(f"{URL}/dues") is not None
    assert all(d["party"] != "Secret Shop" for d in (await client.get(f"{URL}/dues")).json())
    # their data cannot be settled either
    r = await client.post(f"{URL}/settle", json={"kind": "expense", "party": "Secret Shop", "amount": 1})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# List filters
# ---------------------------------------------------------------------------

async def test_list_filters(client: AsyncClient):
    p = await _plot(client, "A", 2)
    await _add(client, plot_id=p["id"], category="fuel", txn_date="2026-09-01")
    await _add(client, kind="income", category="sale", amount=50000, amount_paid=50000, txn_date="2027-02-01")
    await _add(client, amount_paid=0, party="Patil Agro", txn_date="2026-09-05")

    assert (await client.get(URL, params={"kind": "income"})).json()["total"] == 1
    assert (await client.get(URL, params={"plot_id": p["id"]})).json()["total"] == 1
    assert (await client.get(URL, params={"open_only": True})).json()["total"] == 1
    assert (await client.get(URL, params={"party": " patil AGRO "})).json()["total"] == 1
    assert (await client.get(URL, params={"date_from": "2026-09-03", "date_to": "2026-12-31"})).json()["total"] == 1
    dates = [i["txn_date"] for i in (await client.get(URL)).json()["items"]]
    assert dates == sorted(dates, reverse=True)


# ---------------------------------------------------------------------------
# Profit & loss
# ---------------------------------------------------------------------------

async def test_summary_per_plot_and_shared_allocation(client: AsyncClient):
    a = await _plot(client, "A", 2)
    b = await _plot(client, "B", 3)
    await _add(client, plot_id=a["id"], amount=1000, amount_paid=0)                       # credit still counts as cost
    await _add(client, plot_id=a["id"], kind="income", category="sale", amount=10000, amount_paid=10000, txn_date="2027-02-01")
    await _add(client, plot_id=b["id"], amount=4000)
    await _add(client, plot_id=b["id"], amount=None, amount_paid=0)                        # unknown price: flagged, not 0-and-forgotten
    await _add(client, plot_id=None, category="electricity", amount=500)                  # farm-wide
    await _add(client, plot_id=a["id"], amount=777, txn_date="2026-03-31")                # previous farm year: excluded

    s = (await client.get(f"{URL}/summary", params={"year": 2026})).json()
    assert (s["date_from"], s["date_to"]) == ("2026-04-01", "2027-03-31")
    assert (s["income"], s["expense"], s["profit"]) == (10000, 5500, 4500)
    assert s["unpriced_count"] == 1 and s["allocated"] is False
    rows = {r["plot_name"]: r for r in s["plots"]}
    assert (rows["A"]["income"], rows["A"]["expense"], rows["A"]["profit"]) == (10000, 1000, 9000)
    assert rows["A"]["profit_per_acre"] == 4500
    assert rows["B"]["expense"] == 4000 and rows["B"]["unpriced_count"] == 1
    assert s["shared"]["expense"] == 500

    # allocate the 500 farm-wide cost by acreage: A 2/5 = 200, B 3/5 = 300
    s2 = (await client.get(f"{URL}/summary", params={"year": 2026, "allocate_shared": True})).json()
    rows2 = {r["plot_name"]: r for r in s2["plots"]}
    assert rows2["A"]["expense"] == 1200 and rows2["B"]["expense"] == 4300
    assert s2["allocated"] is True and s2["expense"] == 5500          # totals never change


async def test_summary_defaults_to_current_farm_year(client: AsyncClient):
    from datetime import date
    s = (await client.get(f"{URL}/summary")).json()
    assert s["year"] == (date.today().year if date.today().month >= 4 else date.today().year - 1)


# ---------------------------------------------------------------------------
# Credit with several shops
# ---------------------------------------------------------------------------

async def test_dues_and_settle_oldest_first(client: AsyncClient):
    old = await _add(client, amount=1000, amount_paid=0, party="Patil Agro", txn_date="2026-08-01")
    new = await _add(client, amount=2000, amount_paid=500, party=" patil agro", txn_date="2026-09-01")
    await _add(client, amount=800, amount_paid=0, party="Kisan Centre")
    await _add(client, amount=None, amount_paid=0, party="Patil Agro")                    # price pending
    await _add(client, amount=300, amount_paid=300, party="Patil Agro")                   # fully paid: not a due
    await _add(client, kind="income", category="sale", amount=90000, amount_paid=40000, party="Mehta Traders")

    dues = (await client.get(f"{URL}/dues")).json()
    by = {(d["kind"], d["party"].strip().lower()): d for d in dues}
    patil = by[("expense", "patil agro")]
    assert (patil["total"], patil["paid"], patil["balance"]) == (3000, 500, 2500)
    assert patil["unpriced_count"] == 1 and patil["entries"] == 3
    assert by[("expense", "kisan centre")]["balance"] == 800
    assert by[("income", "mehta traders")]["balance"] == 50000          # receivable, kept apart from payables

    # paying 1200 clears the oldest bill (1000) and 200 of the next
    r = await client.post(f"{URL}/settle", json={"kind": "expense", "party": "PATIL AGRO", "amount": 1200})
    assert r.status_code == 200
    assert r.json() == {"applied": 1200, "remaining_balance": 1300, "entries_updated": 2}
    assert (await client.get(f"{URL}/{old['id']}")).json()["status"] == "paid"
    n = (await client.get(f"{URL}/{new['id']}")).json()
    assert n["amount_paid"] == 700 and n["status"] == "partial"
    # the other shop is untouched
    assert [d for d in (await client.get(f"{URL}/dues")).json() if d["party"] == "Kisan Centre"][0]["balance"] == 800

    # cannot pay more than is owed
    assert (await client.post(f"{URL}/settle", json={"kind": "expense", "party": "Patil Agro", "amount": 5000})).status_code == 400
    assert (await client.post(f"{URL}/settle", json={"kind": "expense", "party": "Patil Agro", "amount": 0})).status_code == 422


async def test_party_suggestions_are_deduped(client: AsyncClient):
    await _add(client, party="Patil Agro")
    await _add(client, party="patil agro ")
    await _add(client, party="Kisan Centre")
    await _add(client, kind="income", category="sale", party="Mehta Traders")
    names = (await client.get(f"{URL}/parties", params={"kind": "expense"})).json()
    assert sorted(n.strip().lower() for n in names) == ["kisan centre", "patil agro"]


async def test_delete(client: AsyncClient):
    e = await _add(client)
    assert (await client.delete(f"{URL}/{e['id']}")).status_code == 204
    assert (await client.get(f"{URL}/{e['id']}")).status_code == 404
