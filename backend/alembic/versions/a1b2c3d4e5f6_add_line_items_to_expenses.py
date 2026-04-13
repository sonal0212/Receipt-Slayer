"""add line_items subtotal tax_amount to expenses

Revision ID: a1b2c3d4e5f6
Revises: 90b3b5676952
Create Date: 2026-02-28 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '90b3b5676952'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add line_items_json, subtotal, tax_amount columns."""
    op.add_column('expenses', sa.Column('line_items_json', sa.Text(), nullable=True))
    op.add_column('expenses', sa.Column('subtotal', sa.Float(), nullable=True))
    op.add_column('expenses', sa.Column('tax_amount', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove line_items_json, subtotal, tax_amount columns."""
    op.drop_column('expenses', 'tax_amount')
    op.drop_column('expenses', 'subtotal')
    op.drop_column('expenses', 'line_items_json')
