"""
Attendance Pydantic Schemas

Request/response validation for Attendance endpoints.
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
    status: str = Field("present", description="present | absent | half_day")
    task: Optional[str] = Field(None, max_length=200)
    hours_worked: Optional[float] = Field(None, ge=0, le=24)

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
    labour_id: uuid.UUID
    date: date


class AttendanceBulkItem(AttendanceBase):
    """A single item in a bulk upsert payload."""
    labour_id: uuid.UUID
    date: date


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


class AttendanceRead(AttendanceBase):
    id: uuid.UUID
    labour_id: uuid.UUID
    date: date
    wage_earned: float
    created_at: datetime
    updated_at: datetime
    labour: Optional[AttendanceLabourInfo] = None

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
    wage_earned: Optional[float] = None
