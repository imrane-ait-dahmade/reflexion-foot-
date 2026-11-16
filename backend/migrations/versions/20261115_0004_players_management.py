"""Players management: profile fields, secondary positions, notes.

Revision ID: 20261115_0004
Revises: 20261115_0003
Create Date: 2026-11-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261115_0004"
down_revision: Union[str, Sequence[str], None] = "20261115_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- players profile reshape ---
    op.add_column("players", sa.Column("first_name", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("last_name", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE players
        SET
          first_name = CASE
            WHEN position(' ' in trim(full_name)) > 0
              THEN split_part(trim(full_name), ' ', 1)
            ELSE trim(full_name)
          END,
          last_name = CASE
            WHEN position(' ' in trim(full_name)) > 0
              THEN trim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1))
            ELSE trim(full_name)
          END
        WHERE first_name IS NULL
        """
    )
    op.alter_column("players", "first_name", nullable=False)
    op.alter_column("players", "last_name", nullable=False)
    op.drop_column("players", "full_name")

    op.add_column("players", sa.Column("nationality", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("gender", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("email", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("phone", sa.Text(), nullable=True))
    op.add_column("players", sa.Column("jersey_number", sa.Integer(), nullable=True))
    op.add_column(
        "players",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Rename position_id → primary_position_id and enforce NOT NULL when possible.
    op.alter_column("players", "position_id", new_column_name="primary_position_id")
    # If any nulls remain, assign first active position as a safe backfill.
    op.execute(
        """
        UPDATE players
        SET primary_position_id = (
          SELECT id FROM positions WHERE is_active = true ORDER BY display_order LIMIT 1
        )
        WHERE primary_position_id IS NULL
        """
    )
    op.drop_constraint("players_position_id_fkey", "players", type_="foreignkey")
    op.create_foreign_key(
        "players_primary_position_id_fkey",
        "players",
        "positions",
        ["primary_position_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.alter_column("players", "primary_position_id", nullable=False)

    op.create_check_constraint(
        "players_jersey_number_range",
        "players",
        "jersey_number IS NULL OR (jersey_number >= 1 AND jersey_number <= 99)",
    )
    op.create_check_constraint(
        "players_gender_values",
        "players",
        "gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')",
    )

    # --- secondary positions ---
    op.create_table(
        "player_secondary_positions",
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint(
            "player_id",
            "position_id",
            name="player_secondary_positions_pk",
        ),
    )

    # --- staff notes ---
    op.create_table(
        "player_notes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(content)) >= 1",
            name="player_notes_content_not_blank",
        ),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_player_notes_player_id",
        "player_notes",
        ["player_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_player_notes_player_id", table_name="player_notes")
    op.drop_table("player_notes")
    op.drop_table("player_secondary_positions")

    op.drop_constraint("players_gender_values", "players", type_="check")
    op.drop_constraint("players_jersey_number_range", "players", type_="check")
    op.drop_constraint("players_primary_position_id_fkey", "players", type_="foreignkey")
    op.alter_column("players", "primary_position_id", new_column_name="position_id")
    op.alter_column("players", "position_id", nullable=True)
    op.create_foreign_key(
        "players_position_id_fkey",
        "players",
        "positions",
        ["position_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_column("players", "is_active")
    op.drop_column("players", "jersey_number")
    op.drop_column("players", "phone")
    op.drop_column("players", "email")
    op.drop_column("players", "gender")
    op.drop_column("players", "nationality")

    op.add_column("players", sa.Column("full_name", sa.Text(), nullable=True))
    op.execute(
        "UPDATE players SET full_name = trim(first_name || ' ' || last_name)"
    )
    op.alter_column("players", "full_name", nullable=False)
    op.drop_column("players", "last_name")
    op.drop_column("players", "first_name")
