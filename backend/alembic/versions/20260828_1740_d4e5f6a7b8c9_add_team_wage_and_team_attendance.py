"""add team wage fields and team attendance support

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-28 17:40:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Team: add wage fields ---
    op.add_column("teams", sa.Column("daily_wage", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("teams", sa.Column("car_rent", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("teams", sa.Column("manager_fee", sa.Numeric(10, 2), nullable=False, server_default="0"))

    # --- Attendance: make labour_id nullable, add team_id + num_labourers ---
    op.alter_column("attendances", "labour_id", existing_type=postgresql.UUID(), nullable=True)
    op.add_column("attendances", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("attendances", sa.Column("num_labourers", sa.Integer(), nullable=True))

    op.create_index("ix_attendances_team_id", "attendances", ["team_id"])
    op.create_foreign_key(
        "fk_attendances_team_id",
        "attendances",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_attendance_team_date", "attendances", ["team_id", "date"])


def downgrade() -> None:
    op.drop_constraint("uq_attendance_team_date", "attendances")
    op.drop_constraint("fk_attendances_team_id", "attendances")
    op.drop_index("ix_attendances_team_id", "attendances")
    op.drop_column("attendances", "num_labourers")
    op.drop_column("attendances", "team_id")
    op.alter_column("attendances", "labour_id", existing_type=postgresql.UUID(), nullable=False)
    op.drop_column("teams", "manager_fee")
    op.drop_column("teams", "car_rent")
    op.drop_column("teams", "daily_wage")
