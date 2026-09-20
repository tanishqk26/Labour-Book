"""add_plot_operation_photos

Creates plot_operation_photos table.
Metadata-only — binary data stored in Supabase Storage.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-20 20:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plot_operation_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "operation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plot_operations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("caption",    sa.Text,    nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_plot_operation_photos_owner_id",    "plot_operation_photos", ["owner_id"])
    op.create_index("ix_plot_operation_photos_operation_id","plot_operation_photos", ["operation_id"])
    op.create_unique_constraint("uq_plot_operation_photo_path", "plot_operation_photos", ["storage_path"])


def downgrade() -> None:
    op.drop_table("plot_operation_photos")
