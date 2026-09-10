"""
Settings Router

Provides system information, record counts, and app metadata
for the Settings page. All read-only — no mutations.
"""

import sys
import platform
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.attendance import Attendance
from app.models.labour import Labour
from app.models.payment import Payment
from app.models.team import Team
from app.models.user import User

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SystemStats(BaseModel):
    total_labours: int
    active_labours: int
    total_teams: int
    active_teams: int
    total_attendance_records: int
    total_payments: int
    python_version: str
    platform: str
    app_version: str = "1.0.0"


class HealthStatus(BaseModel):
    status: str
    database: str
    api_version: str = "1.0.0"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/stats",
    response_model=SystemStats,
    summary="Get system statistics for settings page",
)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SystemStats:
    """Returns aggregate counts and system info, scoped to the current user."""

    total_labours = (await db.execute(
        select(func.count(Labour.id)).where(Labour.owner_id == current_user.id)
    )).scalar_one()
    active_labours = (await db.execute(
        select(func.count(Labour.id)).where(Labour.is_active == True, Labour.owner_id == current_user.id)
    )).scalar_one()

    total_teams = (await db.execute(
        select(func.count(Team.id)).where(Team.owner_id == current_user.id)
    )).scalar_one()
    active_teams = (await db.execute(
        select(func.count(Team.id)).where(Team.is_active == True, Team.owner_id == current_user.id)
    )).scalar_one()

    total_attendance = (await db.execute(
        select(func.count(Attendance.id)).where(Attendance.owner_id == current_user.id)
    )).scalar_one()
    total_payments = (await db.execute(
        select(func.count(Payment.id)).where(Payment.owner_id == current_user.id)
    )).scalar_one()

    return SystemStats(
        total_labours=total_labours,
        active_labours=active_labours,
        total_teams=total_teams,
        active_teams=active_teams,
        total_attendance_records=total_attendance,
        total_payments=total_payments,
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        platform=platform.system(),
    )


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="Health check with database connectivity test",
)
async def settings_health(
    db: AsyncSession = Depends(get_db),
) -> HealthStatus:
    """Quick health check — tests DB connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    return HealthStatus(
        status="ok",
        database=db_status,
    )
