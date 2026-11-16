"""Dual Target Tracking engine — port of frontend/lib/tests/dual-target-tracking/*."""

from __future__ import annotations

from typing import Any

from app.modules.cognitive_engines.challenge_token import (
    challenge_seed,
    read_challenge,
    sign_challenge,
    unit_float,
)
from app.modules.cognitive_engines.digit_memory import calculate_accuracy

DUAL_LEVELS = (
    {"objects": 6, "durationMs": 5000, "speed": 0.12},
    {"objects": 8, "durationMs": 7000, "speed": 0.15},
    {"objects": 10, "durationMs": 8000, "speed": 0.18},
    {"objects": 12, "durationMs": 10000, "speed": 0.2},
    {"objects": 14, "durationMs": 12000, "speed": 0.22},
)
DUAL_HIGHLIGHT_MS = 2000


def dual_level(level: int) -> dict[str, Any] | None:
    if level < 1 or level > len(DUAL_LEVELS):
        return None
    return dict(DUAL_LEVELS[level - 1])


def target_pair(seed: str, level: int, secret: str) -> list[int]:
    config = dual_level(level)
    if config is None:
        raise ValueError("Niveau inconnu.")
    order = list(range(int(config["objects"])))
    for index in range(len(order) - 1, 0, -1):
        swap = int(unit_float(secret, f"{seed}:dual-targets:{level}:{index}") * (index + 1))
        order[index], order[swap] = order[swap], order[index]
    pair = sorted([order[0], order[1]])
    return pair


def grade_target_selection(targets: list[int], selected: list[int]) -> dict[str, Any]:
    if len(selected) != 2 or selected[0] == selected[1]:
        return {"error": "Sélectionne deux cibles différentes."}
    if any((not isinstance(i, int)) or i < 0 for i in selected):
        return {"error": "Sélection invalide."}
    correct = sum(1 for i in selected if i in targets)
    incorrect = sum(1 for i in selected if i not in targets)
    return {
        "correctlyIdentifiedTargets": correct,
        "missedTargets": len(targets) - correct,
        "incorrectSelections": incorrect,
        "both": correct == len(targets),
    }


def challenge_view(token: dict[str, Any], secret: str) -> dict[str, Any] | None:
    config = dual_level(int(token["level"]))
    if config is None:
        return None
    return {
        "level": int(token["level"]),
        "totalLevels": len(DUAL_LEVELS),
        "objects": config["objects"],
        "durationMs": config["durationMs"],
        "speed": config["speed"],
        "highlightIds": target_pair(str(token["seed"]), int(token["level"]), secret),
    }


def begin_dual_attempt(
    *,
    session_player_id: str,
    session_id: str,
    now_ms: int,
    secret: str,
) -> dict[str, Any]:
    token = {
        "kind": "dual-target-tracking",
        "sessionPlayerId": session_player_id,
        "sessionId": session_id,
        "seed": challenge_seed(),
        "level": 1,
        "movementReadyAt": now_ms + DUAL_HIGHLIGHT_MS,
        "correctTargets": 0,
        "missedTargets": 0,
        "incorrectSelections": 0,
        "bothCount": 0,
        "identificationTimeMs": 0,
        "movementDurationMs": 0,
        "difficultyLevelReached": 0,
        "startedAt": now_ms,
    }
    return {
        "token": sign_challenge(token, secret),
        "challenge": challenge_view(token, secret),
    }


def build_dual_result(token: dict[str, Any], now_ms: int) -> dict[str, Any]:
    target_count = len(DUAL_LEVELS) * 2
    accuracy = calculate_accuracy(int(token["correctTargets"]), int(token["missedTargets"]))
    return {
        "score": int(round(accuracy)),
        "accuracy": accuracy,
        "correct_answers": int(token["correctTargets"]),
        "errors": int(token["incorrectSelections"]),
        "duration_ms": max(1, now_ms - int(token["startedAt"])),
        "metrics": {
            "totalObjects": DUAL_LEVELS[-1]["objects"],
            "targetCount": target_count,
            "correctlyIdentifiedTargets": int(token["correctTargets"]),
            "missedTargets": int(token["missedTargets"]),
            "incorrectSelections": int(token["incorrectSelections"]),
            "completeSuccess": int(token["bothCount"]) == len(DUAL_LEVELS),
            "identificationTimeMs": int(token["identificationTimeMs"]),
            "movementDurationMs": int(token["movementDurationMs"]),
            "difficultyLevelReached": int(token["difficultyLevelReached"]),
            "completionTimeMs": max(1, now_ms - int(token["startedAt"])),
            "completionStatus": "completed",
            "scoringVersion": "dual-target-1",
        },
    }


def grade_dual_round(
    signed: str,
    selected: list[int],
    secret: str,
    now_ms: int,
) -> dict[str, Any]:
    token = read_challenge(signed, secret)
    if not token or token.get("kind") != "dual-target-tracking" or not token.get("seed"):
        return {"error": "Jeton invalide."}
    config = dual_level(int(token["level"]))
    if config is None:
        return {"error": "Niveau inconnu."}
    if now_ms + 1500 < int(token["movementReadyAt"]) + int(config["durationMs"]):
        return {"error": "Le mouvement n'est pas terminé."}
    if any(i < 0 or i >= int(config["objects"]) for i in selected):
        return {"error": "Sélection invalide."}
    targets = target_pair(str(token["seed"]), int(token["level"]), secret)
    grade = grade_target_selection(targets, selected)
    if "error" in grade:
        return grade
    identification_ms = max(
        0,
        now_ms - (int(token["movementReadyAt"]) + int(config["durationMs"])),
    )
    next_token = {
        **token,
        "correctTargets": int(token["correctTargets"]) + grade["correctlyIdentifiedTargets"],
        "missedTargets": int(token["missedTargets"]) + grade["missedTargets"],
        "incorrectSelections": int(token["incorrectSelections"]) + grade["incorrectSelections"],
        "bothCount": int(token["bothCount"]) + (1 if grade["both"] else 0),
        "identificationTimeMs": int(token["identificationTimeMs"]) + identification_ms,
        "movementDurationMs": int(token["movementDurationMs"]) + int(config["durationMs"]),
        "difficultyLevelReached": (
            max(int(token["difficultyLevelReached"]), int(token["level"]))
            if grade["both"]
            else int(token["difficultyLevelReached"])
        ),
    }
    finished = int(token["level"]) >= len(DUAL_LEVELS)
    if not finished:
        advanced = {
            **next_token,
            "level": int(token["level"]) + 1,
            "movementReadyAt": now_ms + DUAL_HIGHLIGHT_MS,
        }
        return {
            "both": grade["both"],
            "correctlyIdentifiedTargets": grade["correctlyIdentifiedTargets"],
            "finished": False,
            "token": sign_challenge(advanced, secret),
            "challenge": challenge_view(advanced, secret),
        }
    return {
        "both": grade["both"],
        "correctlyIdentifiedTargets": grade["correctlyIdentifiedTargets"],
        "finished": True,
        "sessionPlayerId": token["sessionPlayerId"],
        "result": build_dual_result(next_token, now_ms),
    }
