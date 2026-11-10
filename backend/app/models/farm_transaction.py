"""
FarmTransaction ORM Model

One ledger for money out (kind="expense") and money in (kind="income").

  · plot_id is optional: NULL means a farm-wide cost (electricity, tractor repair...).
  · amount is nullable for expenses: the farmer often does not know the price of
    something bought on credit. NULL = "price pending", shown but not counted as 0.
  · amount_paid is what has actually been paid (expense) / received (income) so
    far. amount - amount_paid is what is still owed to the shop / by the buyer.
  · party is the shop / trader / buyer name (free text, grouped case-insensitively).
"""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class FarmTransaction(Base):
    __tablename__ = "farm_transactions"
    __mapper_args__ = {"eager_defaults": True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    kind = Column(String(10), nullable=False, index=True)            # "expense" | "income"
    txn_date = Column(Date, nullable=False, index=True)
    category = Column(String(30), nullable=False)

    plot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    operation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plot_operations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    party = Column(String(120), nullable=True)
    amount = Column(Numeric(12, 2), nullable=True)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    description = Column(String(300), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    plot = relationship("Plot", foreign_keys=[plot_id])

    def __repr__(self) -> str:
        return f"<FarmTransaction {self.kind} {self.category} amount={self.amount} date={self.txn_date}>"
