"""
Payments Router

CRUD endpoints for recording payments to labourers and teams.
Also computes financial summaries (earned / paid / pending).

Business logic:
  Earnings = sum of Attendance.wage_earned (where status != 'absent') + sum of Contract.amount (active/completed)
  Paid     = sum of Payment.amount
  Pending  = Earnings - Paid
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.attendance import Attendance
from app.models.contract import Contract
from app.models.labour import Labour
from app.models.payment import Payment
from app.models.team import Team
from app.models.user import User
from app.schemas.payment import (
    EntityPaymentSummary,
    PaginatedPayments,
    PaymentCreate,
    PaymentRead,
    PaymentsSummary,
    PaymentUpdate,
)

router = APIRouter(prefix="/api/v1/payments", tags=["Payments"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _payment_to_read(p: Payment, entity_name: Optional[str] = None) -> PaymentRead:
    return PaymentRead(
        id=p.id,
        labour_id=p.labour_id,
        team_id=p.team_id,
        entity_name=entity_name,
        entity_type="individual" if p.labour_id else "team",
        date=p.date,
        amount=float(p.amount),
        method=p.method,
        notes=p.notes,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


async def _get_payment_or_404(db: AsyncSession, payment_id: uuid.UUID, owner_id: uuid.UUID) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.owner_id == owner_id)
    )
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment '{payment_id}' not found",
        )
    return p


def _build_entity_summary(
    entity_id: uuid.UUID,
    entity_type: str,  # "individual" | "team"
    entity_name: str,
    att_earned: float,
    contract_earned: float,
    total_paid: float,
) -> EntityPaymentSummary:
    """Pure helper: turn raw totals into an EntityPaymentSummary (no DB access)."""
    total_earned = round(att_earned + contract_earned, 2)
    total_paid = round(total_paid, 2)
    pending = round(total_earned - total_paid, 2)

    if total_earned == 0:
        payment_status = "pending"
    elif total_paid >= total_earned:
        payment_status = "paid"
    elif total_paid > 0:
        payment_status = "partially_paid"
    else:
        payment_status = "pending"

    return EntityPaymentSummary(
        entity_id=entity_id,
        entity_type=entity_type,
        entity_name=entity_name,
        total_earned=total_earned,
        total_paid=total_paid,
        pending=pending,
        payment_status=payment_status,
    )


async def _compute_entity_summary(
    db: AsyncSession,
    entity_id: uuid.UUID,
    entity_type: str,  # "individual" | "team"
    entity_name: str,
    owner_id: uuid.UUID,
) -> EntityPaymentSummary:
    """Total earned / paid / pending for ONE entity, in a single round-trip."""
    if entity_type == "individual":
        att_col, con_col, pay_col = Attendance.labour_id, Contract.labour_id, Payment.labour_id
    else:
        att_col, con_col, pay_col = Attendance.team_id, Contract.team_id, Payment.team_id

    row = (await db.execute(
        select(
            select(func.coalesce(func.sum(Attendance.wage_earned), 0)).where(
                att_col == entity_id,
                Attendance.status.in_(["present", "half_day"]),
                Attendance.owner_id == owner_id,
            ).scalar_subquery(),
            select(func.coalesce(func.sum(Contract.amount), 0)).where(
                con_col == entity_id,
                Contract.status.in_(["active", "completed"]),
                Contract.owner_id == owner_id,
            ).scalar_subquery(),
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                pay_col == entity_id,
                Payment.owner_id == owner_id,
            ).scalar_subquery(),
        )
    )).one()
    return _build_entity_summary(
        entity_id, entity_type, entity_name, float(row[0]), float(row[1]), float(row[2])
    )


async def _grouped_totals(
    db: AsyncSession, owner_id: uuid.UUID, entity_type: str
) -> tuple[dict, dict, dict]:
    """Per-entity attendance / contract / payment totals via 3 GROUP BY queries
    (instead of 3 queries per entity)."""
    if entity_type == "individual":
        att_col, con_col, pay_col = Attendance.labour_id, Contract.labour_id, Payment.labour_id
    else:
        att_col, con_col, pay_col = Attendance.team_id, Contract.team_id, Payment.team_id

    att_rows = await db.execute(
        select(att_col, func.coalesce(func.sum(Attendance.wage_earned), 0))
        .where(att_col.isnot(None), Attendance.status.in_(["present", "half_day"]), Attendance.owner_id == owner_id)
        .group_by(att_col)
    )
    con_rows = await db.execute(
        select(con_col, func.coalesce(func.sum(Contract.amount), 0))
        .where(con_col.isnot(None), Contract.status.in_(["active", "completed"]), Contract.owner_id == owner_id)
        .group_by(con_col)
    )
    pay_rows = await db.execute(
        select(pay_col, func.coalesce(func.sum(Payment.amount), 0))
        .where(pay_col.isnot(None), Payment.owner_id == owner_id)
        .group_by(pay_col)
    )
    return (
        {k: float(v) for k, v in att_rows.all()},
        {k: float(v) for k, v in con_rows.all()},
        {k: float(v) for k, v in pay_rows.all()},
    )


# ---------------------------------------------------------------------------
# Summary endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=PaymentsSummary,
    summary="Get overall payments summary",
)
async def get_payments_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentsSummary:
    """Total earned, paid, pending across all labourers and teams."""
    from datetime import date as date_cls
    today = date_cls.today()
    month_start = today.replace(day=1)

    # All four totals in a single round-trip.
    row = (await db.execute(
        select(
            select(func.coalesce(func.sum(Attendance.wage_earned), 0)).where(
                Attendance.status.in_(["present", "half_day"]),
                Attendance.owner_id == current_user.id,
            ).scalar_subquery(),
            select(func.coalesce(func.sum(Contract.amount), 0)).where(
                Contract.status.in_(["active", "completed"]),
                Contract.owner_id == current_user.id,
            ).scalar_subquery(),
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.owner_id == current_user.id
            ).scalar_subquery(),
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.date >= month_start,
                Payment.owner_id == current_user.id,
            ).scalar_subquery(),
        )
    )).one()
    att_earned, contract_earned = float(row[0]), float(row[1])
    total_earned = round(att_earned + contract_earned, 2)
    total_paid = round(float(row[2]), 2)
    paid_this_month = round(float(row[3]), 2)

    return PaymentsSummary(
        total_earned=total_earned,
        total_paid=total_paid,
        total_pending=round(total_earned - total_paid, 2),
        paid_this_month=paid_this_month,
    )


@router.get(
    "/entities",
    response_model=list[EntityPaymentSummary],
    summary="Get payment summary for all labourers and teams",
)
async def list_entity_summaries(
    sort_by: Optional[str] = Query(None, description="pending | name | earned"),
    entity_type: Optional[str] = Query(None, description="individual | team"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EntityPaymentSummary]:
    """Returns financial summary for every active labourer and team."""
    summaries: list[EntityPaymentSummary] = []

    for kind, model in (("individual", Labour), ("team", Team)):
        if entity_type not in (None, kind):
            continue
        entities = (await db.execute(
            select(model.id, model.name)
            .where(model.is_active.is_(True), model.owner_id == current_user.id)
            .order_by(model.name)
        )).all()
        if not entities:
            continue
        att, con, pay = await _grouped_totals(db, current_user.id, kind)
        for eid, ename in entities:
            summaries.append(
                _build_entity_summary(eid, kind, ename, att.get(eid, 0.0), con.get(eid, 0.0), pay.get(eid, 0.0))
            )

    # Sorting
    if sort_by == "pending":
        summaries.sort(key=lambda s: s.pending, reverse=True)
    elif sort_by == "earned":
        summaries.sort(key=lambda s: s.total_earned, reverse=True)
    else:
        summaries.sort(key=lambda s: s.entity_name.lower())

    return summaries


@router.get(
    "/entity/{entity_type}/{entity_id}/summary",
    response_model=EntityPaymentSummary,
    summary="Get payment summary for a specific labour or team",
)
async def get_entity_summary(
    entity_type: str,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntityPaymentSummary:
    if entity_type == "individual":
        result = await db.execute(
            select(Labour).where(Labour.id == entity_id, Labour.owner_id == current_user.id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Labour not found")
        name = entity.name
    elif entity_type == "team":
        result = await db.execute(
            select(Team).where(Team.id == entity_id, Team.owner_id == current_user.id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Team not found")
        name = entity.name
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'individual' or 'team'")

    return await _compute_entity_summary(db, entity_id, entity_type, name, current_user.id)


# ---------------------------------------------------------------------------
# Payment CRUD
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a payment",
)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentRead:
    """Record a payment made to a labourer or team."""
    entity_name: Optional[str] = None

    if payload.labour_id:
        result = await db.execute(
            select(Labour).where(Labour.id == payload.labour_id, Labour.owner_id == current_user.id)
        )
        labour = result.scalar_one_or_none()
        if labour is None:
            raise HTTPException(status_code=404, detail="Labour not found")
        entity_name = labour.name
    else:
        result = await db.execute(
            select(Team).where(Team.id == payload.team_id, Team.owner_id == current_user.id)
        )
        team = result.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        entity_name = team.name

    payment = Payment(
        labour_id=payload.labour_id,
        team_id=payload.team_id,
        date=payload.date,
        amount=payload.amount,
        method=payload.method,
        notes=payload.notes,
        owner_id=current_user.id,
    )
    db.add(payment)
    await db.flush()  # eager_defaults fills timestamps via RETURNING

    return _payment_to_read(payment, entity_name)


@router.get(
    "",
    response_model=PaginatedPayments,
    summary="List payments with filters",
)
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    labour_id: Optional[uuid.UUID] = Query(None),
    team_id: Optional[uuid.UUID] = Query(None),
    method: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedPayments:
    """Paginated list of payments with optional filters."""
    query = select(Payment).where(Payment.owner_id == current_user.id)

    if labour_id:
        query = query.where(Payment.labour_id == labour_id)
    if team_id:
        query = query.where(Payment.team_id == team_id)
    if method:
        query = query.where(Payment.method == method)
    if date_from:
        query = query.where(Payment.date >= date_from)
    if date_to:
        query = query.where(Payment.date <= date_to)

    # ONE round-trip: page of payments + labour/team names (outer joins) + total
    # (COUNT(*) OVER () window).
    offset = (page - 1) * page_size
    paged = (
        query.outerjoin(Labour, Labour.id == Payment.labour_id)
        .outerjoin(Team, Team.id == Payment.team_id)
        .add_columns(
            Labour.name.label("_labour_name"),
            Team.name.label("_team_name"),
            func.count().over().label("_total"),
        )
        .order_by(Payment.date.desc(), Payment.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(paged)).all()
    if rows:
        total = rows[0][3]
    elif page > 1:
        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    else:
        total = 0

    payments = [r[0] for r in rows]
    items = [
        _payment_to_read(p, labour_name if p.labour_id else team_name)
        for p, labour_name, team_name, _ in rows
    ]

    return PaginatedPayments(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(payments)) < total,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentRead,
    summary="Get a single payment",
)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentRead:
    p = await _get_payment_or_404(db, payment_id, current_user.id)
    name: Optional[str] = None
    if p.labour_id:
        r = await db.execute(select(Labour.name).where(Labour.id == p.labour_id))
        name = r.scalar_one_or_none()
    elif p.team_id:
        r = await db.execute(select(Team.name).where(Team.id == p.team_id))
        name = r.scalar_one_or_none()
    return _payment_to_read(p, name)


@router.patch(
    "/{payment_id}",
    response_model=PaymentRead,
    summary="Update a payment",
)
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentRead:
    p = await _get_payment_or_404(db, payment_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(p, field, value)
    await db.flush()

    name: Optional[str] = None
    if p.labour_id:
        r = await db.execute(select(Labour.name).where(Labour.id == p.labour_id))
        name = r.scalar_one_or_none()
    elif p.team_id:
        r = await db.execute(select(Team.name).where(Team.id == p.team_id))
        name = r.scalar_one_or_none()
    return _payment_to_read(p, name)


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a payment",
)
async def delete_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    p = await _get_payment_or_404(db, payment_id, current_user.id)
    await db.delete(p)
    await db.flush()
