"""
Contract Pydantic Schemas
"""

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class ContractCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    entity_type: Literal["individual", "team"]
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    # Plot association — optional
    plot_id: Optional[uuid.UUID] = None
    # If plot is selected, enter rate per acre; backend computes final amount
    amount_per_acre: Optional[float] = Field(None, gt=0)
    # Final amount — required; computed by frontend before submit
    amount: float = Field(..., gt=0, description="Final agreed amount in INR")
    assigned_date: date
    status: Literal["active", "completed", "cancelled"] = "active"

    @model_validator(mode="after")
    def check_entity(self) -> "ContractCreate":
        if self.entity_type == "individual" and self.labour_id is None:
            raise ValueError("labour_id is required when entity_type is 'individual'")
        if self.entity_type == "team" and self.team_id is None:
            raise ValueError("team_id is required when entity_type is 'team'")
        return self


# ---------------------------------------------------------------------------
# Update (PATCH — all fields optional)
# ---------------------------------------------------------------------------

class ContractUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    plot_id: Optional[uuid.UUID] = None
    amount_per_acre: Optional[float] = Field(None, gt=0)
    assigned_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: Optional[Literal["active", "completed", "cancelled"]] = None


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class PlotInfo(BaseModel):
    id: uuid.UUID
    name: str
    size_acres: float
    crop_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ContractRead(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    entity_type: str
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    entity_name: Optional[str] = None
    plot_id: Optional[uuid.UUID] = None
    plot: Optional[PlotInfo] = None
    amount_per_acre: Optional[float] = None
    amount: float
    assigned_date: date
    completed_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedContracts(BaseModel):
    items: list[ContractRead]
    total: int
    page: int
    page_size: int
    has_more: bool
