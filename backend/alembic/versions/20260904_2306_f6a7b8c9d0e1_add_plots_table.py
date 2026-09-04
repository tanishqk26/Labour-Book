"""add plots table and plot_id to contracts

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-04 23:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create plots table
    op.create_table(
        "plots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, index=True),
        sa.Column("size_acres", sa.Numeric(8, 2), nullable=False),
        sa.Column("crop_name", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # 2. Add plot_id and amount_per_acre to contracts
    op.add_column("contracts", sa.Column(
        "plot_id",
        postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    op.add_column("contracts", sa.Column(
        "amount_per_acre",
        sa.Numeric(12, 2),
        nullable=True,
        comment="Rate per acre. If set, final amount = amount_per_acre * plot.size_acres",
    ))
    op.create_foreign_key(
        "fk_contracts_plot_id",
        "contracts", "plots",
        ["plot_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_contracts_plot_id", "contracts", type_="foreignkey")
    op.drop_column("contracts", "amount_per_acre")
    op.drop_column("contracts", "plot_id")
    op.drop_table("plots")
