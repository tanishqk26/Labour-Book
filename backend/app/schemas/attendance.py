"""
Attendance Pydantic Schemas

Request/response validation for Attendance endpoints.
Supports both individual labourers and teams.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


VALID_STATUSES = {"present", "absent", "half_day"}


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class AttendanceBase(BaseModel):
    status: str = Field("present", description="present | absent  (half_day kept for legacy data)")
    task: Optional[str] = Field(None, max_length=200)
    hours_worked: Optional[float] = Field(None, ge=0, le=24)
    # Raw clock-in / clock-out stored as HH:MM strings (for note-keeping)
    work_start_time: Optional[str] = Field(None, description="HH:MM clock-in time")
    work_end_time: Optional[str] = Field(None, description="HH:MM clock-out time")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


# ---------------------------------------------------------------------------
# Create / Upsert
# ---------------------------------------------------------------------------

class AttendanceCreate(AttendanceBase):
    """Schema for creating or upserting attendance for a labour on a date."""
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    date: date
    num_labourers: Optional[int] = Field(None, ge=0, description="Number of team labourers (teams only)")


class AttendanceBulkItem(AttendanceBase):
    """A single item in a bulk upsert payload."""
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    date: date
    num_labourers: Optional[int] = Field(None, ge=0)


class AttendanceBulkCreate(BaseModel):
    """Schema for bulk-creating/updating attendance for a given date."""
    date: date
    records: list[AttendanceBulkItem] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

class AttendanceUpdate(BaseModel):
    """Schema for PATCH — only update what's provided."""
    status: Optional[str] = None
    task: Optional[str] = Field(None, max_length=200)
    hours_worked: Optional[float] = Field(None, ge=0, le=24)
    work_start_time: Optional[str] = Field(None, description="HH:MM clock-in time")
    work_end_time: Optional[str] = Field(None, description="HH:MM clock-out time")
    num_labourers: Optional[int] = Field(None, ge=0)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(VALID_STATUSES)}")
        return v


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class AttendanceLabourInfo(BaseModel):
    """Minimal labour info nested in attendance responses."""
    id: uuid.UUID
    name: str
    daily_wage: float

    model_config = {"from_attributes": True}


class AttendanceTeamInfo(BaseModel):
    """Minimal team info nested in attendance responses."""
    id: uuid.UUID
    name: str
    daily_wage: float
    car_rent: float
    manager_fee: float

    model_config = {"from_attributes": True}


class AttendanceRead(AttendanceBase):
    id: uuid.UUID
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    date: date
    num_labourers: Optional[int] = None
    wage_earned: float
    created_at: datetime
    updated_at: datetime
    labour: Optional[AttendanceLabourInfo] = None
    team: Optional[AttendanceTeamInfo] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Daily attendance summary
# ---------------------------------------------------------------------------

class DailyAttendanceSummary(BaseModel):
    date: date
    records: list[AttendanceRead]
    total_present: int
    total_absent: int
    total_half_day: int
    total_wage: float


# ---------------------------------------------------------------------------
# Labour with attendance status for a given day (used by daily UI)
# ---------------------------------------------------------------------------

class LabourAttendanceStatus(BaseModel):
    """Labour enriched with their attendance status for a specific date."""
    labour_id: uuid.UUID
    labour_name: str
    daily_wage: float
    hometown: Optional[str] = None
    attendance_id: Optional[uuid.UUID] = None
    status: Optional[str] = None          # None = not yet marked
    task: Optional[str] = None
    hours_worked: Optional[float] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    wage_earned: Optional[float] = None


class TeamAttendanceStatus(BaseModel):
    """Team enriched with their attendance status for a specific date."""
    team_id: uuid.UUID
    team_name: str
    daily_wage: float
    car_rent: float
    manager_fee: float
    attendance_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    num_labourers: Optional[int] = None
    task: Optional[str] = None
    hours_worked: Optional[float] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    wage_earned: Optional[float] = None


class DailyAttendanceView(BaseModel):
    """Combined view of labours + teams for the daily attendance page."""
    labours: list[LabourAttendanceStatus]
    teams: list[TeamAttendanceStatus]
