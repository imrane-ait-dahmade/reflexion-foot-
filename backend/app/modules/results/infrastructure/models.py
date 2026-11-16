"""V2 test attempts and results (one attempt per player per exercise)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.enums import AttemptStatus, attempt_status_enum

if TYPE_CHECKING:
    from app.modules.cognitive_tests.infrastructure.models import SessionExercise
    from app.modules.test_sessions.infrastructure.models import SessionPlayer


class TestAttempt(Base):
    __tablename__ = "test_attempts"
    __table_args__ = (
        UniqueConstraint(
            "session_player_id",
            "session_exercise_id",
            name="test_attempts_one_per_exercise_uidx",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_players.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_exercises.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[AttemptStatus] = mapped_column(
        attempt_status_enum,
        nullable=False,
        server_default=text("'in_progress'::attempt_status"),
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    session_player: Mapped[SessionPlayer] = relationship(
        "SessionPlayer",
        back_populates="attempts",
    )
    session_exercise: Mapped[SessionExercise] = relationship(
        "SessionExercise",
        back_populates="attempts",
    )
    result: Mapped[TestResult | None] = relationship(
        "TestResult",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete-orphan",
    )


class TestResult(Base):
    __tablename__ = "test_results"
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="test_results_score"),
        CheckConstraint(
            "accuracy >= 0 AND accuracy <= 100",
            name="test_results_accuracy",
        ),
        CheckConstraint("response_time_ms >= 0", name="test_results_response_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    accuracy: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    result_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    attempt: Mapped[TestAttempt] = relationship(
        "TestAttempt",
        back_populates="result",
    )
