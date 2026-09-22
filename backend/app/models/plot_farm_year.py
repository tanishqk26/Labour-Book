"""
PlotFarmYear + PlotLifecycle ORM Models

PlotFarmYear  — joins a specific Plot to a FarmYear, carrying per-plot,
               per-season metadata (crop, variety, acreage, notes).
               UNIQUE on (plot_id, farm_year_id) prevents duplicate enrollments.

PlotLifecycle — records the concrete date ranges for each lifecycle stage
               within a PlotFarmYear.  Typically two rows per PlotFarmYear:
               · lifecycle_type = 'vegetative'        (Vegetative / Shoot Dev)
               · lifecycle_type = 'fruit_production'  (Fruit Production)
"""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PlotFarmYear(Base):
    __tablename__ = "plot_farm_years"

    __table_args__ = (
        # A plot can only be enrolled once per farm year
        UniqueConstraint("plot_id", "farm_year_id", name="uq_plot_farm_year"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    farm_year_id = Column(
        UUID(as_uuid=True),
        ForeignKey("farm_years.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Per-plot, per-season overrides / details
    crop_name = Column(String(100), nullable=True)   # e.g. "Grapes"
    variety   = Column(String(100), nullable=True)   # e.g. "Thompson Seedless"
    acreage   = Column(Numeric(8, 2), nullable=True) # actual planted area this season
    notes     = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    plot       = relationship("Plot",      foreign_keys=[plot_id])
    farm_year  = relationship("FarmYear",  back_populates="plot_farm_years", foreign_keys=[farm_year_id])
    lifecycles = relationship(
        "PlotLifecycle",
        back_populates="plot_farm_year",
        cascade="all, delete-orphan",
        order_by="PlotLifecycle.start_date",
    )

    def __repr__(self) -> str:
        return f"<PlotFarmYear id={self.id} plot_id={self.plot_id} farm_year_id={self.farm_year_id}>"


class PlotLifecycle(Base):
    __tablename__ = "plot_lifecycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plot_farm_year_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plot_farm_years.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "vegetative" | "fruit_production"
    lifecycle_type = Column(String(30), nullable=False)

    # Human-readable label — e.g. "Shoot Development", "Harvest Season"
    name = Column(String(100), nullable=False)

    start_date = Column(Date, nullable=True)   # NULL until first operation in this stage
    end_date   = Column(Date, nullable=True)   # NULL = ongoing / not yet set

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationship
    plot_farm_year = relationship("PlotFarmYear", back_populates="lifecycles", foreign_keys=[plot_farm_year_id])

    def __repr__(self) -> str:
        return f"<PlotLifecycle id={self.id} type={self.lifecycle_type!r} {self.start_date} → {self.end_date}>"
