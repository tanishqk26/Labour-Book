"""unify operation categories + move default stage boundary to Sep 1

Revision ID: a7b8c9d0e1f2
Revises: 218f20047b48
Create Date: 2026-11-09 10:00:00.000000+00:00

Data-only migration:
  1. Operation categories become the canonical four used by web, mobile and
     voice entry:  Spraying | Fertigation | Labour Work | Other.
  2. Farm years that use the default transition (transition_date IS NULL) now
     switch to Fruit production on Sep 1 (was Oct 1), so existing operations
     dated Sep 1 or later that sit in the Vegetative stage are moved to the
     Fruit-production stage of the same plot/season.
  3. Stage start/end dates are recomputed from the operations they contain.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "218f20047b48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Categories
    for old, new in (
        ("spraying", "Spraying"),
        ("fertigation", "Fertigation"),
        ("labour_work", "Labour Work"),
        ("other", "Other"),
    ):
        op.execute(
            f"UPDATE plot_operations SET operation_type = '{new}' WHERE operation_type = '{old}'"
        )

    # 2. Re-bucket Sep operations: vegetative -> fruit_production
    op.execute(
        """
        UPDATE plot_operations po
           SET plot_lifecycle_id = fruit.id
          FROM plot_lifecycles veg
          JOIN plot_farm_years pfy ON pfy.id = veg.plot_farm_year_id
          JOIN farm_years fy       ON fy.id  = pfy.farm_year_id
          JOIN plot_lifecycles fruit
            ON fruit.plot_farm_year_id = pfy.id AND fruit.lifecycle_type = 'fruit_production'
         WHERE po.plot_lifecycle_id = veg.id
           AND veg.lifecycle_type = 'vegetative'
           AND fy.transition_date IS NULL
           AND po.operation_date >= make_date(fy.year, 9, 1)
        """
    )

    # 3. Recompute stage bounds from the operations they now contain
    op.execute(
        """
        UPDATE plot_lifecycles lc
           SET start_date = agg.mn,
               end_date   = CASE WHEN agg.mx IS NOT NULL AND agg.mx <> agg.mn THEN agg.mx END
          FROM (
                SELECT l.id AS id, MIN(o.operation_date) AS mn, MAX(o.operation_date) AS mx
                  FROM plot_lifecycles l
                  LEFT JOIN plot_operations o ON o.plot_lifecycle_id = l.id
                 GROUP BY l.id
               ) agg
         WHERE lc.id = agg.id
        """
    )


def downgrade() -> None:
    # Categories only (re-bucketing is not reversible without history)
    for new, old in (
        ("Spraying", "spraying"),
        ("Fertigation", "fertigation"),
        ("Labour Work", "labour_work"),
        ("Other", "other"),
    ):
        op.execute(
            f"UPDATE plot_operations SET operation_type = '{old}' WHERE operation_type = '{new}'"
        )
