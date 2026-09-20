"""
FarmYear ORM Model

Represents a single grape farm year, which runs from April 1 to March 31
of the following calendar year (e.g. year=2026 covers 2026-04-01 → 2027-03-31).

transition_date is configurable per year and marks the boundary between the
two lifecycle stages:
  · Before transition_date  → Vegetative / Shoot Development
  · On or after             → Fruit Production

A farm year belongs to an owner and applies owner-wide (not per-plot).
Plot-specific data (crop, variety, acreage) lives on PlotFarmYear.
"""

import uuid

from sqlalchemy import Column, Date, DateTime, Integer, UniqueConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class FarmYear(Base):
    __tablename__ = "farm_years"

    __table_args__ = (
        # One farm year per owner per calendar year
        UniqueConstraint("owner_id", "year", name="uq_farm_year_owner_year"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Calendar year integer — the April-start year.
    # e.g. year=2026 → season 2026-27 → 2026-04-01 … 2027-03-31
    year = Column(Integer, nullable=False)

    # Explicit date boundaries stored so queries can filter without math
    start_date = Column(Date, nullable=False)   # always April 1 of `year`
    end_date   = Column(Date, nullable=False)   # always March 31 of `year + 1`

    # Configurable stage boundary.  NULL means "use default Oct 1".
    transition_date = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    plot_farm_years = relationship(
        "PlotFarmYear",
        back_populates="farm_year",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<FarmYear id={self.id} year={self.year} ({self.start_date} → {self.end_date})>"
