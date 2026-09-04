"""
Team Pydantic Schemas

Request/response validation for Team CRUD endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.labour import LabourRead


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class TeamCreate(BaseModel):
    """Schema for POST /api/v1/teams"""
    name: str = Field(..., min_length=1, max_length=100, description="Team name")
    description: Optional[str] = Field(None, max_length=255)
    hometown: Optional[str] = Field(None, max_length=100)
    daily_wage: float = Field(..., ge=0, description="Per-labourer daily wage")
    car_rent: float = Field(0, ge=0, description="Daily car/transport rent")
    manager_fee: float = Field(0, ge=0, description="Daily manager fee")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Update (all fields optional for PATCH semantics)
# ---------------------------------------------------------------------------

class TeamUpdate(BaseModel):
    """Schema for PATCH /api/v1/teams/{id}"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    hometown: Optional[str] = Field(None, max_length=100)
    daily_wage: Optional[float] = Field(None, ge=0)
    car_rent: Optional[float] = Field(None, ge=0)
    manager_fee: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------

class TeamAddMembers(BaseModel):
    """Schema for POST /api/v1/teams/{id}/members"""
    labour_ids: list[uuid.UUID] = Field(..., min_length=1)


class TeamRemoveMembers(BaseModel):
    """Schema for DELETE /api/v1/teams/{id}/members"""
    labour_ids: list[uuid.UUID] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class TeamRead(BaseModel):
    """Schema returned from all Team endpoints"""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    hometown: Optional[str] = None
    daily_wage: float
    car_rent: float
    manager_fee: float
    is_active: bool
    status: str  # "active" | "inactive"
    member_count: int
    members: list[LabourRead]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# List / Summary (lightweight — no members list)
# ---------------------------------------------------------------------------

class TeamSummary(BaseModel):
    """Lightweight summary for list endpoints"""
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    hometown: Optional[str] = None
    daily_wage: float
    car_rent: float
    manager_fee: float
    is_active: bool
    status: str
    member_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedTeams(BaseModel):
    items: list[TeamSummary]
    total: int
    page: int
    page_size: int
    has_more: bool
