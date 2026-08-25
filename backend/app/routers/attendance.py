"""
Attendance Router

Daily attendance endpoints for labourers.

Changes (2026-08-25):
- /daily endpoint now carries forward yesterday's present labourers as the
  seed list for today if no attendance has been recorded yet.
- work_start_time / work_end_time stored per record for note-keeping.
- Wage computation simplified: present = full daily wage, absent = 0.
  half_day kept in valid statuses for backward compatibility with existing data
  but will no longer be created from the new UI.
"""

import uuid
from datetime import date, timedelta
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
    """Compute wage earned for a single attendance record.

    Rules (as of 2026-08-25 UI update):
    - present  → full daily wage (hours_worked is informational only, not used for pay)
    - absent   → 0
    - half_day → kept for legacy data; computes 50% of daily wage
    """
    daily = float(labour.daily_wage)
    if status == "absent":
        return 0.0
    if status == "half_day":
        # Legacy — new UI no longer creates half_day records
        return round(daily / 2, 2)
    # present
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
    Returns labours enriched with their attendance for the given date.

    Carry-forward behaviour:
    - If no attendance records exist for today yet, we return all labourers
      who were marked *present* yesterday as the seed list (mirroring the
      "carry forward yesterday's workers" UX feature).
    - Labourers not in the returned list are considered absent by default.
    - If no records exist for yesterday either, we fall back to all active
      labourers (full list as before).
    """
    target_date = for_date or date.today()

    # Fetch all active labours (needed for carry-forward fallback)
    labour_result = await db.execute(
        select(Labour).where(Labour.is_active.is_(True)).order_by(Labour.name)
    )
    all_labours = labour_result.scalars().all()

    if not all_labours:
        return []

    labour_map: dict[uuid.UUID, Labour] = {l.id: l for l in all_labours}

    # Fetch today's existing attendance records
    today_att_result = await db.execute(
        select(Attendance).where(
            Attendance.labour_id.in_(list(labour_map.keys())),
            Attendance.date == target_date,
        )
    )
    today_attendances = today_att_result.scalars().all()
    today_att_map: dict[uuid.UUID, Attendance] = {a.labour_id: a for a in today_attendances}

    # -----------------------------------------------------------------------
    # Carry-forward: if no attendance recorded today, use yesterday's present
    # labourers as the list (so user doesn't have to re-add the same people
    # every day).
    # -----------------------------------------------------------------------
    if not today_attendances:
        yesterday = target_date - timedelta(days=1)
        yesterday_att_result = await db.execute(
            select(Attendance).where(
                Attendance.labour_id.in_(list(labour_map.keys())),
                Attendance.date == yesterday,
                Attendance.status == "present",
            )
        )
        yesterday_present = yesterday_att_result.scalars().all()

        if yesterday_present:
            # Use the set of labourers who were present yesterday
            seed_labour_ids = {a.labour_id for a in yesterday_present}
        else:
            # No yesterday data — use all active labourers as seed
            seed_labour_ids = set(labour_map.keys())
    else:
        # Today already has data — use the labourers already in the list
        seed_labour_ids = set(today_att_map.keys())

    # Build response rows
    rows: list[LabourAttendanceStatus] = []
    for labour_id in seed_labour_ids:
        labour = labour_map.get(labour_id)
        if labour is None:
            continue  # Labour was deactivated since yesterday
        att = today_att_map.get(labour_id)
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
                work_start_time=att.work_start_time if att else None,
                work_end_time=att.work_end_time if att else None,
                wage_earned=float(att.wage_earned) if att else None,
            )
        )

    # Sort alphabetically by name
    rows.sort(key=lambda r: r.labour_name)
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
    If a record already exists for (labour_id, date), it is updated instead of
    creating a duplicate.
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
        existing.work_start_time = payload.work_start_time
        existing.work_end_time = payload.work_end_time
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
            work_start_time=payload.work_start_time,
            work_end_time=payload.work_end_time,
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
