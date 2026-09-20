"""add_farm_operations_foundation

Creates three tables for the Farm Operations module:

  farm_years         — one row per owner per calendar year (Apr-Mar season)
  plot_farm_years    — enrolls a plot in a farm year with per-plot crop data
  plot_lifecycles    — concrete lifecycle stage date ranges per plot-season

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-20 20:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. farm_years
    # -------------------------------------------------------------------------
    op.create_table(
        "farm_years",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer, nullable=False,
                  comment="April-start calendar year, e.g. 2026 for season 2026-27"),
        sa.Column("start_date", sa.Date, nullable=False,
                  comment="Always April 1 of `year`"),
        sa.Column("end_date", sa.Date, nullable=False,
                  comment="Always March 31 of `year + 1`"),
        sa.Column("transition_date", sa.Date, nullable=True,
                  comment="Configurable Vegetative → Fruit Production boundary; NULL = Oct 1 default"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_farm_years_owner_id", "farm_years", ["owner_id"])
    op.create_unique_constraint(
        "uq_farm_year_owner_year", "farm_years", ["owner_id", "year"]
    )

    # -------------------------------------------------------------------------
    # 2. plot_farm_years
    # -------------------------------------------------------------------------
    op.create_table(
        "plot_farm_years",
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
            "farm_year_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("farm_years.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("crop_name", sa.String(100), nullable=True),
        sa.Column("variety",   sa.String(100), nullable=True),
        sa.Column("acreage",   sa.Numeric(8, 2), nullable=True),
        sa.Column("notes",     sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_plot_farm_years_owner_id",    "plot_farm_years", ["owner_id"])
    op.create_index("ix_plot_farm_years_plot_id",     "plot_farm_years", ["plot_id"])
    op.create_index("ix_plot_farm_years_farm_year_id","plot_farm_years", ["farm_year_id"])
    op.create_unique_constraint(
        "uq_plot_farm_year", "plot_farm_years", ["plot_id", "farm_year_id"]
    )

    # -------------------------------------------------------------------------
    # 3. plot_lifecycles
    # -------------------------------------------------------------------------
    op.create_table(
        "plot_lifecycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plot_farm_year_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plot_farm_years.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("lifecycle_type", sa.String(30), nullable=False,
                  comment="vegetative | fruit_production"),
        sa.Column("name",       sa.String(100), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date",   sa.Date, nullable=True,
                  comment="NULL = stage ongoing / end date not yet determined"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_plot_lifecycles_owner_id",         "plot_lifecycles", ["owner_id"])
    op.create_index("ix_plot_lifecycles_plot_farm_year_id","plot_lifecycles", ["plot_farm_year_id"])


def downgrade() -> None:
    op.drop_table("plot_lifecycles")
    op.drop_table("plot_farm_years")
    op.drop_table("farm_years")
