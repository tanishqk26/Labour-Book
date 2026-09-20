"""
FarmYear Pydantic Schemas

Request/response validation for FarmYear CRUD endpoints.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, Field, model_validator

# Avoid circular import — PlotFarmYearRead is defined in plot_farm_year.py
if TYPE_CHECKING:
    from app.schemas.plot_farm_year import PlotFarmYearRead


def _effective_transition(year: int, transition_date: Optional[date]) -> date:
    """Return the real transition date, defaulting to October 1 of `year`."""
    return transition_date if transition_date is not None else date(year, 10, 1)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class FarmYearCreate(BaseModel):
    year: int = Field(..., ge=2000, le=2100, description="April-start calendar year, e.g. 2026 for season 2026-27")
    transition_date: Optional[date] = Field(
        None, description="Stage boundary — NULL defaults to Oct 1 of year"
    )
    # start_date / end_date are always April 1 / March 31 — computed server-side,
    # but can be sent explicitly (validated against year).
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_and_fill_dates(self) -> "FarmYearCreate":
        expected_start = date(self.year, 4, 1)
        expected_end   = date(self.year + 1, 3, 31)

        if self.start_date and self.start_date != expected_start:
            raise ValueError(f"start_date must be {expected_start} for year {self.year}")
        if self.end_date and self.end_date != expected_end:
            raise ValueError(f"end_date must be {expected_end} for year {self.year}")

        # Fill in canonical dates so the router can use them directly
        self.start_date = expected_start
        self.end_date   = expected_end

        if self.transition_date is not None:
            if not (expected_start < self.transition_date < expected_end):
                raise ValueError(f"transition_date must fall within ({expected_start}, {expected_end})")
        return self


# ---------------------------------------------------------------------------
# Update (PATCH — only transition_date is mutable)
# ---------------------------------------------------------------------------

class FarmYearUpdate(BaseModel):
    transition_date: Optional[date] = Field(
        None, description="Pass null to clear (revert to Oct 1 default)"
    )
    # year / start_date / end_date are immutable after creation


# ---------------------------------------------------------------------------
# Read (response) — list-level, no nested plots
# ---------------------------------------------------------------------------

class FarmYearRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    year: int
    start_date: date
    end_date: date
    transition_date: Optional[date] = None
    effective_transition_date: date      # Oct 1 of year when transition_date is NULL
    plot_count: int = 0                  # number of plots enrolled this season
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj, plot_count: int = 0) -> "FarmYearRead":
        return cls(
            id=obj.id,
            owner_id=obj.owner_id,
            year=obj.year,
            start_date=obj.start_date,
            end_date=obj.end_date,
            transition_date=obj.transition_date,
            effective_transition_date=_effective_transition(obj.year, obj.transition_date),
            plot_count=plot_count,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# ---------------------------------------------------------------------------
# Detail Read — single-farm-year endpoint includes enrolled plots
# ---------------------------------------------------------------------------

# Forward-declared as list to avoid circular import at class definition time.
# The from_orm_obj factory handles serialisation.
class FarmYearDetailRead(FarmYearRead):
    """Extends FarmYearRead with the full list of enrolled plots + lifecycles."""
    plot_farm_years: list = []

    @classmethod
    def from_orm_obj(cls, obj) -> "FarmYearDetailRead":  # type: ignore[override]
        from app.schemas.plot_farm_year import PlotFarmYearRead as PFYRead
        pfys = [PFYRead.from_orm_obj(p) for p in (obj.plot_farm_years or [])]
        base = FarmYearRead.from_orm_obj(obj, plot_count=len(pfys))
        return cls(**base.model_dump(), plot_farm_years=[p.model_dump() for p in pfys])


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedFarmYears(BaseModel):
    items: list[FarmYearRead]
    total: int
    page: int
    page_size: int
    has_more: bool
