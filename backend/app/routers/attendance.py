"""
Attendance Router

Daily attendance endpoints for labourers and teams.

Changes (2026-08-28):
- Added team attendance support: teams have team_id, num_labourers.
- Wage for teams = num_labourers * daily_wage + car_rent + manager_fee.
- /daily endpoint now returns DailyAttendanceView with both labours and teams.
- /bulk endpoint supports both labour and team records.
"""

import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.attendance import Attendance
from app.models.labour import Labour
from app.models.team import Team
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceBulkCreate,
    AttendanceRead,
    AttendanceUpdate,
    DailyAttendanceSummary,
    DailyAttendanceView,
    LabourAttendanceStatus,
    TeamAttendanceStatus,
)

router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_wage_labour(labour: Labour, att_status: str, hours_worked: Optional[float]) -> float:
    """Compute wage for an individual labourer."""
    daily = float(labour.daily_wage)
    if att_status == "absent":
        return 0.0
    if att_status == "half_day":
        return round(daily / 2, 2)
    return round(daily, 2)


def _compute_wage_team(team: Team, att_status: str, num_labourers: Optional[int]) -> float:
    """Compute wage for a team: num_labourers * daily_wage + car_rent + manager_fee."""
    if att_status == "absent" or not num_labourers or num_labourers == 0:
        return 0.0
    daily = float(team.daily_wage)
    car = float(team.car_rent)
    mgr = float(team.manager_fee)
    return round(num_labourers * daily + car + mgr, 2)


async def _get_or_404(db: AsyncSession, attendance_id: uuid.UUID) -> Attendance:
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
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
# Daily view — all labours AND teams with their attendance status for a date
# ---------------------------------------------------------------------------

