"""Training sessions: lifecycle remap, team_id, name counters.

Revision ID: 20261115_0006
Revises: 20261115_0005
Create Date: 2026-11-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261115_0006"
down_revision: Union[str, Sequence[str], None] = "20261115_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remap session_status: draft|active|closed → draft|in_progress|completed|cancelled
    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status DROP DEFAULT"
    )
    op.execute("ALTER TABLE training_sessions ALTER COLUMN status TYPE text")
    op.execute(
        "UPDATE training_sessions SET status = 'in_progress' WHERE status = 'active'"
    )
    op.execute(
        "UPDATE training_sessions SET status = 'completed' WHERE status = 'closed'"
    )
    op.execute("DROP TYPE IF EXISTS session_status")
    op.execute(
        "CREATE TYPE session_status AS ENUM "
        "('draft', 'in_progress', 'completed', 'cancelled')"
    )
    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status "
        "TYPE session_status USING status::session_status"
    )
    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status "
        "SET DEFAULT 'draft'::session_status"
    )

    op.add_column(
        "training_sessions",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_training_sessions_team_id",
        "training_sessions",
        ["team_id"],
    )
    op.create_foreign_key(
        "training_sessions_team_id_fkey",
        "training_sessions",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "session_name_counters",
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column(
            "last_value",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.PrimaryKeyConstraint("year"),
        sa.CheckConstraint("last_value >= 0", name="session_name_counters_nonneg"),
    )


def downgrade() -> None:
    op.drop_table("session_name_counters")

    op.drop_constraint(
        "training_sessions_team_id_fkey",
        "training_sessions",
        type_="foreignkey",
    )
    op.drop_index("ix_training_sessions_team_id", table_name="training_sessions")
    op.drop_column("training_sessions", "team_id")

    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status DROP DEFAULT"
    )
    op.execute("ALTER TABLE training_sessions ALTER COLUMN status TYPE text")
    op.execute(
        "UPDATE training_sessions SET status = 'active' WHERE status = 'in_progress'"
    )
    op.execute(
        "UPDATE training_sessions SET status = 'closed' "
        "WHERE status IN ('completed', 'cancelled')"
    )
    op.execute("DROP TYPE IF EXISTS session_status")
    op.execute(
        "CREATE TYPE session_status AS ENUM ('draft', 'active', 'closed')"
    )
    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status "
        "TYPE session_status USING status::session_status"
    )
    op.execute(
        "ALTER TABLE training_sessions ALTER COLUMN status "
        "SET DEFAULT 'draft'::session_status"
    )
