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

from app.database import get_db
from app.models.attendance import Attendance
from app.models.contract import Contract
from app.models.labour import Labour
from app.models.payment import Payment
from app.models.team import Team
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


async def _get_payment_or_404(db: AsyncSession, payment_id: uuid.UUID) -> Payment:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment '{payment_id}' not found",
        )
    return p


async def _compute_entity_summary(
    db: AsyncSession,
    entity_id: uuid.UUID,
    entity_type: str,  # "individual" | "team"
    entity_name: str,
) -> EntityPaymentSummary:
    """Compute total earned, paid, and pending for a single entity."""

    if entity_type == "individual":
        # Attendance earnings (present + half_day)
        att_result = await db.execute(
            select(func.coalesce(func.sum(Attendance.wage_earned), 0)).where(
                Attendance.labour_id == entity_id,
                Attendance.status.in_(["present", "half_day"]),
            )
        )
        att_earned = float(att_result.scalar_one())

        # Contract earnings (active + completed, not cancelled)
        contract_result = await db.execute(
            select(func.coalesce(func.sum(Contract.amount), 0)).where(
                Contract.labour_id == entity_id,
                Contract.status.in_(["active", "completed"]),
            )
        )
        contract_earned = float(contract_result.scalar_one())

        # Total paid
        paid_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.labour_id == entity_id
            )
        )
        total_paid = float(paid_result.scalar_one())

    else:  # team
        att_result = await db.execute(
            select(func.coalesce(func.sum(Attendance.wage_earned), 0)).where(
                Attendance.team_id == entity_id,
                Attendance.status.in_(["present", "half_day"]),
            )
        )
        att_earned = float(att_result.scalar_one())

        contract_result = await db.execute(
            select(func.coalesce(func.sum(Contract.amount), 0)).where(
                Contract.team_id == entity_id,
                Contract.status.in_(["active", "completed"]),
            )
        )
        contract_earned = float(contract_result.scalar_one())

        paid_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.team_id == entity_id
            )
        )
        total_paid = float(paid_result.scalar_one())

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
) -> PaymentsSummary:
    """Total earned, paid, pending across all labourers and teams."""
    from datetime import date as date_cls
    today = date_cls.today()
    month_start = today.replace(day=1)

    # Total attendance earnings
    att_result = await db.execute(
        select(func.coalesce(func.sum(Attendance.wage_earned), 0)).where(
            Attendance.status.in_(["present", "half_day"])
        )
    )
    att_earned = float(att_result.scalar_one())

    # Total contract earnings
    contract_result = await db.execute(
        select(func.coalesce(func.sum(Contract.amount), 0)).where(
            Contract.status.in_(["active", "completed"])
        )
    )
    contract_earned = float(contract_result.scalar_one())

    total_earned = round(att_earned + contract_earned, 2)

    # Total paid
    paid_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
    )
    total_paid = round(float(paid_result.scalar_one()), 2)

    # Paid this month
    paid_month_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.date >= month_start
        )
    )
    paid_this_month = round(float(paid_month_result.scalar_one()), 2)

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
) -> list[EntityPaymentSummary]:
    """Returns financial summary for every active labourer and team."""
    summaries: list[EntityPaymentSummary] = []

    # Labourers
    if entity_type in (None, "individual"):
        labour_result = await db.execute(
            select(Labour).where(Labour.is_active.is_(True)).order_by(Labour.name)
        )
        labours = labour_result.scalars().all()
        for labour in labours:
            s = await _compute_entity_summary(db, labour.id, "individual", labour.name)
            summaries.append(s)

    # Teams
    if entity_type in (None, "team"):
        team_result = await db.execute(
            select(Team).where(Team.is_active.is_(True)).order_by(Team.name)
        )
        teams = team_result.scalars().all()
        for team in teams:
            s = await _compute_entity_summary(db, team.id, "team", team.name)
            summaries.append(s)

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
) -> EntityPaymentSummary:
    if entity_type == "individual":
        result = await db.execute(select(Labour).where(Labour.id == entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Labour not found")
        name = entity.name
    elif entity_type == "team":
        result = await db.execute(select(Team).where(Team.id == entity_id))
        entity = result.scalar_one_or_none()
        if entity is None:
            raise HTTPException(status_code=404, detail="Team not found")
        name = entity.name
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'individual' or 'team'")

    return await _compute_entity_summary(db, entity_id, entity_type, name)


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
) -> PaymentRead:
    """Record a payment made to a labourer or team."""
    entity_name: Optional[str] = None

    if payload.labour_id:
        result = await db.execute(select(Labour).where(Labour.id == payload.labour_id))
        labour = result.scalar_one_or_none()
        if labour is None:
            raise HTTPException(status_code=404, detail="Labour not found")
        entity_name = labour.name
    else:
        result = await db.execute(select(Team).where(Team.id == payload.team_id))
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
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

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
) -> PaginatedPayments:
    """Paginated list of payments with optional filters."""
    query = select(Payment)

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

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Payment.date.desc(), Payment.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    payments = result.scalars().all()

    # Resolve entity names
    labour_ids = [p.labour_id for p in payments if p.labour_id]
    team_ids = [p.team_id for p in payments if p.team_id]
    labour_names: dict = {}
    team_names: dict = {}
    if labour_ids:
        r = await db.execute(select(Labour.id, Labour.name).where(Labour.id.in_(labour_ids)))
        labour_names = {row[0]: row[1] for row in r.all()}
    if team_ids:
        r = await db.execute(select(Team.id, Team.name).where(Team.id.in_(team_ids)))
        team_names = {row[0]: row[1] for row in r.all()}

    items = []
    for p in payments:
        name = labour_names.get(p.labour_id) if p.labour_id else team_names.get(p.team_id)
        items.append(_payment_to_read(p, name))

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
) -> PaymentRead:
    p = await _get_payment_or_404(db, payment_id)
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
) -> PaymentRead:
    p = await _get_payment_or_404(db, payment_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(p, field, value)
    await db.flush()
    await db.refresh(p)

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
) -> None:
    p = await _get_payment_or_404(db, payment_id)
    await db.delete(p)
    await db.flush()
