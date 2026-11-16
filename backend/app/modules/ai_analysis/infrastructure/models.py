"""V2 AI analysis reports (test / session / progress / group)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.enums import AiReportType, ai_report_type_enum

if TYPE_CHECKING:
    from app.modules.test_sessions.infrastructure.models import (
        SessionPlayer,
        TrainingSession,
    )


class AiReport(Base):
    """Stores structured AI output in `report_data` (JSONB)."""

    __tablename__ = "ai_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    report_type: Mapped[AiReportType] = mapped_column(
        ai_report_type_enum,
        nullable=False,
    )
    session_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_players.id", ondelete="CASCADE"),
        nullable=True,
    )
    training_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training_sessions.id", ondelete="CASCADE"),
        nullable=True,
    )
    report_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    model_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session_player: Mapped[SessionPlayer | None] = relationship(
        "SessionPlayer",
        back_populates="ai_reports",
    )
    training_session: Mapped[TrainingSession | None] = relationship(
        "TrainingSession",
        back_populates="ai_reports",
    )
