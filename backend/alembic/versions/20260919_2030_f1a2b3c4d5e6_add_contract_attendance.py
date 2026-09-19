"""add_contract_attendance

Adds wage_type and contract_id columns to the attendances table to support
contract-based attendance tracking alongside daily-wage tracking.

wage_type: 'daily' (default) | 'contract'
contract_id: FK to contracts.id (nullable, ON DELETE SET NULL)

Revision ID: f1a2b3c4d5e6
Revises: e3f4a5b6c7d8
Create Date: 2026-09-19 20:30:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "attendances",
        sa.Column("wage_type", sa.String(length=20), nullable=False, server_default="daily"),
    )
    op.add_column(
        "attendances",
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_attendance_contract_id",
        "attendances",
        "contracts",
        ["contract_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_attendance_contract_id", "attendances", type_="foreignkey")
    op.drop_column("attendances", "contract_id")
    op.drop_column("attendances", "wage_type")
