"""nullable_lifecycle_start

Stage start/end dates come from operations, so they may be unset at first.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-09-21 19:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "plot_lifecycles",
        "start_date",
        existing_type=sa.Date(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "plot_lifecycles",
        "start_date",
        existing_type=sa.Date(),
        nullable=False,
    )
