"""
Statements Router

Provides statement data for labourers and teams:
  - Work Statement:    daily attendance records (date, task, hours, status, wage)
  - Payment Statement: payments made + daily wage credits from attendance
  - Combined:          both merged and sorted by date

All endpoints support date-range filtering (date_from / date_to).
"""

import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.attendance import Attendance
from app.models.labour import Labour
from app.models.payment import Payment
from app.models.team import Team
from app.models.user import User

router = APIRouter(prefix="/api/v1/statements", tags=["Statements"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class EntityInfo(BaseModel):
    id: str
    name: str
    entity_type: str          # "individual" | "team"
    daily_wage: float
    hometown: Optional[str] = None
    phone: Optional[str] = None
    aadhaar: Optional[str] = None
    # Team-specific
    car_rent: Optional[float] = None
    manager_fee: Optional[float] = None
    member_count: Optional[int] = None


class WorkRow(BaseModel):
    date: str                 # ISO date
    status: str               # present | absent | half_day
    task: Optional[str] = None
    hours_worked: Optional[float] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    num_labourers: Optional[int] = None   # teams only
    wage_earned: float


class PaymentRow(BaseModel):
    date: str                 # ISO date
    type: str                 # "credit" (daily wage) | "borrowed" (payment/advance)
    description: str
    amount: float
    method: Optional[str] = None  # cash | upi | bank_transfer | other
    notes: Optional[str] = None


class StatementSummary(BaseModel):
    total_days_present: int
    total_days_absent: int
    total_days_half: int
    total_wage_earned: float
    total_paid_borrowed: float
    total_wage_credited: float
    balance: float            # earned - borrowed


class WorkStatement(BaseModel):
    entity: EntityInfo
    date_from: str
    date_to: str
    rows: List[WorkRow]
    summary: StatementSummary


class PaymentStatement(BaseModel):
    entity: EntityInfo
    date_from: str
    date_to: str
    rows: List[PaymentRow]
    summary: StatementSummary


class CombinedStatement(BaseModel):
    entity: EntityInfo
    date_from: str
    date_to: str
    work_rows: List[WorkRow]
    payment_rows: List[PaymentRow]
    summary: StatementSummary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _resolve_entity(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> EntityInfo:
    if entity_type == "individual":
        result = await db.execute(
            select(Labour).where(Labour.id == entity_id, Labour.owner_id == owner_id)
        )
        labour = result.scalar_one_or_none()
        if labour is None:
            raise HTTPException(status_code=404, detail="Labour not found")
        return EntityInfo(
            id=str(labour.id),
            name=labour.name,
            entity_type="individual",
            daily_wage=float(labour.daily_wage),
            hometown=labour.hometown,
            phone=labour.phone,
            aadhaar=labour.aadhaar,
        )
    elif entity_type == "team":
        result = await db.execute(
            select(Team)
            .options(selectinload(Team.members))
            .where(Team.id == entity_id, Team.owner_id == owner_id)
        )
        team = result.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        return EntityInfo(
            id=str(team.id),
            name=team.name,
            entity_type="team",
            daily_wage=float(team.daily_wage),
            hometown=team.hometown,
            car_rent=float(team.car_rent),
            manager_fee=float(team.manager_fee),
            member_count=len(team.members),
        )
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'individual' or 'team'")


async def _fetch_attendance(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    owner_id: uuid.UUID,
) -> list[Attendance]:
    if entity_type == "individual":
        q = select(Attendance).where(Attendance.labour_id == entity_id, Attendance.owner_id == owner_id)
    else:
        q = select(Attendance).where(Attendance.team_id == entity_id, Attendance.owner_id == owner_id)

    if date_from:
        q = q.where(Attendance.date >= date_from)
    if date_to:
        q = q.where(Attendance.date <= date_to)

    q = q.order_by(Attendance.date.asc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def _fetch_payments(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    owner_id: uuid.UUID,
) -> list[Payment]:
    if entity_type == "individual":
        q = select(Payment).where(Payment.labour_id == entity_id, Payment.owner_id == owner_id)
    else:
        q = select(Payment).where(Payment.team_id == entity_id, Payment.owner_id == owner_id)

    if date_from:
        q = q.where(Payment.date >= date_from)
    if date_to:
        q = q.where(Payment.date <= date_to)

    q = q.order_by(Payment.date.asc())
    result = await db.execute(q)
    return list(result.scalars().all())


def _build_work_rows(attendances: list[Attendance]) -> list[WorkRow]:
    return [
        WorkRow(
            date=str(a.date),
            status=a.status,
            task=a.task,
            hours_worked=float(a.hours_worked) if a.hours_worked else None,
            work_start_time=a.work_start_time,
            work_end_time=a.work_end_time,
            num_labourers=a.num_labourers,
            wage_earned=float(a.wage_earned),
        )
        for a in attendances
    ]


def _build_payment_rows(
    attendances: list[Attendance],
    payments: list[Payment],
) -> list[PaymentRow]:
    rows: list[PaymentRow] = []

    # Daily wage credits (from attendance where present / half_day)
    for a in attendances:
        if a.status in ("present", "half_day") and float(a.wage_earned) > 0:
            label = "Daily Wage" if a.status == "present" else "Half Day Wage"
            if a.num_labourers:
                label = f"Daily Wage ({a.num_labourers} workers)"
            rows.append(
                PaymentRow(
                    date=str(a.date),
                    type="credit",
                    description=label + (f" — {a.task}" if a.task else ""),
                    amount=float(a.wage_earned),
                )
            )

    # Payments / advances borrowed
    method_labels = {
        "cash": "Cash",
        "upi": "UPI",
        "bank_transfer": "Bank Transfer",
        "other": "Other",
    }
    for p in payments:
        method_label = method_labels.get(p.method, p.method.title())
        description = p.notes or f"Payment via {method_label}"
        rows.append(
            PaymentRow(
                date=str(p.date),
                type="borrowed",
                description=description,
                amount=float(p.amount),
                method=p.method,
                notes=p.notes,
            )
        )

    rows.sort(key=lambda r: r.date)
    return rows


def _build_summary(
    attendances: list[Attendance],
    payments: list[Payment],
) -> StatementSummary:
    present = sum(1 for a in attendances if a.status == "present")
    absent = sum(1 for a in attendances if a.status == "absent")
    half = sum(1 for a in attendances if a.status == "half_day")
    total_earned = sum(float(a.wage_earned) for a in attendances if a.status in ("present", "half_day"))
    total_borrowed = sum(float(p.amount) for p in payments)
    balance = round(total_earned - total_borrowed, 2)

    return StatementSummary(
        total_days_present=present,
        total_days_absent=absent,
        total_days_half=half,
        total_wage_earned=round(total_earned, 2),
        total_paid_borrowed=round(total_borrowed, 2),
        total_wage_credited=round(total_earned, 2),
        balance=balance,
    )


# ---------------------------------------------------------------------------
# List entities available for statements
# ---------------------------------------------------------------------------

class StatementEntity(BaseModel):
    id: str
    name: str
    entity_type: str
    daily_wage: float
    hometown: Optional[str] = None
    is_active: bool


@router.get(
    "/entities",
    response_model=list[StatementEntity],
    summary="List all labours and teams for statement generation",
)
async def list_statement_entities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StatementEntity]:
    """Returns all active labours and teams that can have statements generated."""
    entities: list[StatementEntity] = []

    # Labours
    labour_result = await db.execute(
        select(Labour).where(Labour.owner_id == current_user.id).order_by(Labour.name)
    )
    for labour in labour_result.scalars().all():
        entities.append(StatementEntity(
            id=str(labour.id),
            name=labour.name,
            entity_type="individual",
            daily_wage=float(labour.daily_wage),
            hometown=labour.hometown,
            is_active=labour.is_active,
        ))

    # Teams
    team_result = await db.execute(
        select(Team).where(Team.owner_id == current_user.id).order_by(Team.name)
    )
    for team in team_result.scalars().all():
        entities.append(StatementEntity(
            id=str(team.id),
            name=team.name,
            entity_type="team",
            daily_wage=float(team.daily_wage),
            hometown=team.hometown,
            is_active=team.is_active,
        ))

    return entities


# ---------------------------------------------------------------------------
# Work Statement
# ---------------------------------------------------------------------------

@router.get(
    "/work/{entity_type}/{entity_id}",
    response_model=WorkStatement,
    summary="Get work statement for a labour or team",
)
async def get_work_statement(
    entity_type: str,
    entity_id: uuid.UUID,
    date_from: Optional[date] = Query(None, description="Start date (ISO)"),
    date_to: Optional[date] = Query(None, description="End date (ISO)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkStatement:
    """Returns attendance-based work statement with date range filter."""
    entity = await _resolve_entity(db, entity_type, entity_id, current_user.id)
    attendances = await _fetch_attendance(db, entity_type, entity_id, date_from, date_to, current_user.id)
    payments = await _fetch_payments(db, entity_type, entity_id, date_from, date_to, current_user.id)
    rows = _build_work_rows(attendances)
    summary = _build_summary(attendances, payments)

    return WorkStatement(
        entity=entity,
        date_from=str(date_from) if date_from else "",
        date_to=str(date_to) if date_to else "",
        rows=rows,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Payment Statement
# ---------------------------------------------------------------------------

@router.get(
    "/payment/{entity_type}/{entity_id}",
    response_model=PaymentStatement,
    summary="Get payment statement for a labour or team",
)
async def get_payment_statement(
    entity_type: str,
    entity_id: uuid.UUID,
    date_from: Optional[date] = Query(None, description="Start date (ISO)"),
    date_to: Optional[date] = Query(None, description="End date (ISO)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentStatement:
    """Returns payment ledger: credits (wage) vs borrowed (advances/payments)."""
    entity = await _resolve_entity(db, entity_type, entity_id, current_user.id)
    attendances = await _fetch_attendance(db, entity_type, entity_id, date_from, date_to, current_user.id)
    payments = await _fetch_payments(db, entity_type, entity_id, date_from, date_to, current_user.id)
    rows = _build_payment_rows(attendances, payments)
    summary = _build_summary(attendances, payments)

    return PaymentStatement(
        entity=entity,
        date_from=str(date_from) if date_from else "",
        date_to=str(date_to) if date_to else "",
        rows=rows,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Combined Statement
# ---------------------------------------------------------------------------

@router.get(
    "/combined/{entity_type}/{entity_id}",
    response_model=CombinedStatement,
    summary="Get combined work + payment statement",
)
async def get_combined_statement(
    entity_type: str,
    entity_id: uuid.UUID,
    date_from: Optional[date] = Query(None, description="Start date (ISO)"),
    date_to: Optional[date] = Query(None, description="End date (ISO)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CombinedStatement:
    """Returns both attendance and payment rows with a unified summary."""
    entity = await _resolve_entity(db, entity_type, entity_id, current_user.id)
    attendances = await _fetch_attendance(db, entity_type, entity_id, date_from, date_to, current_user.id)
    payments = await _fetch_payments(db, entity_type, entity_id, date_from, date_to, current_user.id)
    work_rows = _build_work_rows(attendances)
    payment_rows = _build_payment_rows(attendances, payments)
    summary = _build_summary(attendances, payments)

    return CombinedStatement(
        entity=entity,
        date_from=str(date_from) if date_from else "",
        date_to=str(date_to) if date_to else "",
        work_rows=work_rows,
        payment_rows=payment_rows,
        summary=summary,
    )
