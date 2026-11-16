"""Unit tests for client-observed exercise validation."""

import pytest

from app.modules.cognitive_engines.observation import (
    INTEGRITY_NOTE,
    validate_observation_payload,
)


def test_observation_payload_stamps_integrity() -> None:
    out = validate_observation_payload(
        slug="reaction-time",
        score=80,
        accuracy=80.0,
        response_time_ms=1200,
        correct_answers=8,
        errors=2,
        average_reaction_ms=350,
        best_reaction_ms=220,
        duration_ms=1200,
        metrics={"trials": 10},
    )
    assert out["result_data"]["integrityMode"] == "client_observed"
    assert INTEGRITY_NOTE in out["result_data"]["integrity"]
    assert out["result_data"]["trials"] == 10


def test_observation_rejects_bad_score() -> None:
    with pytest.raises(ValueError, match="score"):
        validate_observation_payload(
            slug="visual-tracking",
            score=150,
            accuracy=50,
            response_time_ms=1,
            correct_answers=0,
            errors=0,
            average_reaction_ms=0,
            best_reaction_ms=0,
            duration_ms=1,
            metrics=None,
        )


def test_observation_rejects_challenge_slug() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        validate_observation_payload(
            slug="digit-memory",
            score=5,
            accuracy=50,
            response_time_ms=1,
            correct_answers=0,
            errors=0,
            average_reaction_ms=0,
            best_reaction_ms=0,
            duration_ms=1,
            metrics=None,
        )