@router.get(
    "/daily",
    response_model=DailyAttendanceView,
    summary="Get all labours and teams with attendance status for a date",
)
async def get_daily_attendance(
    for_date: Optional[date] = Query(None, description="ISO date, defaults to today"),
    db: AsyncSession = Depends(get_db),
) -> DailyAttendanceView:
    """
    Returns labours and teams enriched with their attendance for the given date.
    """
    target_date = for_date or date.today()

    # --- Labours ---
    labour_result = await db.execute(
        select(Labour).where(Labour.is_active.is_(True)).order_by(Labour.name)
    )
    all_labours = labour_result.scalars().all()
    labour_map: dict[uuid.UUID, Labour] = {l.id: l for l in all_labours}

    # Fetch today's labour attendance records
    today_att_result = await db.execute(
        select(Attendance).where(
            Attendance.labour_id.isnot(None),
            Attendance.date == target_date,
        )
    )
    today_labour_att = today_att_result.scalars().all()
    today_labour_att_map: dict[uuid.UUID, Attendance] = {
        a.labour_id: a for a in today_labour_att if a.labour_id in labour_map
    }

    # Carry-forward for labours
    if not today_labour_att:
        yesterday = target_date - timedelta(days=1)
        yesterday_att_result = await db.execute(
            select(Attendance).where(
                Attendance.labour_id.isnot(None),
                Attendance.date == yesterday,
                Attendance.status == "present",
            )
        )
        yesterday_present = yesterday_att_result.scalars().all()
        if yesterday_present:
            seed_labour_ids = {a.labour_id for a in yesterday_present if a.labour_id in labour_map}
        else:
            seed_labour_ids = set(labour_map.keys())
    else:
        seed_labour_ids = set(today_labour_att_map.keys())

    labour_rows: list[LabourAttendanceStatus] = []
    for labour_id in seed_labour_ids:
        labour = labour_map.get(labour_id)
        if labour is None:
            continue
        att = today_labour_att_map.get(labour_id)
        labour_rows.append(
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
    labour_rows.sort(key=lambda r: r.labour_name)

    # --- Teams ---
    team_result = await db.execute(
        select(Team).where(Team.is_active.is_(True)).order_by(Team.name)
    )
    all_teams = team_result.scalars().all()
    team_map: dict[uuid.UUID, Team] = {t.id: t for t in all_teams}

    today_team_att_result = await db.execute(
        select(Attendance).where(
            Attendance.team_id.isnot(None),
            Attendance.date == target_date,
        )
    )
    today_team_att = today_team_att_result.scalars().all()
    today_team_att_map: dict[uuid.UUID, Attendance] = {
        a.team_id: a for a in today_team_att if a.team_id in team_map
    }

    # For teams: always show all active teams (no carry-forward logic)
    team_rows: list[TeamAttendanceStatus] = []
    for team in all_teams:
        att = today_team_att_map.get(team.id)
        team_rows.append(
            TeamAttendanceStatus(
                team_id=team.id,
                team_name=team.name,
                daily_wage=float(team.daily_wage),
                car_rent=float(team.car_rent),
                manager_fee=float(team.manager_fee),
                attendance_id=att.id if att else None,
                status=att.status if att else None,
                num_labourers=att.num_labourers if att else None,
                task=att.task if att else None,
                hours_worked=float(att.hours_worked) if att and att.hours_worked else None,
                work_start_time=att.work_start_time if att else None,
                work_end_time=att.work_end_time if att else None,
                wage_earned=float(att.wage_earned) if att else None,
            )
        )

    return DailyAttendanceView(labours=labour_rows, teams=team_rows)


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
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
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
# Bulk upsert attendance (labours + teams)
# ---------------------------------------------------------------------------

@router.post(
    "/bulk",
    response_model=list[AttendanceRead],
    status_code=status.HTTP_200_OK,
    summary="Bulk create/update attendance records",
)
async def bulk_upsert_attendance(
    payload: AttendanceBulkCreate,
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceRead]:
    """
    Bulk upsert multiple attendance records for a given date.
    Supports both individual labourers (labour_id) and teams (team_id).
    """
    # Separate labour and team records
    labour_items = [r for r in payload.records if r.labour_id]
    team_items = [r for r in payload.records if r.team_id]

    # Fetch all labours
    labour_ids = [item.labour_id for item in labour_items]
    labours: dict[uuid.UUID, Labour] = {}
    if labour_ids:
        labour_result = await db.execute(
            select(Labour).where(Labour.id.in_(labour_ids))
        )
        labours = {l.id: l for l in labour_result.scalars().all()}

    # Fetch all teams
    team_ids = [item.team_id for item in team_items]
    teams: dict[uuid.UUID, Team] = {}
    if team_ids:
        team_result = await db.execute(
            select(Team).where(Team.id.in_(team_ids))
        )
        teams = {t.id: t for t in team_result.scalars().all()}

    # Fetch existing attendance records for this date
    existing_result = await db.execute(
        select(Attendance).where(Attendance.date == payload.date)
    )
    existing_all = existing_result.scalars().all()
    existing_labour_map: dict[uuid.UUID, Attendance] = {
        a.labour_id: a for a in existing_all if a.labour_id
    }
    existing_team_map: dict[uuid.UUID, Attendance] = {
        a.team_id: a for a in existing_all if a.team_id
    }

    result_ids: list[uuid.UUID] = []

    # Process labour items
    for item in labour_items:
        labour = labours.get(item.labour_id)
        if labour is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Labour '{item.labour_id}' not found",
            )
        wage = _compute_wage_labour(labour, item.status, item.hours_worked)
        existing = existing_labour_map.get(item.labour_id)

        if existing:
            existing.status = item.status
            existing.task = item.task
            existing.hours_worked = item.hours_worked
            existing.work_start_time = item.work_start_time
            existing.work_end_time = item.work_end_time
            existing.wage_earned = wage
            result_ids.append(existing.id)
        else:
            att = Attendance(
                labour_id=item.labour_id,
                date=payload.date,
                status=item.status,
                task=item.task,
                hours_worked=item.hours_worked,
                work_start_time=item.work_start_time,
                work_end_time=item.work_end_time,
                wage_earned=wage,
            )
            db.add(att)
            await db.flush()
            result_ids.append(att.id)

    # Process team items
    for item in team_items:
        team = teams.get(item.team_id)
        if team is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Team '{item.team_id}' not found",
            )
        wage = _compute_wage_team(team, item.status, item.num_labourers)
        existing = existing_team_map.get(item.team_id)

        if existing:
            existing.status = item.status
            existing.num_labourers = item.num_labourers
            existing.task = item.task
            existing.hours_worked = item.hours_worked
            existing.work_start_time = item.work_start_time
            existing.work_end_time = item.work_end_time
            existing.wage_earned = wage
            result_ids.append(existing.id)
        else:
            att = Attendance(
                team_id=item.team_id,
                date=payload.date,
                status=item.status,
                num_labourers=item.num_labourers,
                task=item.task,
                hours_worked=item.hours_worked,
                work_start_time=item.work_start_time,
                work_end_time=item.work_end_time,
                wage_earned=wage,
            )
            db.add(att)
            await db.flush()
            result_ids.append(att.id)

    await db.flush()

    # Reload all with relationships
    reloaded_result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
        .where(Attendance.id.in_(result_ids))
    )
    return [AttendanceRead.model_validate(a) for a in reloaded_result.scalars().all()]


