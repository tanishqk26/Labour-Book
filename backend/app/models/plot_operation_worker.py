"""
PlotOperationWorker ORM Model

Associates an individual labour OR a team with a plot operation.
Records who worked on the operation and optionally how long.

Invariant (enforced in router + DB check constraint):
  labour_id XOR team_id — exactly one must be non-NULL.
"""

import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PlotOperationWorker(Base):
    __tablename__ = "plot_operation_workers"

    __table_args__ = (
        # Enforce XOR at DB level
        CheckConstraint(
            "(labour_id IS NOT NULL AND team_id IS NULL) OR "
            "(labour_id IS NULL AND team_id IS NOT NULL)",
            name="chk_operation_worker_xor",
        ),
        # No duplicate worker per operation
        UniqueConstraint("operation_id", "labour_id", name="uq_op_worker_labour"),
        UniqueConstraint("operation_id", "team_id",   name="uq_op_worker_team"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("plot_operations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    # Optional — how many hours this worker/team spent on the operation
    hours_worked = Column(Numeric(5, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    labour    = relationship("Labour",       foreign_keys=[labour_id])
    team      = relationship("Team",         foreign_keys=[team_id])
    operation = relationship("PlotOperation",foreign_keys=[operation_id])

    def __repr__(self) -> str:
        who = f"labour={self.labour_id}" if self.labour_id else f"team={self.team_id}"
        return f"<PlotOperationWorker id={self.id} {who}>"
