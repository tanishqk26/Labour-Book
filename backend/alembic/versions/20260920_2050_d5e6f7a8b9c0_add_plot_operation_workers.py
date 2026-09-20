"""add_plot_operation_workers

Creates plot_operation_workers — associates labour/team with an operation.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-20 20:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plot_operation_workers",
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
        sa.Column(
            "labour_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("labours.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("hours_worked", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),

        # XOR constraint
        sa.CheckConstraint(
            "(labour_id IS NOT NULL AND team_id IS NULL) OR "
            "(labour_id IS NULL AND team_id IS NOT NULL)",
            name="chk_operation_worker_xor",
        ),
    )

    op.create_index("ix_plot_operation_workers_owner_id",    "plot_operation_workers", ["owner_id"])
    op.create_index("ix_plot_operation_workers_operation_id","plot_operation_workers", ["operation_id"])
    op.create_index("ix_plot_operation_workers_labour_id",   "plot_operation_workers", ["labour_id"])
    op.create_index("ix_plot_operation_workers_team_id",     "plot_operation_workers", ["team_id"])

    # No duplicate worker per operation
    op.create_unique_constraint(
        "uq_op_worker_labour", "plot_operation_workers", ["operation_id", "labour_id"]
    )
    op.create_unique_constraint(
        "uq_op_worker_team", "plot_operation_workers", ["operation_id", "team_id"]
    )


def downgrade() -> None:
    op.drop_table("plot_operation_workers")
