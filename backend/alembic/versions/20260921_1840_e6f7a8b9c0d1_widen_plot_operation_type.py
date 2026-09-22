"""widen_plot_operation_type

Allow free-text operation names (was a 30-char enum).

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-09-21 18:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "plot_operations",
        "operation_type",
        existing_type=sa.String(length=30),
        type_=sa.String(length=200),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "plot_operations",
        "operation_type",
        existing_type=sa.String(length=200),
        type_=sa.String(length=30),
        existing_nullable=False,
    )
