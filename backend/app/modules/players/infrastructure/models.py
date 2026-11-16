"""V2 players persistence: profiles, positions, credentials, notes."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.enums import PreferredFoot, preferred_foot_enum

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.test_sessions.infrastructure.models import SessionPlayer


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    primary_players: Mapped[list[Player]] = relationship(
        "Player",
        back_populates="primary_position",
        foreign_keys="Player.primary_position_id",
    )


class Player(Base):
    """Permanent player identity (not a staff user account)."""

    __tablename__ = "players"
    __table_args__ = (
        CheckConstraint(
            "jersey_number IS NULL OR (jersey_number >= 1 AND jersey_number <= 99)",
            name="players_jersey_number_range",
        ),
        CheckConstraint(
            "gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')",
            name="players_gender_values",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    first_name: Mapped[str] = mapped_column(Text, nullable=False)
    last_name: Mapped[str] = mapped_column(Text, nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str | None] = mapped_column(Text, nullable=True)
    gender: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("positions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    preferred_foot: Mapped[PreferredFoot | None] = mapped_column(
        preferred_foot_enum,
        nullable=True,
    )
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    jersey_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    primary_position: Mapped[Position] = relationship(
        "Position",
        back_populates="primary_players",
        foreign_keys=[primary_position_id],
    )
    secondary_positions: Mapped[list[PlayerSecondaryPosition]] = relationship(
        "PlayerSecondaryPosition",
        back_populates="player",
        cascade="all, delete-orphan",
    )
    credentials: Mapped[list[PlayerCredential]] = relationship(
        "PlayerCredential",
        back_populates="player",
        cascade="all, delete-orphan",
    )
    notes: Mapped[list[PlayerNote]] = relationship(
        "PlayerNote",
        back_populates="player",
        cascade="all, delete-orphan",
    )
    session_participations: Mapped[list[SessionPlayer]] = relationship(
        "SessionPlayer",
        back_populates="player",
    )


class PlayerSecondaryPosition(Base):
    __tablename__ = "player_secondary_positions"
    __table_args__ = (
        UniqueConstraint(
            "player_id",
            "position_id",
            name="player_secondary_positions_pk",
        ),
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("positions.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    player: Mapped[Player] = relationship("Player", back_populates="secondary_positions")
    position: Mapped[Position] = relationship("Position")


class PlayerCredential(Base):
    """Hashed permanent personal access code for a player. Never store plaintext."""

    __tablename__ = "player_credentials"
    __table_args__ = (
        Index(
            "player_credentials_active_player_uidx",
            "player_id",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="CASCADE"),
        nullable=False,
    )
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    player: Mapped[Player] = relationship("Player", back_populates="credentials")


class PlayerNote(Base):
    """Internal staff remark. Not a medical/psychological diagnosis."""

    __tablename__ = "player_notes"
    __table_args__ = (
        CheckConstraint(
            "length(trim(content)) >= 1",
            name="player_notes_content_not_blank",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
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

    player: Mapped[Player] = relationship("Player", back_populates="notes")
    author: Mapped[User] = relationship("User")
