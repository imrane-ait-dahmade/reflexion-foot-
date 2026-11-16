"""V2 teams persistence: teams and staff/player memberships."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.players.infrastructure.models import Player


TEAM_ROLE_VALUES = (
    "head_coach",
    "assistant_coach",
    "analyst",
    "physiotherapist",
    "staff",
    "other",
)


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) >= 2",
            name="teams_name_min_length",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    staff_memberships: Mapped[list[TeamStaff]] = relationship(
        "TeamStaff",
        back_populates="team",
        cascade="all, delete-orphan",
    )
    player_memberships: Mapped[list[TeamPlayer]] = relationship(
        "TeamPlayer",
        back_populates="team",
        cascade="all, delete-orphan",
    )


class TeamStaff(Base):
    """Staff membership history. Global RBAC roles stay on users."""

    __tablename__ = "team_staff"
    __table_args__ = (
        CheckConstraint(
            "team_role IN ("
            "'head_coach', 'assistant_coach', 'analyst', "
            "'physiotherapist', 'staff', 'other')",
            name="team_staff_role_values",
        ),
        Index(
            "team_staff_active_uidx",
            "team_id",
            "user_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        Index("ix_team_staff_team_id", "team_id"),
        Index("ix_team_staff_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    team_role: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[Team] = relationship("Team", back_populates="staff_memberships")
    user: Mapped[User] = relationship("User")


class TeamPlayer(Base):
    """Player membership history. Leaving a team never deletes the player."""

    __tablename__ = "team_players"
    __table_args__ = (
        Index(
            "team_players_active_uidx",
            "team_id",
            "player_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        Index("ix_team_players_team_id", "team_id"),
        Index("ix_team_players_player_id", "player_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="RESTRICT"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[Team] = relationship("Team", back_populates="player_memberships")
    player: Mapped[Player] = relationship("Player")