# ---------------------------------------------------------------------------
# Create / Upsert single attendance
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
    Mark attendance for a labour or team on a date.
    """
    if payload.labour_id:
        labour_result = await db.execute(
            select(Labour).where(Labour.id == payload.labour_id)
        )
        labour = labour_result.scalar_one_or_none()
        if labour is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Labour '{payload.labour_id}' not found")

        existing_result = await db.execute(
            select(Attendance).where(
                Attendance.labour_id == payload.labour_id,
                Attendance.date == payload.date,
            )
        )
        existing = existing_result.scalar_one_or_none()
        wage = _compute_wage_labour(labour, payload.status, payload.hours_worked)

    elif payload.team_id:
        team_result = await db.execute(
            select(Team).where(Team.id == payload.team_id)
        )
        team = team_result.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Team '{payload.team_id}' not found")

        existing_result = await db.execute(
            select(Attendance).where(
                Attendance.team_id == payload.team_id,
                Attendance.date == payload.date,
            )
        )
        existing = existing_result.scalar_one_or_none()
        wage = _compute_wage_team(team, payload.status, payload.num_labourers)
    else:
        raise HTTPException(status_code=400, detail="Either labour_id or team_id is required")

    if existing:
        existing.status = payload.status
        existing.task = payload.task
        existing.hours_worked = payload.hours_worked
        existing.work_start_time = payload.work_start_time
        existing.work_end_time = payload.work_end_time
        existing.num_labourers = payload.num_labourers
        existing.wage_earned = wage
        await db.flush()
        await db.refresh(existing)
        result_obj = existing
    else:
        att = Attendance(
            labour_id=payload.labour_id,
            team_id=payload.team_id,
            date=payload.date,
            status=payload.status,
            num_labourers=payload.num_labourers,
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

    reloaded = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
        .where(Attendance.id == result_obj.id)
    )
    return AttendanceRead.model_validate(reloaded.scalar_one())


# ---------------------------------------------------------------------------
# History endpoints — must be BEFORE /{attendance_id} to avoid UUID clash
# ---------------------------------------------------------------------------

@router.get(
    "/history",
    response_model=dict,
    summary="Paginated attendance history with filters",
)
async def get_attendance_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    entity_type: Optional[str] = Query(None, description="labour | team"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns paginated attendance records, optionally filtered by entity type."""
    from sqlalchemy import func as sqlfunc
    query = (
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
    )
    if entity_type == "labour":
        query = query.where(Attendance.labour_id.isnot(None))
    elif entity_type == "team":
        query = query.where(Attendance.team_id.isnot(None))

    count_q = select(sqlfunc.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Attendance.date.desc(), Attendance.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    records = [AttendanceRead.model_validate(r) for r in result.scalars().all()]

    return {
        "items": [r.model_dump() for r in records],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (offset + len(records)) < total,
    }


@router.get(
    "/labour/{labour_id}/history",
    response_model=list[AttendanceRead],
    summary="Get attendance history for a specific labour",
)
async def get_labour_attendance_history(
    labour_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceRead]:
    """Returns all attendance records for a specific labourer, newest first."""
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
        .where(Attendance.labour_id == labour_id)
        .order_by(Attendance.date.desc())
        .limit(limit)
    )
    return [AttendanceRead.model_validate(r) for r in result.scalars().all()]


@router.get(
    "/team/{team_id}/history",
    response_model=list[AttendanceRead],
    summary="Get attendance history for a specific team",
)
async def get_team_attendance_history(
    team_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceRead]:
    """Returns all attendance records for a specific team, newest first."""
    result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
        .where(Attendance.team_id == team_id)
        .order_by(Attendance.date.desc())
        .limit(limit)
    )
    return [AttendanceRead.model_validate(r) for r in result.scalars().all()]


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

    # Recompute wage if status or num_labourers changed
    if "status" in update_data or "num_labourers" in update_data:
        if att.labour_id and att.labour:
            wage = _compute_wage_labour(att.labour, att.status, att.hours_worked)
        elif att.team_id and att.team:
            wage = _compute_wage_team(att.team, att.status, att.num_labourers)
        else:
            wage = 0.0
        att.wage_earned = wage

    await db.flush()
    await db.refresh(att)

    reloaded = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.labour), selectinload(Attendance.team))
        .where(Attendance.id == att.id)
    )
    return AttendanceRead.model_validate(reloaded.scalar_one())

