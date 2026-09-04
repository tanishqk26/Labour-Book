"""
Plot Pydantic Schemas

Request/response validation for Plot CRUD endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class PlotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    size_acres: float = Field(..., gt=0, description="Plot size in acres")
    crop_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Update (PATCH — all optional)
# ---------------------------------------------------------------------------

class PlotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    size_acres: Optional[float] = Field(None, gt=0)
    crop_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
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
# Read (response)
# ---------------------------------------------------------------------------

class PlotRead(BaseModel):
    id: uuid.UUID
    name: str
    size_acres: float
    crop_name: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    status: str   # "active" | "inactive"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "PlotRead":
        return cls(
            id=obj.id,
            name=obj.name,
            size_acres=float(obj.size_acres),
            crop_name=obj.crop_name,
            notes=obj.notes,
            is_active=obj.is_active,
            status="active" if obj.is_active else "inactive",
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedPlots(BaseModel):
    items: list[PlotRead]
    total: int
    page: int
    page_size: int
    has_more: bool
