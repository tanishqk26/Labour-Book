"""add farm_transactions (expenses / income ledger)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-10 10:00:00.000000+00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "farm_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("txn_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("plot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plot_operations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("party", sa.String(120), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("amount_paid", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_farm_transactions_owner_id", "farm_transactions", ["owner_id"])
    op.create_index("ix_farm_transactions_kind", "farm_transactions", ["kind"])
    op.create_index("ix_farm_transactions_txn_date", "farm_transactions", ["txn_date"])
    op.create_index("ix_farm_transactions_plot_id", "farm_transactions", ["plot_id"])
    op.create_index("ix_farm_transactions_operation_id", "farm_transactions", ["operation_id"])


def downgrade() -> None:
    op.drop_table("farm_transactions")
