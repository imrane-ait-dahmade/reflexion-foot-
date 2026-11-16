"""V2 training sessions and session player participation."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.enums import (
    SessionPlayerStatus,
    SessionStatus,
    session_player_status_enum,
    session_status_enum,
)

if TYPE_CHECKING:
    from app.modules.ai_analysis.infrastructure.models import AiReport
    from app.modules.cognitive_tests.infrastructure.models import SessionExercise
    from app.modules.identity.infrastructure.models import User
    from app.modules.players.infrastructure.models import Player
    from app.modules.results.infrastructure.models import TestAttempt
    from app.modules.teams.infrastructure.models import Team


class SessionNameCounter(Base):
    """Year-scoped sequence for auto session titles (Session #YYYY-NNN)."""

    __tablename__ = "session_name_counters"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    session_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[SessionStatus] = mapped_column(
        session_status_enum,
        nullable=False,
        server_default=text("'draft'::session_status"),
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
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
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    creator: Mapped[User] = relationship(
        "User",
        back_populates="created_sessions",
        foreign_keys=[created_by],
    )
    team: Mapped[Team | None] = relationship("Team")
    players: Mapped[list[SessionPlayer]] = relationship(
        "SessionPlayer",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    exercises: Mapped[list[SessionExercise]] = relationship(
        "SessionExercise",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    ai_reports: Mapped[list[AiReport]] = relationship(
        "AiReport",
        back_populates="training_session",
    )


class SessionPlayer(Base):
    __tablename__ = "session_players"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "player_id",
            name="session_players_session_player_uidx",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[SessionPlayerStatus] = mapped_column(
        session_player_status_enum,
        nullable=False,
        server_default=text("'joined'::session_player_status"),
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session: Mapped[TrainingSession] = relationship(
        "TrainingSession",
        back_populates="players",
    )
    player: Mapped[Player] = relationship(
        "Player",
        back_populates="session_participations",
    )
    attempts: Mapped[list[TestAttempt]] = relationship(
        "TestAttempt",
        back_populates="session_player",
        cascade="all, delete-orphan",
    )
    ai_reports: Mapped[list[AiReport]] = relationship(
        "AiReport",
        back_populates="session_player",
    )
