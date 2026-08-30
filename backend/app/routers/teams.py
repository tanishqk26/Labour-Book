"""
Teams Router

CRUD endpoints for labour teams.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.labour import Labour
from app.models.team import Team
from app.schemas.labour import LabourRead
from app.schemas.team import (
    PaginatedTeams,
    TeamAddMembers,
    TeamCreate,
    TeamRead,
    TeamRemoveMembers,
    TeamSummary,
    TeamUpdate,
)

router = APIRouter(prefix="/api/v1/teams", tags=["Teams"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def labour_to_read(labour: Labour) -> LabourRead:
    return LabourRead(
        id=labour.id,
        name=labour.name,
        hometown=labour.hometown,
        phone=labour.phone,
        aadhaar=labour.aadhaar,
        daily_wage=float(labour.daily_wage),
        work_start_time=labour.work_start_time,
        work_end_time=labour.work_end_time,
        is_active=labour.is_active,
        status="active" if labour.is_active else "inactive",
        created_at=labour.created_at,
        updated_at=labour.updated_at,
    )


def team_to_read(team: Team) -> TeamRead:
    return TeamRead(
        id=team.id,
        name=team.name,
        description=team.description,
        daily_wage=float(team.daily_wage),
        car_rent=float(team.car_rent),
        manager_fee=float(team.manager_fee),
        is_active=team.is_active,
        status="active" if team.is_active else "inactive",
        member_count=len(team.members),
        members=[labour_to_read(m) for m in team.members],
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


def team_to_summary(team: Team) -> TeamSummary:
    return TeamSummary(
        id=team.id,
        name=team.name,
        description=team.description,
        daily_wage=float(team.daily_wage),
        car_rent=float(team.car_rent),
        manager_fee=float(team.manager_fee),
        is_active=team.is_active,
        status="active" if team.is_active else "inactive",
        member_count=len(team.members),
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


async def _get_team_or_404(db: AsyncSession, team_id: uuid.UUID) -> Team:
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.members))
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with id '{team_id}' not found",
        )
    return team


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=TeamRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a team",
)
async def create_team(
    payload: TeamCreate,
    db: AsyncSession = Depends(get_db),
) -> TeamRead:
    """Create a new labour team."""
    team = Team(
        name=payload.name,
        description=payload.description,
        daily_wage=payload.daily_wage,
        car_rent=payload.car_rent,
        manager_fee=payload.manager_fee,
    )
    db.add(team)
    await db.flush()
    await db.refresh(team, attribute_names=["members"])
    return team_to_read(team)


@router.get(
    "",
    response_model=PaginatedTeams,
    summary="List teams",
)
async def list_teams(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page"),
    search: Optional[str] = Query(None, description="Search by name"),
    status_filter: Optional[str] = Query(None, alias="status", description="active | inactive"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedTeams:
    """Returns a paginated list of teams."""
    query = select(Team).options(selectinload(Team.members))

    if status_filter == "active":
        query = query.where(Team.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.where(Team.is_active.is_(False))

    if search:
        term = f"%{search.strip()}%"
        query = query.where(Team.name.ilike(term))

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Team.name).offset(offset).limit(page_size)
    result = await db.execute(query)
    teams = result.scalars().all()

    return PaginatedTeams(
        items=[team_to_summary(t) for t in teams],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(teams)) < total,
    )


@router.get(
    "/{team_id}",
    response_model=TeamRead,
    summary="Get a team by ID",
)
async def get_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> TeamRead:
    """Retrieve a single team by UUID, including its members."""
    team = await _get_team_or_404(db, team_id)
    return team_to_read(team)


@router.patch(
    "/{team_id}",
    response_model=TeamRead,
    summary="Update a team",
)
async def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamRead:
    """Partially update a team's details."""
    team = await _get_team_or_404(db, team_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.flush()
    await db.refresh(team, attribute_names=["members"])
    return team_to_read(team)


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a team",
)
async def deactivate_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a team by setting is_active=False."""
    team = await _get_team_or_404(db, team_id)
    team.is_active = False
    await db.flush()


@router.delete(
    "/{team_id}/hard",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a team and all their records",
)
async def hard_delete_team(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Permanently delete a team. Attendance records are deleted via CASCADE.
    """
    team = await _get_team_or_404(db, team_id)
    await db.delete(team)
    await db.flush()


@router.post(
    "/{team_id}/members",
    response_model=TeamRead,
    summary="Add members to a team",
)
async def add_members(
    team_id: uuid.UUID,
    payload: TeamAddMembers,
    db: AsyncSession = Depends(get_db),
) -> TeamRead:
    """Add existing labours to a team. Duplicate assignments are silently ignored."""
    team = await _get_team_or_404(db, team_id)

    # Fetch all requested labours
    result = await db.execute(
        select(Labour).where(Labour.id.in_(payload.labour_ids))
    )
    labours = result.scalars().all()

    if len(labours) != len(payload.labour_ids):
        found_ids = {l.id for l in labours}
        missing = [str(lid) for lid in payload.labour_ids if lid not in found_ids]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour(s) not found: {', '.join(missing)}",
        )

    # Only add labours not already in the team
    existing_ids = {m.id for m in team.members}
    for labour in labours:
        if labour.id not in existing_ids:
            team.members.append(labour)

    await db.flush()
    await db.refresh(team, attribute_names=["members"])
    return team_to_read(team)


@router.delete(
    "/{team_id}/members",
    response_model=TeamRead,
    summary="Remove members from a team",
)
async def remove_members(
    team_id: uuid.UUID,
    payload: TeamRemoveMembers,
    db: AsyncSession = Depends(get_db),
) -> TeamRead:
    """Remove labours from a team. IDs not in the team are silently ignored."""
    team = await _get_team_or_404(db, team_id)

    remove_ids = set(payload.labour_ids)
    team.members = [m for m in team.members if m.id not in remove_ids]

    await db.flush()
    await db.refresh(team, attribute_names=["members"])
    return team_to_read(team)
