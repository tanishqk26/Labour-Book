"""
Attendance ORM Model

Records daily attendance for individual labourers.
Uses classic column definitions for Python 3.14 compatibility.
"""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendances"

    # Unique constraint: one attendance record per labour per date
    __table_args__ = (
        UniqueConstraint("labour_id", "date", name="uq_attendance_labour_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    labour_id = Column(
        UUID(as_uuid=True),
        ForeignKey("labours.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ISO date of attendance
    date = Column(Date, nullable=False, index=True)

    # present | absent | half_day
    status = Column(String(10), nullable=False, default="present")

    # Optional task description for the day
    task = Column(String(200), nullable=True)

    # Hours worked (optional)
    hours_worked = Column(Numeric(4, 1), nullable=True)

    # Raw clock-in / clock-out times for note-keeping ("HH:MM" strings)
    work_start_time = Column(String(5), nullable=True)
    work_end_time = Column(String(5), nullable=True)

    # Computed wage for this attendance record (snapshot at time of recording)
    wage_earned = Column(Numeric(10, 2), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationship back to Labour
    labour = relationship("Labour", back_populates="attendances")

    def __repr__(self) -> str:
        return f"<Attendance id={self.id} labour_id={self.labour_id} date={self.date} status={self.status!r}>"
