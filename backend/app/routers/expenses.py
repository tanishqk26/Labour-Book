"""
Expenses router — day-to-day farm expenses and income.

Profit uses the full agreed amount of each entry (credit or not); what is still
owed to shops / by buyers is tracked separately (/dues, /settle).
Entries whose price is not known yet are counted and flagged, never treated as 0
silently.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.seasons import farm_year_for
from app.database import get_db
from app.models.farm_transaction import FarmTransaction
from app.models.plot import Plot
from app.models.plot_operation import PlotOperation
from app.models.user import User
from app.schemas.farm_transaction import (
    ExpenseSummary,
    PartyDue,
    PlotPnL,
    SettleRequest,
    SettleResult,
    SharedTotals,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
    _check_category,
    status_of,
)

router = APIRouter(prefix="/api/v1/expenses", tags=["Expenses"])

ZERO = Decimal("0")


def _read(t: FarmTransaction) -> TransactionRead:
    amount = t.amount
    paid = t.amount_paid or ZERO
    return TransactionRead(
        id=t.id,
        kind=t.kind,
        txn_date=t.txn_date,
        category=t.category,
        plot_id=t.plot_id,
        plot_name=t.plot.name if t.plot is not None else None,
        operation_id=t.operation_id,
        party=t.party,
        amount=float(amount) if amount is not None else None,
        amount_paid=float(paid),
        balance=float(max(amount - paid, ZERO)) if amount is not None else None,
        status=status_of(amount, paid),
        description=t.description,
        created_at=t.created_at,
    )


async def _check_links(db: AsyncSession, owner_id: uuid.UUID, plot_id, operation_id) -> None:
    """A plot / operation id from the client must belong to this user."""
    if plot_id is not None:
        ok = (await db.execute(select(Plot.id).where(Plot.id == plot_id, Plot.owner_id == owner_id))).first()
        if ok is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Plot not found")
    if operation_id is not None:
        ok = (
            await db.execute(
                select(PlotOperation.id).where(PlotOperation.id == operation_id, PlotOperation.owner_id == owner_id)
            )
        ).first()
        if ok is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Operation not found")


async def _get_or_404(db: AsyncSession, txn_id: uuid.UUID, owner_id: uuid.UUID) -> FarmTransaction:
    t = (
        await db.execute(
            select(FarmTransaction)
            .options(selectinload(FarmTransaction.plot))
            .where(FarmTransaction.id == txn_id, FarmTransaction.owner_id == owner_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return t


def _party_key(p: Optional[str]) -> str:
    return (p or "").strip().lower()


# ---------------------------------------------------------------------------
# Create / list
# ---------------------------------------------------------------------------

@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED, summary="Add an expense or income")
async def create_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    await _check_links(db, current_user.id, payload.plot_id, payload.operation_id)
    t = FarmTransaction(owner_id=current_user.id, **payload.model_dump())
    db.add(t)
    await db.flush()
    t = await _get_or_404(db, t.id, current_user.id)
    return _read(t)


@router.get("", response_model=dict, summary="List expenses / income")
async def list_transactions(
    kind: Optional[str] = Query(None, description="expense | income"),
    plot_id: Optional[uuid.UUID] = None,
    party: Optional[str] = None,
    category: Optional[str] = None,
    open_only: bool = Query(False, description="Only entries still unpaid or without a price"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    q = select(FarmTransaction).where(FarmTransaction.owner_id == current_user.id)
    if kind in ("expense", "income"):
        q = q.where(FarmTransaction.kind == kind)
    if plot_id is not None:
        q = q.where(FarmTransaction.plot_id == plot_id)
    if party:
        q = q.where(func.lower(func.trim(FarmTransaction.party)) == _party_key(party))
    if category:
        q = q.where(FarmTransaction.category == category)
    if open_only:
        q = q.where(or_(FarmTransaction.amount.is_(None), FarmTransaction.amount_paid < FarmTransaction.amount))
    if date_from is not None:
        q = q.where(FarmTransaction.txn_date >= date_from)
    if date_to is not None:
        q = q.where(FarmTransaction.txn_date <= date_to)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (
        await db.execute(
            q.options(selectinload(FarmTransaction.plot))
            .order_by(FarmTransaction.txn_date.desc(), FarmTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return {
        "items": [_read(r).model_dump(mode="json") for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": page * page_size < total,
    }


# ---------------------------------------------------------------------------
# Reports — registered before /{id} so the paths are not read as ids
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=ExpenseSummary, summary="Profit & loss for a farm year, per plot")
async def summary(
    year: Optional[int] = Query(None, description="Farm year = the year it starts in (Apr 1). Default: current"),
    allocate_shared: bool = Query(False, description="Split farm-wide (no plot) amounts across plots by acreage"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpenseSummary:
    year = year if year is not None else farm_year_for(date.today())
    d_from, d_to = date(year, 4, 1), date(year + 1, 3, 31)

    T = FarmTransaction
    agg = (
        await db.execute(
            select(
                T.plot_id,
                T.kind,
                func.coalesce(func.sum(func.coalesce(T.amount, 0)), 0),
                func.count().filter(T.amount.is_(None)),
            )
            .where(T.owner_id == current_user.id, T.txn_date >= d_from, T.txn_date <= d_to)
            .group_by(T.plot_id, T.kind)
        )
    ).all()

    by_plot: dict[Optional[uuid.UUID], dict] = {}
    for plot_id, kind, total, unpriced in agg:
        d = by_plot.setdefault(plot_id, {"income": ZERO, "expense": ZERO, "unpriced": 0})
        d[kind] += Decimal(total)
        d["unpriced"] += unpriced

    plots = (await db.execute(select(Plot).where(Plot.owner_id == current_user.id).order_by(Plot.name))).scalars().all()
    shown = [p for p in plots if p.is_active or p.id in by_plot]
    active = [p for p in plots if p.is_active]
    acres_total = sum((p.size_acres or ZERO) for p in active)

    shared = by_plot.get(None, {"income": ZERO, "expense": ZERO, "unpriced": 0})
    rows: list[PlotPnL] = []
    for p in shown:
        d = by_plot.get(p.id, {"income": ZERO, "expense": ZERO, "unpriced": 0})
        inc, exp, unp = d["income"], d["expense"], d["unpriced"]
        if allocate_shared and p.is_active and acres_total > 0:
            share = (p.size_acres or ZERO) / acres_total
            inc += shared["income"] * share
            exp += shared["expense"] * share
        acres = float(p.size_acres or 0)
        rows.append(
            PlotPnL(
                plot_id=p.id,
                plot_name=p.name,
                size_acres=acres,
                income=round(float(inc), 2),
                expense=round(float(exp), 2),
                profit=round(float(inc - exp), 2),
                profit_per_acre=round(float(inc - exp) / acres, 2) if acres > 0 else None,
                expense_per_acre=round(float(exp) / acres, 2) if acres > 0 else None,
                unpriced_count=unp,
            )
        )

    income = sum((d["income"] for d in by_plot.values()), ZERO)
    expense = sum((d["expense"] for d in by_plot.values()), ZERO)
    return ExpenseSummary(
        year=year,
        date_from=d_from,
        date_to=d_to,
        income=float(income),
        expense=float(expense),
        profit=float(income - expense),
        unpriced_count=sum(d["unpriced"] for d in by_plot.values()),
        allocated=allocate_shared and acres_total > 0,
        plots=rows,
        shared=SharedTotals(income=float(shared["income"]), expense=float(shared["expense"]), unpriced_count=shared["unpriced"]),
    )


@router.get("/dues", response_model=list[PartyDue], summary="Who the farmer owes (and who owes him), per shop / buyer")
async def dues(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PartyDue]:
    T = FarmTransaction
    rows = (
        await db.execute(
            select(T)
            .where(T.owner_id == current_user.id, or_(T.amount.is_(None), T.amount_paid < T.amount))
            .order_by(T.txn_date.desc(), T.created_at.desc())
        )
    ).scalars().all()

    groups: dict[tuple[str, str], dict] = {}
    for r in rows:
        g = groups.setdefault(
            (r.kind, _party_key(r.party)),
            {"party": r.party, "total": ZERO, "paid": ZERO, "unpriced": 0, "entries": 0},
        )
        g["entries"] += 1
        if r.amount is None:
            g["unpriced"] += 1
        else:
            g["total"] += r.amount
            g["paid"] += r.amount_paid or ZERO
    out = [
        PartyDue(
            kind=kind, party=g["party"], total=float(g["total"]), paid=float(g["paid"]),
            balance=float(g["total"] - g["paid"]), unpriced_count=g["unpriced"], entries=g["entries"],
        )
        for (kind, _), g in groups.items()
    ]
    out.sort(key=lambda d: (d.kind, -d.balance))
    return out


@router.post("/settle", response_model=SettleResult, summary="Record a payment to a shop (or from a buyer), oldest bills first")
async def settle(
    payload: SettleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettleResult:
    T = FarmTransaction
    rows = (
        await db.execute(
            select(T)
            .where(
                T.owner_id == current_user.id,
                T.kind == payload.kind,
                func.lower(func.trim(T.party)) == _party_key(payload.party),
                T.amount.is_not(None),
                T.amount_paid < T.amount,
            )
            .order_by(T.txn_date.asc(), T.created_at.asc())
        )
    ).scalars().all()

    owed = sum((r.amount - r.amount_paid for r in rows), ZERO)
    if payload.amount > owed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Only ₹{owed} is pending for this party.")

    left, touched = payload.amount, 0
    for r in rows:
        if left <= 0:
            break
        take = min(left, r.amount - r.amount_paid)
        r.amount_paid = (r.amount_paid or ZERO) + take
        left -= take
        touched += 1
    await db.flush()
    return SettleResult(applied=float(payload.amount), remaining_balance=float(owed - payload.amount), entries_updated=touched)


@router.get("/parties", response_model=list[str], summary="Shop / buyer names used before (for suggestions)")
async def parties(
    kind: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    q = select(FarmTransaction.party).where(FarmTransaction.owner_id == current_user.id, FarmTransaction.party.is_not(None))
    if kind in ("expense", "income"):
        q = q.where(FarmTransaction.kind == kind)
    names = (await db.execute(q.order_by(FarmTransaction.created_at.desc()).limit(500))).scalars().all()
    seen: dict[str, str] = {}
    for n in names:
        seen.setdefault(_party_key(n), n)
    return list(seen.values())[:50]


# ---------------------------------------------------------------------------
# Single entry
# ---------------------------------------------------------------------------

@router.get("/{txn_id}", response_model=TransactionRead, summary="Get one entry")
async def get_transaction(
    txn_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    return _read(await _get_or_404(db, txn_id, current_user.id))


@router.patch("/{txn_id}", response_model=TransactionRead, summary="Edit an entry (e.g. fill in the price later)")
async def update_transaction(
    txn_id: uuid.UUID,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionRead:
    t = await _get_or_404(db, txn_id, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    await _check_links(db, current_user.id, data.get("plot_id"), data.get("operation_id"))

    # These can never be cleared
    changes = {k: v for k, v in data.items() if not (k in ("txn_date", "category", "amount_paid") and v is None)}

    # Validate the would-be result BEFORE touching the row, so a rejected edit
    # leaves nothing half-applied.
    amount = changes.get("amount", t.amount) if "amount" in changes else t.amount
    paid = changes.get("amount_paid", t.amount_paid) or ZERO
    category = changes.get("category", t.category)
    try:
        _check_category(t.kind, category)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    if t.kind == "income" and amount is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "income needs an amount")
    if amount is not None and paid > amount:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "amount_paid cannot be more than amount")

    for field, value in changes.items():
        setattr(t, field, value)
    await db.flush()
    return _read(await _get_or_404(db, t.id, current_user.id))


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an entry")
async def delete_transaction(
    txn_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    t = await _get_or_404(db, txn_id, current_user.id)
    await db.delete(t)
    await db.flush()
