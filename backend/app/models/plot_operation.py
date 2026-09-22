"""
PlotOperation ORM Model

Records a single farm operation performed on a plot on a given day.
Belongs to exactly one plot and optionally one lifecycle stage.

operation_type is free text (what was done on the plot that day).
"""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


# Operation types — stored as plain strings so they can be validated in
# the schema layer without an extra database table.
OPERATION_TYPES = {
    "irrigation",
    "fertilizer",
    "pesticide",
    "fungicide",
    "insecticide",
    "leaf_removal",
    "shoot_management",
    "weeding",
    "bunch_management",
    "harvest",
    "other",
}


class PlotOperation(Base):
    __tablename__ = "plot_operations"

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
    # Optional — links to a specific lifecycle stage (vegetative / fruit_production)
    plot_lifecycle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plot_lifecycles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    operation_date = Column(Date, nullable=False, index=True)

    # Free-text description of the work done
    operation_type = Column(String(200), nullable=False, index=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    plot      = relationship("Plot",          foreign_keys=[plot_id])
    lifecycle = relationship("PlotLifecycle", foreign_keys=[plot_lifecycle_id])

    def __repr__(self) -> str:
        return (
            f"<PlotOperation id={self.id} "
            f"type={self.operation_type!r} date={self.operation_date}>"
        )
