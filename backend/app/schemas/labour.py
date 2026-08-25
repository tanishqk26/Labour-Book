"""
Labour Pydantic Schemas

Request/response validation for Labour CRUD endpoints.
"""

import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def _validate_time(value: Optional[str]) -> Optional[str]:
    if value is not None and not TIME_RE.match(value):
        raise ValueError("Time must be in HH:MM format (e.g. '08:00')")
    return value


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class LabourBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Full name of the labourer")
    hometown: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    aadhaar: Optional[str] = Field(None, max_length=20)
    daily_wage: float = Field(..., gt=0, description="Daily wage in INR")
    work_start_time: Optional[str] = Field(None, description="HH:MM format")
    work_end_time: Optional[str] = Field(None, description="HH:MM format")

    @field_validator("work_start_time")
    @classmethod
    def validate_start_time(cls, v: Optional[str]) -> Optional[str]:
        return _validate_time(v)

    @field_validator("work_end_time")
    @classmethod
    def validate_end_time(cls, v: Optional[str]) -> Optional[str]:
        return _validate_time(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class LabourCreate(LabourBase):
    """Schema for POST /api/v1/labours"""
    pass


# ---------------------------------------------------------------------------
# Update (all fields optional for PATCH semantics)
# ---------------------------------------------------------------------------

class LabourUpdate(BaseModel):
    """Schema for PATCH /api/v1/labours/{id}"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    hometown: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    aadhaar: Optional[str] = Field(None, max_length=20)
    daily_wage: Optional[float] = Field(None, gt=0)
    work_start_time: Optional[str] = Field(None)
    work_end_time: Optional[str] = Field(None)
    is_active: Optional[bool] = None

    @field_validator("work_start_time")
    @classmethod
    def validate_start_time(cls, v: Optional[str]) -> Optional[str]:
        return _validate_time(v)

    @field_validator("work_end_time")
    @classmethod
    def validate_end_time(cls, v: Optional[str]) -> Optional[str]:
        return _validate_time(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class LabourRead(BaseModel):
    """Schema returned from all Labour endpoints"""
    id: uuid.UUID
    name: str
    hometown: Optional[str] = None
    phone: Optional[str] = None
    aadhaar: Optional[str] = None
    daily_wage: float
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    is_active: bool
    status: str  # "active" | "inactive"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# List / Pagination
# ---------------------------------------------------------------------------

class PaginatedLabours(BaseModel):
    items: list[LabourRead]
    total: int
    page: int
    page_size: int
    has_more: bool
