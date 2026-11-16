"""Normalize V2 results into an analysis context (no fabricated scores)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.cognitive_tests.infrastructure.models import SessionExercise
from app.modules.results.infrastructure.models import TestAttempt, TestResult
from app.modules.test_sessions.infrastructure.models import SessionPlayer, TrainingSession
from app.shared.infrastructure.database.enums import AttemptStatus


def _val(value: object) -> str:
    return str(getattr(value, "value", value))


async def load_player_attempt_bundle(
    session: AsyncSession,
    *,
    session_player_id: uuid.UUID,
) -> dict[str, Any] | None:
    sp = await session.scalar(
        select(SessionPlayer)
        .where(SessionPlayer.id == session_player_id)
        .options(
            selectinload(SessionPlayer.attempts).selectinload(TestAttempt.result),
            selectinload(SessionPlayer.attempts)
            .selectinload(TestAttempt.session_exercise)
            .selectinload(SessionExercise.cognitive_test),
            selectinload(SessionPlayer.session),
        )
    )
    if sp is None:
        return None

    tests: list[dict[str, Any]] = []
    attempt_ids: list[str] = []
    for attempt in sp.attempts:
        if _val(attempt.status) != AttemptStatus.COMPLETED.value:
            continue
        result: TestResult | None = attempt.result
        if result is None:
            continue
        exercise = attempt.session_exercise
        slug = exercise.cognitive_test.slug if exercise and exercise.cognitive_test else "unknown"
        data = result.result_data if isinstance(result.result_data, dict) else {}
        attempt_ids.append(str(attempt.id))
        tests.append(
            {
                "attempt_id": str(attempt.id),
                "test_slug": slug,
                "score": result.score,
                "accuracy": float(result.accuracy),
                "response_time_ms": result.response_time_ms,
                "correct_answers": data.get("correctAnswers"),
                "errors": data.get("errors"),
                "duration_ms": data.get("durationMs", result.response_time_ms),
                "metrics": {
                    k: v
                    for k, v in data.items()
                    if k
                    not in {
                        "correctAnswers",
                        "errors",
                        "averageReactionMs",
                        "bestReactionMs",
                        "durationMs",
                    }
                },
            }
        )

    training: TrainingSession = sp.session
    return {
        "session_player_id": str(sp.id),
        "player_id": str(sp.player_id),
        "training_session_id": str(training.id),
        "session_title": training.title,
        "tests": tests,
        "source_attempt_ids": attempt_ids,
    }


def allowed_metric_keys(tests: list[dict[str, Any]]) -> list[str]:
    keys = {
        "score",
        "accuracy",
        "response_time_ms",
        "correct_answers",
        "errors",
        "duration_ms",
    }
    for test in tests:
        metrics = test.get("metrics") or {}
        if isinstance(metrics, dict):
            keys.update(str(k) for k in metrics.keys())
    return sorted(keys)


async def load_session_group_bundle(
    session: AsyncSession,
    *,
    training_session_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Aggregate completed attempts for a training session (group report)."""
    training = await session.scalar(
        select(TrainingSession).where(TrainingSession.id == training_session_id)
    )
    if training is None:
        return None

    players = list(
        (
            await session.scalars(
                select(SessionPlayer)
                .where(SessionPlayer.session_id == training_session_id)
                .options(
                    selectinload(SessionPlayer.player),
                    selectinload(SessionPlayer.attempts).selectinload(TestAttempt.result),
                    selectinload(SessionPlayer.attempts)
                    .selectinload(TestAttempt.session_exercise)
                    .selectinload(SessionExercise.cognitive_test),
                )
            )
        ).all()
    )

    from app.modules.cognitive_tests.infrastructure.models import SessionExercise as SE

    exercise_count = len(
        list(
            (
                await session.scalars(select(SE).where(SE.session_id == training_session_id))
            ).all()
        )
    )

    group_players: list[dict[str, Any]] = []
    source_attempt_ids: list[str] = []
    for sp in players:
        tests: list[dict[str, Any]] = []
        for attempt in sp.attempts:
            if _val(attempt.status) != AttemptStatus.COMPLETED.value:
                continue
            result = attempt.result
            if result is None:
                continue
            exercise = attempt.session_exercise
            slug = (
                exercise.cognitive_test.slug
                if exercise and exercise.cognitive_test
                else "unknown"
            )
            source_attempt_ids.append(str(attempt.id))
            tests.append(
                {
                    "attempt_id": str(attempt.id),
                    "test_slug": slug,
                    "score": result.score,
                    "accuracy": float(result.accuracy),
                }
            )
        finished = exercise_count > 0 and len(tests) >= exercise_count
        display = "Joueur"
        player = getattr(sp, "player", None)
        if player is not None:
            display = f"{player.first_name} {player.last_name}".strip() or display
        # Privacy: only include first name + last initial for unfinished? Keep full for coach owner.
        group_players.append(
            {
                "session_player_id": str(sp.id),
                "display_name": display,
                "finished": finished,
                "tests": tests,
            }
        )

    finished_players = [p for p in group_players if p["finished"] and p["tests"]]
    return {
        "training_session_id": str(training_session_id),
        "session_title": training.title,
        "exercise_count": exercise_count,
        "group_players": group_players,
        "finished_players": finished_players,
        "source_attempt_ids": source_attempt_ids,
    }
