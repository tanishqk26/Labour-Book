"""add_attendance_timing_fields

Adds work_start_time and work_end_time columns to the attendances table
so that individual attendance records can store the raw clock-in/clock-out
times for each labour on each day (separate from hours_worked which is the
computed duration).

Revision ID: b1c2d3e4f5a6
Revises: 38875410a8c0
Create Date: 2026-08-25 23:03:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '38875410a8c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add work timing columns to attendance records
    op.add_column('attendances', sa.Column('work_start_time', sa.String(length=5), nullable=True))
    op.add_column('attendances', sa.Column('work_end_time', sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column('attendances', 'work_end_time')
    op.drop_column('attendances', 'work_start_time')
