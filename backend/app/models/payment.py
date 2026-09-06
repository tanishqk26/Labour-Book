"""
Payment ORM Model

Records payments made to individual labourers OR teams.
Payment = actual money transferred (cash, UPI, bank transfer).

Earnings come from Attendance.wage_earned (daily work) and Contract.amount.
Pending = Total Earned - Total Paid.

For individual labourers: labour_id is set, team_id is NULL.
For teams: team_id is set, labour_id is NULL.
"""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who was paid — exactly one of these must be set
    labour_id = Column(
        UUID(as_uuid=True),
        ForeignKey("labours.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Date payment was made
    date = Column(Date, nullable=False, index=True)

    # Amount paid (INR)
    amount = Column(Numeric(12, 2), nullable=False)

    # Payment method
    method = Column(String(30), nullable=False, default="cash")
    # "cash" | "upi" | "bank_transfer" | "other"

    # Optional notes / reference
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    labour = relationship("Labour", foreign_keys=[labour_id])
    team = relationship("Team", foreign_keys=[team_id])

    def __repr__(self) -> str:
        entity = f"labour_id={self.labour_id}" if self.labour_id else f"team_id={self.team_id}"
        return f"<Payment id={self.id} {entity} amount={self.amount} date={self.date}>"
