"""
Statement reports (v2) — the data behind every downloadable statement.

  Labour work statement  GET /api/v1/statements/labour/work/{entity_type}/{id}
      Attendance only: present / half day / absent, task, times. No money.
  Labour pay statement   GET /api/v1/statements/labour/pay/{entity_type}/{id}
      What he earned each day (daily wage, contract amounts) vs. what he was
      actually paid (Payments module), with a running balance that starts from
      the balance brought forward from before the period, and weekly totals
      (wages are usually earned daily and paid at the end of the week).
  Operations report      GET /api/v1/statements/operations
  Expense report         GET /api/v1/statements/expenses
  Contracts report       GET /api/v1/statements/contracts

Period for every endpoint: `year` (farm year Apr 1 -> Mar 31, named after the
year it starts in) OR `date_from` / `date_to`; nothing = all time.

The older /work, /payment and /combined endpoints in statements.py are kept for
the web app.
"""

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.deps import get_current_user
from app.core.seasons import farm_year_for
from app.database import get_db
from app.models.attendance import Attendance
from app.models.contract import Contract
from app.models.farm_transaction import FarmTransaction
from app.models.labour import Labour
from app.models.payment import Payment
from app.models.plot import Plot
from app.models.plot_operation import PlotOperation
from app.models.plot_operation_worker import PlotOperationWorker
from app.models.team import Team
from app.models.user import User
from app.routers.statements import EntityInfo, _resolve_entity
from app.schemas.farm_transaction import status_of

router = APIRouter(prefix="/api/v1/statements", tags=["Statements"])

ZERO = Decimal("0")
EARNING_CONTRACT_STATUSES = ("active", "completed")   # same rule as the Payments module


# ---------------------------------------------------------------------------
# Period
# ---------------------------------------------------------------------------

class Period(BaseModel):
    year: Optional[int] = None       # set when the period is a whole farm year
    date_from: str = ""              # "" = open-ended
    date_to: str = ""


def _period(year: Optional[int], date_from: Optional[date], date_to: Optional[date]) -> tuple[Optional[date], Optional[date], Period]:
    if year is not None:
        d_from, d_to = date(year, 4, 1), date(year + 1, 3, 31)
        return d_from, d_to, Period(year=year, date_from=str(d_from), date_to=str(d_to))
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")
    return date_from, date_to, Period(date_from=str(date_from or ""), date_to=str(date_to or ""))


def _in(col, d_from: Optional[date], d_to: Optional[date]) -> list:
    conds = []
    if d_from is not None:
        conds.append(col >= d_from)
    if d_to is not None:
        conds.append(col <= d_to)
    return conds


YearQ = Query(None, ge=2000, le=2100, description="Farm year (Apr 1 start). Overrides date_from / date_to")


def _money(v) -> float:
    return round(float(v or 0), 2)


# ---------------------------------------------------------------------------
# Labour work statement
# ---------------------------------------------------------------------------

class WorkDay(BaseModel):
    date: str
    status: str                          # present | half_day | absent
    task: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    hours_worked: Optional[float] = None
    num_labourers: Optional[int] = None  # teams
    on_contract: bool = False            # the day was contract work


class WorkSummary(BaseModel):
    days_present: int
    days_half: int
    days_absent: int
    days_worked: float                   # present + half days counted as 0.5
    labour_days: Optional[float] = None  # teams: members x days (half day = 0.5)


class LabourWorkStatement(BaseModel):
    entity: EntityInfo
    period: Period
    rows: list[WorkDay]
    summary: WorkSummary


def _entity_cols(entity_type: str):
    if entity_type == "individual":
        return Attendance.labour_id, Payment.labour_id, Contract.labour_id
    return Attendance.team_id, Payment.team_id, Contract.team_id


@router.get("/labour/work/{entity_type}/{entity_id}", response_model=LabourWorkStatement,
            summary="Work (attendance) statement for a labour or team")
