"""Register all V2 ORM models on `Base.metadata`."""

from app.modules.ai_analysis.infrastructure.models import AiReport
from app.modules.cognitive_tests.infrastructure.models import (
    CognitiveTest,
    SessionExercise,
)
from app.modules.identity.infrastructure.models import (
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.modules.players.infrastructure.models import (
    Player,
    PlayerCredential,
    PlayerNote,
    PlayerSecondaryPosition,
    Position,
)
from app.modules.results.infrastructure.models import TestAttempt, TestResult
from app.modules.teams.infrastructure.models import Team, TeamPlayer, TeamStaff
from app.modules.test_sessions.infrastructure.models import (
    SessionNameCounter,
    SessionPlayer,
    TrainingSession,
)

V2_TABLES: tuple[str, ...] = (
    "users",
    "roles",
    "permissions",
    "user_roles",
    "role_permissions",
    "refresh_tokens",
    "positions",
    "players",
    "player_secondary_positions",
    "player_credentials",
    "player_notes",
    "teams",
    "team_staff",
    "team_players",
    "training_sessions",
    "session_name_counters",
    "session_players",
    "cognitive_tests",
    "session_exercises",
    "test_attempts",
    "test_results",
    "ai_reports",
)

__all__ = [
    "V2_TABLES",
    "AiReport",
    "CognitiveTest",
    "Permission",
    "Player",
    "PlayerCredential",
    "PlayerNote",
    "PlayerSecondaryPosition",
    "Position",
    "RefreshToken",
    "Role",
    "RolePermission",
    "SessionExercise",
    "SessionNameCounter",
    "SessionPlayer",
    "Team",
    "TeamPlayer",
    "TeamStaff",
    "TestAttempt",
    "TestResult",
    "TrainingSession",
    "User",
    "UserRole",
    "import_all_models",
]


def import_all_models() -> tuple[type, ...]:
    """Return mapped model classes (side effect: metadata registration)."""
    return (
        User,
        Role,
        Permission,
        UserRole,
        RolePermission,
        RefreshToken,
        Position,
        Player,
        PlayerSecondaryPosition,
        PlayerCredential,
        PlayerNote,
        Team,
        TeamStaff,
        TeamPlayer,
        TrainingSession,
        SessionNameCounter,
        SessionPlayer,
        CognitiveTest,
        SessionExercise,
        TestAttempt,
        TestResult,
        AiReport,
    )
