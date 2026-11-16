"""V2 PostgreSQL enums for Cognitif Connexion Foot.

Independent of the V1 Drizzle schema. Enum types are created by Alembic
(`20261115_0001` / remaps in later revisions). ORM uses `create_type=False`
so the app never races Alembic on type creation.
"""

from enum import StrEnum

from sqlalchemy.dialects.postgresql import ENUM


class PreferredFoot(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class SessionStatus(StrEnum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SessionPlayerStatus(StrEnum):
    JOINED = "joined"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    WITHDRAWN = "withdrawn"


class AttemptStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class AiReportType(StrEnum):
    TEST = "test"
    SESSION = "session"
    PROGRESS = "progress"
    GROUP = "group"


def _pg_enum(enum_cls: type[StrEnum], name: str) -> ENUM:
    return ENUM(
        *[member.value for member in enum_cls],
        name=name,
        create_type=False,
    )


preferred_foot_enum = _pg_enum(PreferredFoot, "preferred_foot")
session_status_enum = _pg_enum(SessionStatus, "session_status")
session_player_status_enum = _pg_enum(SessionPlayerStatus, "session_player_status")
attempt_status_enum = _pg_enum(AttemptStatus, "attempt_status")
ai_report_type_enum = _pg_enum(AiReportType, "ai_report_type")