async def labour_work_statement(
    entity_type: str,
    entity_id: uuid.UUID,
    year: Optional[int] = YearQ,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabourWorkStatement:
    entity = await _resolve_entity(db, entity_type, entity_id, current_user.id)
    d_from, d_to, period = _period(year, date_from, date_to)
    att_col, _, _ = _entity_cols(entity_type)

    atts = (await db.execute(
        select(Attendance)
        .where(att_col == entity_id, Attendance.owner_id == current_user.id, *_in(Attendance.date, d_from, d_to))
        .order_by(Attendance.date.asc())
    )).scalars().all()

    present = sum(1 for a in atts if a.status == "present")
    half = sum(1 for a in atts if a.status == "half_day")
    absent = sum(1 for a in atts if a.status == "absent")
    labour_days = None
    if entity_type == "team":
        labour_days = sum(
            (a.num_labourers or 0) * (1 if a.status == "present" else 0.5)
            for a in atts if a.status in ("present", "half_day")
        )

    return LabourWorkStatement(
        entity=entity,
        period=period,
        rows=[
            WorkDay(
                date=str(a.date),
                status=a.status,
                task=a.task,
                work_start_time=a.work_start_time,
                work_end_time=a.work_end_time,
                hours_worked=float(a.hours_worked) if a.hours_worked is not None else None,
                num_labourers=a.num_labourers,
                on_contract=a.wage_type == "contract",
            )
            for a in atts
        ],
        summary=WorkSummary(
            days_present=present,
            days_half=half,
            days_absent=absent,
            days_worked=present + half * 0.5,
            labour_days=labour_days,
        ),
    )


# ---------------------------------------------------------------------------
# Labour pay statement
# ---------------------------------------------------------------------------

class EarnItem(BaseModel):
    kind: str                     # wage | half_wage | contract
    label: str                    # task / contract title
    amount: float
    num_labourers: Optional[int] = None


class PaidItem(BaseModel):
    amount: float
    method: str
    notes: Optional[str] = None


class PayDay(BaseModel):
    date: str
    earned: float
    paid: float
    balance: float                # running: + = still to pay him, - = paid in advance
    earn_items: list[EarnItem]
    paid_items: list[PaidItem]


class PayWeek(BaseModel):
    week_start: str               # Monday
    week_end: str                 # Sunday
    earned: float
    paid: float
    closing_balance: float


class PaySummary(BaseModel):
    opening_balance: float        # carried forward from before the period
    wages_earned: float
    contract_earned: float
    total_earned: float
    total_paid: float
    closing_balance: float        # + = due to him, - = advance given
    days_worked: float


class LabourPayStatement(BaseModel):
    entity: EntityInfo
    period: Period
    rows: list[PayDay]
    weeks: list[PayWeek]
    summary: PaySummary


def _contract_date(c: Contract) -> date:
    """A contract is earned when it is completed; until then on the day it was given."""
    return c.completed_date or c.assigned_date


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/labour/pay/{entity_type}/{entity_id}", response_model=LabourPayStatement,
            summary="Pay statement: earned per day vs. actually paid, with balance brought forward")
