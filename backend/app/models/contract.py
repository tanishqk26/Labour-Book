"""
Contract ORM Model

A contract represents a fixed-price work assignment to either an individual
labourer or a labour team. The agreed amount is recorded at creation time
and never recalculated — it is independent of daily wages and attendance.

Status lifecycle: active → completed | cancelled
"""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Column, Date, DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Title / work description
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Who this is assigned to — exactly one must be set
    entity_type = Column(String(20), nullable=False)  # "individual" | "team"
    labour_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    team_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # The fixed agreed amount (INR). Never recalculated.
    amount = Column(Numeric(12, 2), nullable=False)

    # Dates
    assigned_date = Column(Date, nullable=False)
    completed_date = Column(Date, nullable=True)

    # Status
    status = Column(String(20), nullable=False, default="active")
    # "active" | "completed" | "cancelled"

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Contract id={self.id} title={self.title!r} amount={self.amount}>"
