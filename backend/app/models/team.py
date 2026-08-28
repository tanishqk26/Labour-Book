"""
Team ORM Model

Represents a named group of labourers (externally managed teams).
Uses classic column definitions for Python 3.14 compatibility.

Wage model (2026-08-28):
  - daily_wage: per-labourer per-day rate
  - car_rent:   fixed daily transport cost
  - manager_fee: fixed daily manager cost
  Total = num_labourers * daily_wage + car_rent + manager_fee
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Numeric, String, Table, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Association table â€” many-to-many: teams â†” labours
# ---------------------------------------------------------------------------

team_labours = Table(
    "team_labours",
    Base.metadata,
    Column(
        "team_id",
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "labour_id",
        UUID(as_uuid=True),
        ForeignKey("labours.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(255), nullable=True)

    # Wage fields (2026-08-28)
    daily_wage = Column(Numeric(10, 2), nullable=False, default=0)
    car_rent   = Column(Numeric(10, 2), nullable=False, default=0)
    manager_fee = Column(Numeric(10, 2), nullable=False, default=0)

    # Status â€” active / inactive (soft-delete pattern, mirrors Labour)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    members = relationship(
        "Labour",
        secondary=team_labours,
        backref="teams",
        lazy="selectin",
    )
    attendances = relationship(
        "Attendance",
        back_populates="team",
        cascade="all, delete-orphan",
        foreign_keys="[Attendance.team_id]",
    )

    def __repr__(self) -> str:
        return f"<Team id={self.id} name={self.name!r}>"