async def labour_pay_statement(
    entity_type: str,
    entity_id: uuid.UUID,
    year: Optional[int] = YearQ,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabourPayStatement:
    entity = await _resolve_entity(db, entity_type, entity_id, current_user.id)
    d_from, d_to, period = _period(year, date_from, date_to)
    att_col, pay_col, con_col = _entity_cols(entity_type)
    owner = current_user.id

    # Everything up to the end of the period; items before d_from only feed the opening balance.
    atts = (await db.execute(
        select(Attendance).where(
            att_col == entity_id, Attendance.owner_id == owner,
            Attendance.status.in_(("present", "half_day")),
            *_in(Attendance.date, None, d_to),
        )
    )).scalars().all()
    pays = (await db.execute(
        select(Payment).where(pay_col == entity_id, Payment.owner_id == owner, *_in(Payment.date, None, d_to))
        .order_by(Payment.date, Payment.created_at)
    )).scalars().all()
    cons = [
        c for c in (await db.execute(
            select(Contract).where(
                con_col == entity_id, Contract.owner_id == owner,
                Contract.status.in_(EARNING_CONTRACT_STATUSES),
            )
        )).scalars().all()
        if d_to is None or _contract_date(c) <= d_to
    ]

    def before(d: date) -> bool:
        return d_from is not None and d < d_from

    opening = ZERO
    days: dict[date, dict[str, Any]] = defaultdict(lambda: {"earn": [], "paid": []})
    wages = contracts_total = paid_total = ZERO
    days_worked = 0.0

    for a in atts:
        amt = Decimal(a.wage_earned or 0)
        if before(a.date):
            opening += amt
            continue
        days_worked += 1 if a.status == "present" else 0.5
        if amt <= 0:              # contract day: paid through the contract, not daily wage
            continue
        wages += amt
        days[a.date]["earn"].append(EarnItem(
            kind="wage" if a.status == "present" else "half_wage",
            label=a.task or "", amount=float(amt), num_labourers=a.num_labourers,
        ))
    for c in cons:
        d, amt = _contract_date(c), Decimal(c.amount or 0)
        if before(d):
            opening += amt
            continue
        contracts_total += amt
        days[d]["earn"].append(EarnItem(kind="contract", label=c.title, amount=float(amt)))
    for p in pays:
        amt = Decimal(p.amount or 0)
        if before(p.date):
            opening -= amt
            continue
        paid_total += amt
        days[p.date]["paid"].append(PaidItem(amount=float(amt), method=p.method, notes=p.notes))

    rows: list[PayDay] = []
    weeks: dict[date, dict[str, Decimal]] = {}
    bal = opening
    for d in sorted(days):
        earned = sum((Decimal(str(i.amount)) for i in days[d]["earn"]), ZERO)
        paid = sum((Decimal(str(i.amount)) for i in days[d]["paid"]), ZERO)
        bal += earned - paid
        rows.append(PayDay(
            date=str(d), earned=_money(earned), paid=_money(paid), balance=_money(bal),
            earn_items=days[d]["earn"], paid_items=days[d]["paid"],
        ))
        w = weeks.setdefault(_week_start(d), {"earned": ZERO, "paid": ZERO, "bal": ZERO})
        w["earned"] += earned
        w["paid"] += paid
        w["bal"] = bal

    total_earned = wages + contracts_total
    return LabourPayStatement(
        entity=entity,
        period=period,
        rows=rows,
        weeks=[
            PayWeek(week_start=str(ws), week_end=str(ws + timedelta(days=6)),
                    earned=_money(w["earned"]), paid=_money(w["paid"]), closing_balance=_money(w["bal"]))
            for ws, w in sorted(weeks.items())
        ],
        summary=PaySummary(
            opening_balance=_money(opening),
            wages_earned=_money(wages),
            contract_earned=_money(contracts_total),
            total_earned=_money(total_earned),
            total_paid=_money(paid_total),
            closing_balance=_money(opening + total_earned - paid_total),
            days_worked=days_worked,
        ),
    )


# ---------------------------------------------------------------------------
# Operations report
# ---------------------------------------------------------------------------

class OpProduct(BaseModel):
    name: str
    dose: Optional[str] = None


class OpRow(BaseModel):
    id: str
    date: str
    season: int
    plot_id: str
    plot_name: str
    stage: Optional[str] = None          # vegetative | fruit_production
    category: str
    notes: Optional[str] = None
    products: list[OpProduct]
    workers: list[str]
    cost: Optional[float] = None         # expenses linked to this operation


class CountRow(BaseModel):
    name: str
    count: int


class ProductUse(BaseModel):
    name: str
    times: int
    plots: list[str]


class OperationsReport(BaseModel):
    period: Period
    plot_name: Optional[str] = None
    rows: list[OpRow]
    total: int
    by_category: list[CountRow]
    by_plot: list[CountRow]
    products: list[ProductUse]
    linked_cost: float


def _products(details: Optional[dict]) -> list[OpProduct]:
    out = []
    for p in (details or {}).get("products") or []:
        if isinstance(p, dict) and str(p.get("name") or "").strip():
            dose = p.get("dose")
            out.append(OpProduct(name=str(p["name"]).strip(), dose=str(dose).strip() if dose else None))
    return out


async def _plot_name_or_404(db: AsyncSession, plot_id: Optional[uuid.UUID], owner_id: uuid.UUID) -> Optional[str]:
    if plot_id is None:
        return None
    name = (await db.execute(select(Plot.name).where(Plot.id == plot_id, Plot.owner_id == owner_id))).scalar_one_or_none()
    if name is None:
        raise HTTPException(status_code=404, detail="Plot not found")
    return name


@router.get("/operations", response_model=OperationsReport, summary="All operations in a season or date range")
async def operations_report(
    year: Optional[int] = YearQ,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    plot_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OperationsReport:
    d_from, d_to, period = _period(year, date_from, date_to)
    owner = current_user.id
    plot_name = await _plot_name_or_404(db, plot_id, owner)

    q = (
        select(PlotOperation)
        .options(joinedload(PlotOperation.plot), joinedload(PlotOperation.lifecycle))
        .where(PlotOperation.owner_id == owner, *_in(PlotOperation.operation_date, d_from, d_to))
        .order_by(PlotOperation.operation_date.asc(), PlotOperation.created_at.asc())
    )
    if plot_id is not None:
        q = q.where(PlotOperation.plot_id == plot_id)
    ops = (await db.execute(q)).unique().scalars().all()
    ids = [o.id for o in ops]

    workers: dict[uuid.UUID, list[str]] = defaultdict(list)
    costs: dict[uuid.UUID, Decimal] = {}
    if ids:
        wrows = (await db.execute(
            select(PlotOperationWorker)
            .options(joinedload(PlotOperationWorker.labour), joinedload(PlotOperationWorker.team))
            .where(PlotOperationWorker.owner_id == owner, PlotOperationWorker.operation_id.in_(ids))
        )).unique().scalars().all()
        for w in wrows:
            who = w.labour.name if w.labour is not None else (w.team.name if w.team is not None else None)
            if who:
                workers[w.operation_id].append(who)
        for op_id, total in (await db.execute(
            select(FarmTransaction.operation_id, func.sum(func.coalesce(FarmTransaction.amount, 0)))
            .where(FarmTransaction.owner_id == owner, FarmTransaction.kind == "expense",
                   FarmTransaction.operation_id.in_(ids))
            .group_by(FarmTransaction.operation_id)
        )).all():
            costs[op_id] = Decimal(total or 0)

    rows: list[OpRow] = []
    cat_count: dict[str, int] = defaultdict(int)
    plot_count: dict[str, int] = defaultdict(int)
    prod: dict[str, dict] = {}
    for o in ops:
        pname = o.plot.name if o.plot is not None else "—"
        products = _products(o.details)
        rows.append(OpRow(
            id=str(o.id),
            date=str(o.operation_date),
            season=farm_year_for(o.operation_date),
            plot_id=str(o.plot_id),
            plot_name=pname,
            stage=o.lifecycle.lifecycle_type if o.lifecycle is not None else None,
            category=o.operation_type,
            notes=o.notes,
            products=products,
            workers=sorted(workers.get(o.id, [])),
            cost=_money(costs[o.id]) if o.id in costs else None,
        ))
        cat_count[o.operation_type] += 1
        plot_count[pname] += 1
        for p in products:
            key = p.name.lower()
            e = prod.setdefault(key, {"name": p.name, "times": 0, "plots": set()})
            e["name"] = p.name            # ops are in date order: show the latest spelling
            e["times"] += 1
            e["plots"].add(pname)

    def counts(d: dict[str, int]) -> list[CountRow]:
        return [CountRow(name=k, count=v) for k, v in sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))]

    return OperationsReport(
        period=period,
        plot_name=plot_name,
        rows=rows,
        total=len(rows),
        by_category=counts(cat_count),
        by_plot=counts(plot_count),
        products=[
            ProductUse(name=e["name"], times=e["times"], plots=sorted(e["plots"]))
            for e in sorted(prod.values(), key=lambda e: (-e["times"], e["name"].lower()))
        ],
        linked_cost=_money(sum(costs.values(), ZERO)),
    )


