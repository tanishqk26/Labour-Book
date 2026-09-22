"""
PlotFarmYear + PlotLifecycle Pydantic Schemas

Request/response validation for plot-season enrollment and lifecycle stages.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# PlotLifecycle — nested inside PlotFarmYearRead
# ---------------------------------------------------------------------------

LIFECYCLE_TYPES = {"vegetative", "fruit_production"}

class PlotLifecycleCreate(BaseModel):
    lifecycle_type: str = Field(..., description="vegetative | fruit_production")
    name: str = Field(..., min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_lifecycle(self) -> "PlotLifecycleCreate":
        if self.lifecycle_type not in LIFECYCLE_TYPES:
            raise ValueError(f"lifecycle_type must be one of: {', '.join(sorted(LIFECYCLE_TYPES))}")
        if self.start_date is not None and self.end_date is not None and self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class PlotLifecycleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PlotLifecycleRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    plot_farm_year_id: uuid.UUID
    lifecycle_type: str
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PlotFarmYear
# ---------------------------------------------------------------------------

class PlotFarmYearCreate(BaseModel):
    plot_id: uuid.UUID
    farm_year_id: uuid.UUID
    crop_name: Optional[str] = Field(None, max_length=100)
    variety: Optional[str] = Field(None, max_length=100)
    acreage: Optional[float] = Field(None, gt=0, description="Planted area this season in acres")
    notes: Optional[str] = None


class PlotFarmYearUpdate(BaseModel):
    crop_name: Optional[str] = Field(None, max_length=100)
    variety: Optional[str] = Field(None, max_length=100)
    acreage: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class PlotFarmYearRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    plot_id: uuid.UUID
    farm_year_id: uuid.UUID
    crop_name: Optional[str] = None
    variety: Optional[str] = None
    acreage: Optional[float] = None
    notes: Optional[str] = None
    lifecycles: list[PlotLifecycleRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "PlotFarmYearRead":
        return cls(
            id=obj.id,
            owner_id=obj.owner_id,
            plot_id=obj.plot_id,
            farm_year_id=obj.farm_year_id,
            crop_name=obj.crop_name,
            variety=obj.variety,
            acreage=float(obj.acreage) if obj.acreage is not None else None,
            notes=obj.notes,
            lifecycles=[PlotLifecycleRead.model_validate(lc) for lc in obj.lifecycles],
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedPlotFarmYears(BaseModel):
    items: list[PlotFarmYearRead]
    total: int
    page: int
    page_size: int
    has_more: bool
