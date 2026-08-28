"""
Labour ORM Model

Represents an individual farm labourer.
Uses classic column definitions for Python 3.14 compatibility.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Labour(Base):
    __tablename__ = "labours"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, index=True)
    hometown = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    aadhaar = Column(String(20), nullable=True)

    # Daily wage in INR (stored as numeric for accuracy)
    daily_wage = Column(Numeric(10, 2), nullable=False)

    # Work timing — stored as "HH:MM" strings
    work_start_time = Column(String(5), nullable=True)
    work_end_time = Column(String(5), nullable=True)

    # Status — active / inactive (soft-delete pattern)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    attendances = relationship(
        "Attendance",
        back_populates="labour",
        cascade="all, delete-orphan",
        foreign_keys="[Attendance.labour_id]",
    )

    def __repr__(self) -> str:
        return f"<Labour id={self.id} name={self.name!r}>"