# ---------------------------------------------------------------------------
# Expense report
# ---------------------------------------------------------------------------

class ExpenseRow(BaseModel):
    id: str
    date: str
    kind: str
    category: str
    plot_name: Optional[str] = None
    party: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    amount_paid: float
    balance: Optional[float] = None
    status: str


class CategoryTotal(BaseModel):
    kind: str
    category: str
    total: float
    count: int
    unpriced_count: int


class PlotTotal(BaseModel):
    plot_name: Optional[str] = None      # None = whole farm
    income: float
    expense: float
    profit: float


class ExpenseReport(BaseModel):
    period: Period
    plot_name: Optional[str] = None
    rows: list[ExpenseRow]
    income: float
    expense: float
    profit: float
    unpriced_count: int
    you_owe: float                       # unpaid bills to shops
    owed_to_you: float                   # unpaid by buyers
    by_category: list[CategoryTotal]
    by_plot: list[PlotTotal]


@router.get("/expenses", response_model=ExpenseReport, summary="Expense & income report for a season or date range")
async def expense_report(
    year: Optional[int] = YearQ,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    plot_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpenseReport:
    d_from, d_to, period = _period(year, date_from, date_to)
    owner = current_user.id
    plot_name = await _plot_name_or_404(db, plot_id, owner)

    q = (
        select(FarmTransaction)
        .options(selectinload(FarmTransaction.plot))
        .where(FarmTransaction.owner_id == owner, *_in(FarmTransaction.txn_date, d_from, d_to))
        .order_by(FarmTransaction.txn_date.asc(), FarmTransaction.created_at.asc())
    )
    if plot_id is not None:
        q = q.where(FarmTransaction.plot_id == plot_id)
    txns = (await db.execute(q)).scalars().all()

    totals = {"income": ZERO, "expense": ZERO}
    owe = {"income": ZERO, "expense": ZERO}
    unpriced = 0
    cats: dict[tuple[str, str], dict] = {}
    plots: dict[Optional[str], dict[str, Decimal]] = {}
    rows: list[ExpenseRow] = []
    for t in txns:
        amount, paid = t.amount, t.amount_paid or ZERO
        pname = t.plot.name if t.plot is not None else None
        rows.append(ExpenseRow(
            id=str(t.id), date=str(t.txn_date), kind=t.kind, category=t.category, plot_name=pname,
            party=t.party, description=t.description,
            amount=float(amount) if amount is not None else None,
            amount_paid=float(paid),
            balance=float(max(amount - paid, ZERO)) if amount is not None else None,
            status=status_of(amount, paid),
        ))
        c = cats.setdefault((t.kind, t.category), {"total": ZERO, "count": 0, "unpriced": 0})
        c["count"] += 1
        if amount is None:
            unpriced += 1
            c["unpriced"] += 1
            continue
        totals[t.kind] += amount
        owe[t.kind] += max(amount - paid, ZERO)
        c["total"] += amount
        pt = plots.setdefault(pname, {"income": ZERO, "expense": ZERO})
        pt[t.kind] += amount

    return ExpenseReport(
        period=period,
        plot_name=plot_name,
        rows=rows,
        income=_money(totals["income"]),
        expense=_money(totals["expense"]),
        profit=_money(totals["income"] - totals["expense"]),
        unpriced_count=unpriced,
        you_owe=_money(owe["expense"]),
        owed_to_you=_money(owe["income"]),
        by_category=[
            CategoryTotal(kind=k, category=cat, total=_money(v["total"]), count=v["count"], unpriced_count=v["unpriced"])
            for (k, cat), v in sorted(cats.items(), key=lambda kv: (kv[0][0] != "income", -kv[1]["total"]))
        ],
        by_plot=[
            PlotTotal(plot_name=n, income=_money(v["income"]), expense=_money(v["expense"]),
                      profit=_money(v["income"] - v["expense"]))
            for n, v in sorted(plots.items(), key=lambda kv: (kv[0] is None, (kv[0] or "").lower()))
        ],
    )


# ---------------------------------------------------------------------------
# Contracts report
# ---------------------------------------------------------------------------

class ContractRow(BaseModel):
    id: str
    plot_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    entity_type: str
    entity_name: Optional[str] = None
    plot_name: Optional[str] = None
    size_acres: Optional[float] = None
    amount_per_acre: Optional[float] = None
    amount: float
    assigned_date: str
    completed_date: Optional[str] = None
    status: str


class StatusTotal(BaseModel):
    status: str
    count: int
    amount: float


class PlotContracts(BaseModel):
    plot_id: Optional[str] = None        # None = contracts not tied to a plot
    plot_name: Optional[str] = None
    size_acres: Optional[float] = None
    count: int
    total_value: float                   # active + completed


class ContractsReport(BaseModel):
    period: Period
    plot_name: Optional[str] = None      # set when filtered to one plot
    rows: list[ContractRow]
    by_plot: list[PlotContracts]
    total_count: int
    total_value: float                   # active + completed (cancelled not counted)
    by_status: list[StatusTotal]


@router.get("/contracts", response_model=ContractsReport, summary="Contracts given in a season or date range")
async def contracts_report(
    year: Optional[int] = YearQ,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    plot_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContractsReport:
    d_from, d_to, period = _period(year, date_from, date_to)
    owner = current_user.id
    plot_name = await _plot_name_or_404(db, plot_id, owner)
    q = (
        select(Contract)
        .options(selectinload(Contract.plot))
        .where(Contract.owner_id == owner, *_in(Contract.assigned_date, d_from, d_to))
        .order_by(Contract.assigned_date.asc(), Contract.created_at.asc())
    )
    if plot_id is not None:
        q = q.where(Contract.plot_id == plot_id)
    cons = (await db.execute(q)).scalars().all()

    lab_ids = {c.labour_id for c in cons if c.labour_id}
    team_ids = {c.team_id for c in cons if c.team_id}
    names: dict[uuid.UUID, str] = {}
    if lab_ids:
        names.update(dict((await db.execute(
            select(Labour.id, Labour.name).where(Labour.owner_id == owner, Labour.id.in_(lab_ids))
        )).all()))
    if team_ids:
        names.update(dict((await db.execute(
            select(Team.id, Team.name).where(Team.owner_id == owner, Team.id.in_(team_ids))
        )).all()))

    by_status: dict[str, dict] = {}
    by_plot: dict[Optional[uuid.UUID], dict] = {}
    rows: list[ContractRow] = []
    for c in cons:
        g = by_plot.setdefault(c.plot_id, {
            "name": c.plot.name if c.plot is not None else None,
            "acres": float(c.plot.size_acres) if c.plot is not None else None,
            "count": 0, "value": ZERO,
        })
        g["count"] += 1
        if c.status in EARNING_CONTRACT_STATUSES:
            g["value"] += Decimal(c.amount or 0)
        rows.append(ContractRow(
            id=str(c.id), plot_id=str(c.plot_id) if c.plot_id else None, title=c.title, description=c.description, entity_type=c.entity_type,
            entity_name=names.get(c.labour_id or c.team_id),
            plot_name=c.plot.name if c.plot is not None else None,
            size_acres=float(c.plot.size_acres) if c.plot is not None else None,
            amount_per_acre=float(c.amount_per_acre) if c.amount_per_acre is not None else None,
            amount=float(c.amount),
            assigned_date=str(c.assigned_date),
            completed_date=str(c.completed_date) if c.completed_date else None,
            status=c.status,
        ))
        s = by_status.setdefault(c.status, {"count": 0, "amount": ZERO})
        s["count"] += 1
        s["amount"] += Decimal(c.amount or 0)

    order = {"active": 0, "completed": 1, "cancelled": 2}
    return ContractsReport(
        period=period,
        plot_name=plot_name,
        rows=rows,
        by_plot=[
            PlotContracts(plot_id=str(k) if k else None, plot_name=v["name"], size_acres=v["acres"],
                          count=v["count"], total_value=_money(v["value"]))
            for k, v in sorted(by_plot.items(), key=lambda kv: (kv[0] is None, (kv[1]["name"] or "").lower()))
        ],
        total_count=len(rows),
        total_value=_money(sum((v["amount"] for k, v in by_status.items() if k in EARNING_CONTRACT_STATUSES), ZERO)),
        by_status=[StatusTotal(status=k, count=v["count"], amount=_money(v["amount"]))
                   for k, v in sorted(by_status.items(), key=lambda kv: order.get(kv[0], 9))],
    )
