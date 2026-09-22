"""
PlotOperation Pydantic Schemas

Request/response validation for plot operation CRUD endpoints.
"""

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class PlotOperationCreate(BaseModel):
    plot_id: uuid.UUID
    plot_lifecycle_id: Optional[uuid.UUID] = None
    operation_date: date
    operation_type: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def strip_operation_type(self) -> "PlotOperationCreate":
        self.operation_type = self.operation_type.strip()
        if not self.operation_type:
            raise ValueError("operation_type is required")
        return self


# ---------------------------------------------------------------------------
# Update (PATCH — all optional)
# ---------------------------------------------------------------------------

class PlotOperationUpdate(BaseModel):
    operation_date: Optional[date] = None
    operation_type: Optional[str] = None
    notes: Optional[str] = None
    plot_lifecycle_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def strip_operation_type(self) -> "PlotOperationUpdate":
        if self.operation_type is not None:
            self.operation_type = self.operation_type.strip()
            if not self.operation_type:
                raise ValueError("operation_type cannot be empty")
        return self


# ---------------------------------------------------------------------------
# Nested — lifecycle summary shown inside an operation read
# ---------------------------------------------------------------------------

class LifecycleSummary(BaseModel):
    id: uuid.UUID
    lifecycle_type: str
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class PlotOperationRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    plot_id: uuid.UUID
    plot_lifecycle_id: Optional[uuid.UUID] = None
    lifecycle: Optional[LifecycleSummary] = None
    operation_date: date
    operation_type: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "PlotOperationRead":
        lc = None
        if obj.lifecycle is not None:
            lc = LifecycleSummary(
                id=obj.lifecycle.id,
                lifecycle_type=obj.lifecycle.lifecycle_type,
                name=obj.lifecycle.name,
                start_date=obj.lifecycle.start_date,
                end_date=obj.lifecycle.end_date,
            )
        return cls(
            id=obj.id,
            owner_id=obj.owner_id,
            plot_id=obj.plot_id,
            plot_lifecycle_id=obj.plot_lifecycle_id,
            lifecycle=lc,
            operation_date=obj.operation_date,
            operation_type=obj.operation_type,
            notes=obj.notes,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedPlotOperations(BaseModel):
    items: list[PlotOperationRead]
    total: int
    page: int
    page_size: int
    has_more: bool
