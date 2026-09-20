"""
PlotOperationPhoto ORM Model

Stores metadata only — binary data lives in Supabase Storage.
Each photo record points to a PlotOperation and carries:
  · storage_path  — path within the Supabase bucket
  · public_url    — derived property (not persisted)
  · caption       — optional human-readable label
  · sort_order    — for frontend ordering (0-based)

Hard limit: MAX_PHOTOS_PER_OPERATION = 5 (enforced in the router).
"""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base

MAX_PHOTOS_PER_OPERATION = 5


class PlotOperationPhoto(Base):
    __tablename__ = "plot_operation_photos"

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

    # Path within the Supabase bucket — unique so duplicate uploads are caught
    storage_path = Column(String(500), nullable=False, unique=True)

    caption    = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship back to operation
    operation = relationship("PlotOperation", foreign_keys=[operation_id])

    def __repr__(self) -> str:
        return f"<PlotOperationPhoto id={self.id} path={self.storage_path!r}>"
