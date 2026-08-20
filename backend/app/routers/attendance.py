"""
Attendance Router

Daily attendance endpoints for labourers.
"""

import uuid
from datetime import date, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.attendance import Attendance
from app.models.labour import Labour
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceBulkCreate,
    AttendanceRead,
    AttendanceUpdate,
    DailyAttendanceSummary,
    LabourAttendanceStatus,
)

router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_wage(labour: Labour, status: str, hours_worked: Optional[float]) -> float:
    """Compute wage earned for a single attendance record."""
    daily = float(labour.daily_wage)
    if status == "absent":
        return 0.0
    if status == "half_day":
        return round(daily / 2, 2)
    # present — full day (or proportional if hours provided)
    return round(daily, 2)


async def _get_or_404(db: AsyncSession, attendance_id: uuid.UUID) -> Attendance:
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour))
        .where(Attendance.id == attendance_id)
    )
    att = result.scalar_one_or_none()
    if att is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record '{attendance_id}' not found",
        )
    return att


# ---------------------------------------------------------------------------
# Daily view — all labours with their attendance status for a date
# ---------------------------------------------------------------------------

@router.get(
    "/daily",
    response_model=list[LabourAttendanceStatus],
    summary="Get all labours with attendance status for a date",
)
async def get_daily_attendance(
    for_date: Optional[date] = Query(None, description="ISO date, defaults to today"),
    db: AsyncSession = Depends(get_db),
) -> list[LabourAttendanceStatus]:
    """
    Returns all *active* labours enriched with their attendance for the given date.
    If no attendance record exists for a labour, status=None (not yet marked).
    """
    target_date = for_date or date.today()

    # Fetch all active labours
    labour_result = await db.execute(
        select(Labour).where(Labour.is_active.is_(True)).order_by(Labour.name)
    )
    labours = labour_result.scalars().all()

    if not labours:
        return []

    labour_ids = [l.id for l in labours]

    # Fetch existing attendance records for the date
    att_result = await db.execute(
        select(Attendance).where(
            Attendance.labour_id.in_(labour_ids),
            Attendance.date == target_date,
        )
    )
    attendances = att_result.scalars().all()
    att_map: dict[uuid.UUID, Attendance] = {a.labour_id: a for a in attendances}

    rows: list[LabourAttendanceStatus] = []
    for labour in labours:
        att = att_map.get(labour.id)
        rows.append(
            LabourAttendanceStatus(
                labour_id=labour.id,
                labour_name=labour.name,
                daily_wage=float(labour.daily_wage),
                hometown=labour.hometown,
                attendance_id=att.id if att else None,
                status=att.status if att else None,
                task=att.task if att else None,
                hours_worked=float(att.hours_worked) if att and att.hours_worked else None,
                wage_earned=float(att.wage_earned) if att else None,
            )
        )
    return rows


@router.get(
    "/today",
    response_model=DailyAttendanceSummary,
    summary="Get today's attendance summary",
)
async def get_today_attendance(
    db: AsyncSession = Depends(get_db),
) -> DailyAttendanceSummary:
    """Returns today's attendance records with summary stats."""
    today = date.today()
    return await _build_daily_summary(db, today)


@router.get(
    "/date/{for_date}",
    response_model=DailyAttendanceSummary,
    summary="Get attendance summary for a specific date",
)
async def get_attendance_by_date(
    for_date: date,
    db: AsyncSession = Depends(get_db),
) -> DailyAttendanceSummary:
    """Returns attendance records for a given date."""
    return await _build_daily_summary(db, for_date)


async def _build_daily_summary(db: AsyncSession, target_date: date) -> DailyAttendanceSummary:
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour))
        .where(Attendance.date == target_date)
        .order_by(Attendance.created_at)
    )
    records = result.scalars().all()
    validated = [AttendanceRead.model_validate(r) for r in records]

    return DailyAttendanceSummary(
        date=target_date,
        records=validated,
        total_present=sum(1 for r in validated if r.status == "present"),
        total_absent=sum(1 for r in validated if r.status == "absent"),
        total_half_day=sum(1 for r in validated if r.status == "half_day"),
        total_wage=sum(r.wage_earned for r in validated),
    )


# ---------------------------------------------------------------------------
# Create / Upsert attendance
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=AttendanceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update attendance (upsert)",
)
async def upsert_attendance(
    payload: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
) -> AttendanceRead:
    """
    Mark attendance for a labour on a date.
    If a record already exists for (labour_id, date), it is updated instead of creating a duplicate.
    """
    # Check labour exists
    labour_result = await db.execute(
        select(Labour).where(Labour.id == payload.labour_id)
    )
    labour = labour_result.scalar_one_or_none()
    if labour is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour '{payload.labour_id}' not found",
        )

    # Check for existing record
    existing_result = await db.execute(
        select(Attendance).where(
            Attendance.labour_id == payload.labour_id,
            Attendance.date == payload.date,
        )
    )
    existing = existing_result.scalar_one_or_none()

    wage = _compute_wage(labour, payload.status, payload.hours_worked)

    if existing:
        # Update existing record
        existing.status = payload.status
        existing.task = payload.task
        existing.hours_worked = payload.hours_worked
        existing.wage_earned = wage
        await db.flush()
        await db.refresh(existing)
        result_obj = existing
    else:
        att = Attendance(
            labour_id=payload.labour_id,
            date=payload.date,
            status=payload.status,
            task=payload.task,
            hours_worked=payload.hours_worked,
            wage_earned=wage,
        )
        db.add(att)
        await db.flush()
        await db.refresh(att)
        result_obj = att

    # Reload with labour relationship
    reloaded = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour))
        .where(Attendance.id == result_obj.id)
    )
    return AttendanceRead.model_validate(reloaded.scalar_one())


# ---------------------------------------------------------------------------
# Get single attendance record
# ---------------------------------------------------------------------------

@router.get(
    "/{attendance_id}",
    response_model=AttendanceRead,
    summary="Get a single attendance record",
)
async def get_attendance(
    attendance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> AttendanceRead:
    att = await _get_or_404(db, attendance_id)
    return AttendanceRead.model_validate(att)


# ---------------------------------------------------------------------------
# Update attendance
# ---------------------------------------------------------------------------

@router.patch(
    "/{attendance_id}",
    response_model=AttendanceRead,
    summary="Update an attendance record",
)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
) -> AttendanceRead:
    att = await _get_or_404(db, attendance_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(att, field, value)

    # Recompute wage if status changed
    if "status" in update_data:
        wage = _compute_wage(att.labour, att.status, att.hours_worked)
        att.wage_earned = wage

    await db.flush()
    await db.refresh(att)

    reloaded = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour))
        .where(Attendance.id == att.id)
    )
    return AttendanceRead.model_validate(reloaded.scalar_one())
