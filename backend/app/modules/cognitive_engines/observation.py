"""Client-observed exercise result validation.

These six engines run timing / stimulus presentation in the browser.
The server cannot independently verify reaction times or what the player saw.
It validates ranges, session authorization, duplicate completion, and stamps
explicit integrity limitations on persisted result_data.
"""

from __future__ import annotations

from typing import Any

OBSERVATION_SLUGS: frozenset[str] = frozenset(
    {
        "visual-tracking",
        "visual-memory",
        "reaction-time",
        "peripheral-vision",
        "football-visual-scanning",
        "sequential-visual-search",
    }
)

INTEGRITY_NOTE = (
    "client_observed: timing and stimulus responses are reported by the player "
    "device; server validates ranges and session ownership only"
)


def validate_observation_payload(
    *,
    slug: str,
    score: int,
    accuracy: float,
    response_time_ms: int,
    correct_answers: int,
    errors: int,
    average_reaction_ms: int,
    best_reaction_ms: int,
    duration_ms: int,
    metrics: dict[str, Any] | None,
) -> dict[str, Any]:
    if slug not in OBSERVATION_SLUGS:
        raise ValueError("Unsupported observation exercise")
    if not 0 <= score <= 100:
        raise ValueError("score out of range")
    if not 0 <= accuracy <= 100:
        raise ValueError("accuracy out of range")
    if response_time_ms < 0 or duration_ms < 0:
        raise ValueError("negative duration")
    if correct_answers < 0 or errors < 0:
        raise ValueError("negative counts")
    if average_reaction_ms < 0 or best_reaction_ms < 0:
        raise ValueError("negative reaction time")
    if best_reaction_ms > 0 and average_reaction_ms > 0:
        if best_reaction_ms > average_reaction_ms * 5 + 5_000:
            raise ValueError("implausible reaction times")

    stamped = dict(metrics or {})
    stamped.setdefault("completionStatus", "completed")
    stamped["integrity"] = INTEGRITY_NOTE
    stamped["integrityMode"] = "client_observed"
    return {
        "score": score,
        "accuracy": round(float(accuracy), 1),
        "response_time_ms": max(response_time_ms, duration_ms, 0),
        "result_data": {
            "correctAnswers": correct_answers,
            "errors": errors,
            "averageReactionMs": average_reaction_ms,
            "bestReactionMs": best_reaction_ms,
            "durationMs": duration_ms or response_time_ms,
            **stamped,
        },
    }
