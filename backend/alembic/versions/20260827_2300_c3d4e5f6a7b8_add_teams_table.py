"""add_teams_table

Adds the teams table and team_labours association table.

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-08-27 23:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create teams table
    op.create_table(
        'teams',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_teams_is_active'), 'teams', ['is_active'], unique=False)
    op.create_index(op.f('ix_teams_name'), 'teams', ['name'], unique=False)

    # Create team_labours association table
    op.create_table(
        'team_labours',
        sa.Column('team_id', sa.UUID(), nullable=False),
        sa.Column('labour_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['labour_id'], ['labours.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('team_id', 'labour_id'),
    )


def downgrade() -> None:
    op.drop_table('team_labours')
    op.drop_index(op.f('ix_teams_name'), table_name='teams')
    op.drop_index(op.f('ix_teams_is_active'), table_name='teams')
    op.drop_table('teams')
