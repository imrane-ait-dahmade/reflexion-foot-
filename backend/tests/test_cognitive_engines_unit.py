"""Unit tests for Digit Memory and Dual Target challenge engines."""

from __future__ import annotations

from app.modules.cognitive_engines.challenge_token import (
    read_challenge,
    sign_challenge,
    unit_float,
)
from app.modules.cognitive_engines import digit_memory, dual_target
from app.modules.cognitive_engines.digit_memory import DIGIT_VISIBLE_MS

SECRET = "x" * 48


def test_challenge_token_roundtrip() -> None:
    payload = {"kind": "digit-memory", "seed": "abc", "level": 1}
    token = sign_challenge(payload, SECRET)
    assert read_challenge(token, SECRET) == payload
    assert read_challenge(token, SECRET + "y") is None


def test_unit_float_deterministic() -> None:
    a = unit_float(SECRET, "seed:digit-memory:1:0")
    b = unit_float(SECRET, "seed:digit-memory:1:0")
    c = unit_float(SECRET, "seed:digit-memory:1:1")
    assert a == b
    assert a != c
    assert 0.0 <= a < 1.0


def test_digit_memory_full_ladder_then_finish() -> None:
    begun = digit_memory.begin_digit_attempt(
        session_player_id="sp-1",
        session_id="sess-1",
        now_ms=1_000_000,
        secret=SECRET,
    )
    token = begun["token"]
    assert begun["level"] == 1
    assert begun["length"] == 3

    clock = 1_000_000
    # Complete all levels exactly.
    for expected_level in range(1, len(digit_memory.DIGIT_LEVELS) + 1):
        length = digit_memory.digit_length(expected_level)
        assert length is not None
        for _ in range(length):
            clock += DIGIT_VISIBLE_MS + 50
            revealed = digit_memory.reveal_next_digit(token, SECRET, clock)
            assert "error" not in revealed, revealed
            token = revealed["token"]
        payload = read_challenge(token, SECRET)
        assert payload is not None
        expected = digit_memory.digit_sequence(str(payload["seed"]), expected_level, SECRET)
        clock += 1_000
        graded = digit_memory.answer_digit_sequence(token, expected, SECRET, clock)
        assert "error" not in graded
        if expected_level < len(digit_memory.DIGIT_LEVELS):
            assert graded["finished"] is False
            token = graded["token"]
        else:
            assert graded["finished"] is True
            assert graded["result"]["metrics"]["levelsCompleted"] == len(digit_memory.DIGIT_LEVELS)
            assert graded["result"]["metrics"]["scoringVersion"] == "digit-memory-1"


def test_digit_memory_wrong_answer_finishes() -> None:
    begun = digit_memory.begin_digit_attempt(
        session_player_id="sp-1",
        session_id="sess-1",
        now_ms=1_000,
        secret=SECRET,
    )
    token = begun["token"]
    clock = 50_000
    for _ in range(3):
        clock += DIGIT_VISIBLE_MS + 50
        revealed = digit_memory.reveal_next_digit(token, SECRET, clock)
        assert "error" not in revealed, revealed
        token = revealed["token"]
    graded = digit_memory.answer_digit_sequence(token, [9, 9, 9], SECRET, clock + 1_000)
    # May accidentally match; if exact, force wrong by flipping if needed
    if graded.get("exact"):
        payload = read_challenge(token, SECRET)
        assert payload is not None
        expected = digit_memory.digit_sequence(str(payload["seed"]), 1, SECRET)
        wrong = [(d + 1) % 10 for d in expected]
        graded = digit_memory.answer_digit_sequence(token, wrong, SECRET, 60_000)
    assert graded["finished"] is True
    assert graded["exact"] is False


def test_dual_target_grade_and_advance() -> None:
    begun = dual_target.begin_dual_attempt(
        session_player_id="sp-1",
        session_id="sess-1",
        now_ms=1_000,
        secret=SECRET,
    )
    token = begun["token"]
    challenge = begun["challenge"]
    assert challenge is not None
    assert challenge["level"] == 1
    targets = challenge["highlightIds"]

    # Too early rejected
    early = dual_target.grade_dual_round(token, targets, SECRET, 1_500)
    assert "error" in early

    # After movement window (+1500ms tolerance)
    ready_at = 1_000 + dual_target.DUAL_HIGHLIGHT_MS
    duration = challenge["durationMs"]
    now = ready_at + duration + 100
    graded = dual_target.grade_dual_round(token, targets, SECRET, now)
    assert "error" not in graded
    assert graded["finished"] is False
    assert graded["both"] is True
    assert graded["challenge"]["level"] == 2
