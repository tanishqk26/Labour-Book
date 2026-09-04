"""
Plot ORM Model

Represents a farm plot/field. Used to associate contracts with a physical
plot so the total contract price can be derived as (rate × plot_size_acres).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Plot(Base):
    __tablename__ = "plots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic info
    name = Column(String(100), nullable=False, index=True)
    size_acres = Column(Numeric(8, 2), nullable=False)          # e.g. 2.5 acres
    crop_name = Column(String(100), nullable=True)              # e.g. "Grapes"
    notes = Column(Text, nullable=True)                         # free-form notes

    # Soft-delete
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Plot id={self.id} name={self.name!r} size={self.size_acres} acres>"
