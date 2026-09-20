"""
PlotOperationWorker Pydantic Schemas
"""

import uuid
from typing import Optional
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Nested summaries (returned inside WorkerRead)
# ---------------------------------------------------------------------------

class LabourSummary(BaseModel):
    id: uuid.UUID
    name: str
    # Wage rate — used for cost estimates on operations (full-day rate only)
    daily_wage: float = 0.0
    model_config = {"from_attributes": True}


class TeamSummary(BaseModel):
    id: uuid.UUID
    name: str
    # Rate components — total requires num_labourers (not stored here)
    daily_wage: float = 0.0
    car_rent:   float = 0.0
    manager_fee: float = 0.0
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class WorkerCreate(BaseModel):
    labour_id: Optional[uuid.UUID] = None
    team_id:   Optional[uuid.UUID] = None
    hours_worked: Optional[float]  = Field(None, gt=0, le=24)

    @model_validator(mode="after")
    def validate_xor(self) -> "WorkerCreate":
        has_labour = self.labour_id is not None
        has_team   = self.team_id   is not None
        if has_labour == has_team:   # both set OR neither set
            raise ValueError("Exactly one of labour_id or team_id must be provided.")
        return self


# ---------------------------------------------------------------------------
# Update (only hours_worked is mutable)
# ---------------------------------------------------------------------------

class WorkerUpdate(BaseModel):
    hours_worked: Optional[float] = Field(None, gt=0, le=24)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

class WorkerRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    operation_id: uuid.UUID
    labour_id:    Optional[uuid.UUID] = None
    team_id:      Optional[uuid.UUID] = None
    hours_worked: Optional[float]     = None
    # Resolved name for display
    labour: Optional[LabourSummary] = None
    team:   Optional[TeamSummary]   = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "WorkerRead":
        return cls(
            id=obj.id,
            owner_id=obj.owner_id,
            operation_id=obj.operation_id,
            labour_id=obj.labour_id,
            team_id=obj.team_id,
            hours_worked=float(obj.hours_worked) if obj.hours_worked is not None else None,
            labour=LabourSummary(
                id=obj.labour.id,
                name=obj.labour.name,
                daily_wage=float(obj.labour.daily_wage),
            ) if obj.labour else None,
            team=TeamSummary(
                id=obj.team.id,
                name=obj.team.name,
                daily_wage=float(obj.team.daily_wage),
                car_rent=float(obj.team.car_rent),
                manager_fee=float(obj.team.manager_fee),
            ) if obj.team else None,
        )
