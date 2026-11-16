"""Reference seed data for V2 (roles, permissions, positions, cognitive tests).

Call from a dedicated seed command or migration after schema exists.
Does not connect to production automatically.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RoleSeed:
    name: str
    description: str


@dataclass(frozen=True)
class PermissionSeed:
    code: str
    description: str


@dataclass(frozen=True)
class PositionSeed:
    code: str
    name: str
    display_order: int


@dataclass(frozen=True)
class CognitiveTestSeed:
    slug: str
    name: str
    description: str
    category: str
    configuration: dict[str, Any]


# Staff roles only — no player login role.
ROLE_SEEDS: tuple[RoleSeed, ...] = (
    RoleSeed("admin", "Full platform administration"),
    RoleSeed("coach", "Create and manage training sessions"),
    RoleSeed("staff", "Operational support without full admin rights"),
)

PERMISSION_SEEDS: tuple[PermissionSeed, ...] = (
    PermissionSeed("users.manage", "Create and manage staff users"),
    PermissionSeed("players.manage", "Create and manage players (legacy aggregate)"),
    PermissionSeed("players.read", "View player profiles and position catalog"),
    PermissionSeed("players.create", "Create players and issue access codes"),
    PermissionSeed("players.update", "Update player profiles and rotate access codes"),
    PermissionSeed("players.deactivate", "Activate or deactivate players"),
    PermissionSeed("players.notes.manage", "Create and manage player notes"),
    PermissionSeed("players.import", "Import players from Excel"),
    PermissionSeed("teams.read", "View teams within authorization scope"),
    PermissionSeed("teams.create", "Create teams"),
    PermissionSeed("teams.update", "Update team information"),
    PermissionSeed("teams.deactivate", "Activate or deactivate teams"),
    PermissionSeed("teams.staff.manage", "Assign and remove team staff"),
    PermissionSeed("teams.players.read", "View players on accessible teams"),
    PermissionSeed("teams.players.manage", "Assign and remove team players"),
    PermissionSeed("sessions.manage", "Create and manage training sessions"),
    PermissionSeed("sessions.view", "View training sessions and results"),
    PermissionSeed("results.view", "View test results"),
    PermissionSeed("ai.generate", "Generate AI analysis reports"),
)

PLAYER_PERMISSION_CODES: tuple[str, ...] = (
    "players.manage",
    "players.read",
    "players.create",
    "players.update",
    "players.deactivate",
    "players.notes.manage",
    "players.import",
)

TEAM_PERMISSION_CODES_COACH: tuple[str, ...] = (
    "teams.read",
    "teams.players.read",
    "teams.players.manage",
)

TEAM_PERMISSION_CODES_STAFF: tuple[str, ...] = (
    "teams.read",
    "teams.players.read",
)

# Suggested football positions (GK … ST).
POSITION_SEEDS: tuple[PositionSeed, ...] = (
    PositionSeed("GK", "Goalkeeper", 1),
    PositionSeed("CB", "Centre Back", 2),
    PositionSeed("LB", "Left Back", 3),
    PositionSeed("RB", "Right Back", 4),
    PositionSeed("CDM", "Defensive Midfielder", 5),
    PositionSeed("CM", "Central Midfielder", 6),
    PositionSeed("CAM", "Attacking Midfielder", 7),
    PositionSeed("LW", "Left Winger", 8),
    PositionSeed("RW", "Right Winger", 9),
    PositionSeed("ST", "Striker", 10),
)

# Exact slugs/names/descriptions verified from frontend/lib/tests/registry.ts
# (functional reference only — V2 stores them as independent catalog rows).
COGNITIVE_TEST_SEEDS: tuple[CognitiveTestSeed, ...] = (
    CognitiveTestSeed(
        slug="visual-tracking",
        name="Suivi de numéros",
        description="Suis le numéro cible pendant que 30 chiffres bougent sur le terrain.",
        category="tracking",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="visual-memory",
        name="Mémoire visuelle",
        description="Mémorise 5 cases allumées sur une grille 5 × 5, puis retrouve-les.",
        category="memory",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="reaction-time",
        name="Temps de réaction",
        description="Touche la cible dès qu'elle apparaît, 10 fois.",
        category="reaction",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="peripheral-vision",
        name="Vision périphérique",
        description="Garde les yeux au centre et indique de quel côté la cible flash.",
        category="vision",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="football-visual-scanning",
        name="Lecture du jeu",
        description=(
            "Sur des actions réelles, repère le joueur proche du ballon, "
            "le défenseur et le joueur libre."
        ),
        category="scanning",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="sequential-visual-search",
        name="Recherche Visuelle Séquentielle",
        description="Retrouvez les nombres dans l'ordre, de 1 à 50.",
        category="search",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="digit-memory",
        name="Mémoire numérique séquentielle",
        description="Mémorise une suite de chiffres, puis réécris-la dans l'ordre.",
        category="memory",
        configuration={},
    ),
    CognitiveTestSeed(
        slug="dual-target-tracking",
        name="Suivi de deux cibles mobiles",
        description="Retiens deux cibles, suis-les parmi les autres, puis désigne-les.",
        category="tracking",
        configuration={},
    ),
)

# Default role → permission mapping (no player role).
ROLE_PERMISSION_MAP: dict[str, tuple[str, ...]] = {
    "admin": tuple(p.code for p in PERMISSION_SEEDS),
    "coach": (
        *PLAYER_PERMISSION_CODES,
        *TEAM_PERMISSION_CODES_COACH,
        "sessions.manage",
        "sessions.view",
        "results.view",
        "ai.generate",
    ),
    "staff": (
        "players.read",
        *TEAM_PERMISSION_CODES_STAFF,
        "sessions.view",
        "results.view",
    ),
}
