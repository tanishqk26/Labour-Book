"""add owner_id to domain tables for per-user data isolation

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-10 23:30:00.000000

All existing rows (created before login existed) are assigned to the
deepakkokane27@gmail.com account, which is the account that has been
using this data all along.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ["labours", "teams", "attendances", "contracts", "payments", "plots"]
OWNER_EMAIL = "deepakkokane27@gmail.com"


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index(f"ix_{table}_owner_id", table, ["owner_id"])
        op.create_foreign_key(
            f"fk_{table}_owner_id_users",
            table,
            "users",
            ["owner_id"],
            ["id"],
            ondelete="CASCADE",
        )

    conn = op.get_bind()
    owner_row = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": OWNER_EMAIL},
    ).fetchone()

    if owner_row is not None:
        owner_id = owner_row[0]
        for table in TABLES:
            conn.execute(
                sa.text(f"UPDATE {table} SET owner_id = :owner_id WHERE owner_id IS NULL"),
                {"owner_id": owner_id},
            )

    for table in TABLES:
        op.alter_column(table, "owner_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)


def downgrade() -> None:
    for table in TABLES:
        op.drop_constraint(f"fk_{table}_owner_id_users", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_owner_id", table_name=table)
        op.drop_column(table, "owner_id")
