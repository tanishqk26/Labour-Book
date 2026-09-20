"""add_plot_operations

Creates the plot_operations table for recording farm work events
(irrigation, pesticide, leaf removal, etc.) on a plot / lifecycle stage.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-09-20 20:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plot_operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plot_lifecycle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plot_lifecycles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("operation_date", sa.Date, nullable=False),
        sa.Column("operation_type", sa.String(30), nullable=False,
                  comment="irrigation|fertilizer|pesticide|fungicide|insecticide|"
                          "leaf_removal|shoot_management|weeding|bunch_management|harvest|other"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_plot_operations_owner_id",         "plot_operations", ["owner_id"])
    op.create_index("ix_plot_operations_plot_id",          "plot_operations", ["plot_id"])
    op.create_index("ix_plot_operations_plot_lifecycle_id","plot_operations", ["plot_lifecycle_id"])
    op.create_index("ix_plot_operations_operation_date",   "plot_operations", ["operation_date"])
    op.create_index("ix_plot_operations_operation_type",   "plot_operations", ["operation_type"])


def downgrade() -> None:
    op.drop_table("plot_operations")
