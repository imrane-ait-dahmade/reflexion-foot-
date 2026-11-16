"""V2 cognitive test catalog and per-session exercise assignments."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base

if TYPE_CHECKING:
    from app.modules.results.infrastructure.models import TestAttempt
    from app.modules.test_sessions.infrastructure.models import TrainingSession


class CognitiveTest(Base):
    __tablename__ = "cognitive_tests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )
    configuration: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session_exercises: Mapped[list[SessionExercise]] = relationship(
        "SessionExercise",
        back_populates="cognitive_test",
    )


class SessionExercise(Base):
    __tablename__ = "session_exercises"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "cognitive_test_id",
            name="session_exercises_session_test_uidx",
        ),
        UniqueConstraint(
            "session_id",
            "display_order",
            name="session_exercises_session_order_uidx",
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
    cognitive_test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cognitive_tests.id", ondelete="RESTRICT"),
        nullable=False,
    )
    configuration: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session: Mapped[TrainingSession] = relationship(
        "TrainingSession",
        back_populates="exercises",
    )
    cognitive_test: Mapped[CognitiveTest] = relationship(
        "CognitiveTest",
        back_populates="session_exercises",
    )
    attempts: Mapped[list[TestAttempt]] = relationship(
        "TestAttempt",
        back_populates="session_exercise",
    )
