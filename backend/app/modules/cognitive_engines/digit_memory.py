"""Digit Memory engine — port of frontend/lib/tests/digit-memory/*."""

from __future__ import annotations

from typing import Any

from app.modules.cognitive_engines.challenge_token import (
    challenge_seed,
    read_challenge,
    sign_challenge,
    unit_float,
)

DIGIT_LEVELS = (3, 4, 5, 6, 7, 8, 9, 10)
DIGIT_VISIBLE_MS = 800


def digit_length(level: int) -> int | None:
    if level < 1 or level > len(DIGIT_LEVELS):
        return None
    return DIGIT_LEVELS[level - 1]


def digit_sequence(seed: str, level: int, secret: str) -> list[int]:
    length = digit_length(level)
    if length is None:
        raise ValueError("Niveau inconnu.")
    digits: list[int] = []
    for index in range(length):
        unit = unit_float(secret, f"{seed}:digit-memory:{level}:{index}")
        digits.append(int(unit * 10))
    return digits


def grade_digit_sequence(expected: list[int], answer: list[int]) -> dict[str, Any]:
    positional = sum(1 for i, value in enumerate(expected) if i < len(answer) and answer[i] == value)
    exact = len(answer) == len(expected) and positional == len(expected)
    return {
        "exact": exact,
        "positional": positional,
        "position_errors": len(expected) - positional,
    }


def calculate_accuracy(correct: int, errors: int) -> float:
    attempts = correct + errors
    if attempts == 0:
        return 0.0
    return round((correct / attempts) * 1000) / 10


def begin_digit_attempt(
    *,
    session_player_id: str,
    session_id: str,
    now_ms: int,
    secret: str,
) -> dict[str, Any]:
    token = {
        "kind": "digit-memory",
        "sessionPlayerId": session_player_id,
        "sessionId": session_id,
        "seed": challenge_seed(),
        "level": 1,
        "phase": "present",
        "shown": 0,
        "lastDigitAt": 0,
        "levelsCompleted": 0,
        "maximumDigitsMemorized": 0,
        "totalDigitsPresented": 0,
        "totalCorrectDigits": 0,
        "sequenceAttempts": 0,
        "incorrectSequences": 0,
        "startedAt": now_ms,
    }
    return {
        "token": sign_challenge(token, secret),
        "level": 1,
        "length": digit_length(1),
    }


def reveal_next_digit(signed: str, secret: str, now_ms: int) -> dict[str, Any]:
    token = read_challenge(signed, secret)
    if not token or token.get("kind") != "digit-memory" or not token.get("seed"):
        return {"error": "Jeton invalide."}
    if token.get("phase") != "present":
        return {"error": "La séquence est déjà terminée."}
    length = digit_length(int(token["level"]))
    if not length or int(token["shown"]) >= length:
        return {"error": "Chiffre indisponible."}
    if int(token["shown"]) > 0 and now_ms < int(token["lastDigitAt"]) + DIGIT_VISIBLE_MS:
        return {"error": "Trop tôt."}
    digits = digit_sequence(str(token["seed"]), int(token["level"]), secret)
    shown = int(token["shown"]) + 1
    next_token = {
        **token,
        "shown": shown,
        "lastDigitAt": now_ms,
        "phase": "answer" if shown >= length else "present",
    }
    return {
        "digit": digits[shown - 1],
        "shown": shown,
        "length": length,
        "answer": next_token["phase"] == "answer",
        "token": sign_challenge(next_token, secret),
    }


def build_digit_result(token: dict[str, Any], now_ms: int) -> dict[str, Any]:
    presented = int(token["totalDigitsPresented"])
    missed = max(0, presented - int(token["totalCorrectDigits"]))
    accuracy = calculate_accuracy(int(token["totalCorrectDigits"]), missed)
    return {
        "score": int(token["maximumDigitsMemorized"]),
        "accuracy": accuracy,
        "correct_answers": int(token["totalCorrectDigits"]),
        "errors": int(token["incorrectSequences"]),
        "duration_ms": max(1, now_ms - int(token["startedAt"])),
        "metrics": {
            "levelsCompleted": int(token["levelsCompleted"]),
            "maximumDigitsMemorized": int(token["maximumDigitsMemorized"]),
            "totalDigitsPresented": presented,
            "totalCorrectDigits": int(token["totalCorrectDigits"]),
            "sequenceAttempts": int(token["sequenceAttempts"]),
            "incorrectSequences": int(token["incorrectSequences"]),
            "completionTimeMs": max(1, now_ms - int(token["startedAt"])),
            "completionStatus": "completed",
            "scoringVersion": "digit-memory-1",
        },
    }


def answer_digit_sequence(
    signed: str,
    answer: list[int],
    secret: str,
    now_ms: int,
) -> dict[str, Any]:
    token = read_challenge(signed, secret)
    if not token or token.get("kind") != "digit-memory" or not token.get("seed"):
        return {"error": "Jeton invalide."}
    if token.get("phase") != "answer":
        return {"error": "La séquence n'est pas terminée."}
    if not all(isinstance(d, int) and 0 <= d <= 9 for d in answer):
        return {"error": "Réponse invalide."}
    expected = digit_sequence(str(token["seed"]), int(token["level"]), secret)
    grade = grade_digit_sequence(expected, answer)
    next_token = {
        **token,
        "sequenceAttempts": int(token["sequenceAttempts"]) + 1,
        "totalDigitsPresented": int(token["totalDigitsPresented"]) + len(expected),
        "totalCorrectDigits": int(token["totalCorrectDigits"]) + grade["positional"],
        "incorrectSequences": int(token["incorrectSequences"]) + (0 if grade["exact"] else 1),
        "levelsCompleted": int(token["levelsCompleted"]) + (1 if grade["exact"] else 0),
        "maximumDigitsMemorized": (
            max(int(token["maximumDigitsMemorized"]), len(expected))
            if grade["exact"]
            else int(token["maximumDigitsMemorized"])
        ),
    }
    finished = (not grade["exact"]) or int(token["level"]) >= len(DIGIT_LEVELS)
    if not finished:
        advanced = {
            **next_token,
            "level": int(token["level"]) + 1,
            "phase": "present",
            "shown": 0,
            "lastDigitAt": 0,
        }
        return {
            "exact": True,
            "positional": grade["positional"],
            "positionErrors": grade["position_errors"],
            "finished": False,
            "level": advanced["level"],
            "length": digit_length(int(advanced["level"])),
            "token": sign_challenge(advanced, secret),
        }
    return {
        "exact": grade["exact"],
        "positional": grade["positional"],
        "positionErrors": grade["position_errors"],
        "finished": True,
        "sessionPlayerId": token["sessionPlayerId"],
        "result": build_digit_result(next_token, now_ms),
    }
