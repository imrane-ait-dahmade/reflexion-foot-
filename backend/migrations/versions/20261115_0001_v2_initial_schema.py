"""V2 initial schema (dedicated empty database only).

Revision ID: 20261115_0001
Revises:
Create Date: 2026-11-15

Never run this against the V1 Drizzle / Better Auth Neon database.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.models import import_all_models

# revision identifiers, used by Alembic.
revision: str = "20261115_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import_all_models()
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    import_all_models()
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
