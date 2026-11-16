"""Orchestrate challenge start / grade / persist against V2 session attempts."""

from __future__ import annotations

import time
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ValidationError
from app.modules.cognitive_engines.challenge_token import challenge_secret
from app.modules.cognitive_engines import digit_memory, dual_target
from app.modules.test_sessions.application import player_access_service
from app.modules.test_sessions.application.schemas import CompleteExerciseRequest
from app.modules.test_sessions.presentation.deps import PlayerSessionPrincipal


async def _resolve_open_exercise(
    session: AsyncSession,
    principal: PlayerSessionPrincipal,
    slug: str,
) -> uuid.UUID:
    progress = await player_access_service.get_progress(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
    )
    exercise = next((ex for ex in progress.exercises if ex.slug == slug), None)
    if exercise is None:
        raise ValidationError("Ce test ne fait pas partie de la session.")
    if exercise.completed:
        raise ConflictError("Déjà enregistré.")
    await player_access_service.start_exercise(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
        session_exercise_id=exercise.session_exercise_id,
    )
    return exercise.session_exercise_id


async def _persist_result(
    session: AsyncSession,
    principal: PlayerSessionPrincipal,
    *,
    slug: str,
    result: dict[str, Any],
) -> None:
    progress = await player_access_service.get_progress(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
    )
    exercise = next((ex for ex in progress.exercises if ex.slug == slug), None)
    if exercise is None:
        raise ValidationError("Ce test ne fait pas partie de la session.")
    if exercise.completed:
        raise ConflictError("Déjà enregistré.")

    metrics = result.get("metrics") or {}
    payload = CompleteExerciseRequest(
        score=min(100, max(0, int(result["score"]))),
        accuracy=Decimal(str(result["accuracy"])),
        response_time_ms=max(0, int(result["duration_ms"])),
        result_data={
            "correctAnswers": result.get("correct_answers", 0),
            "errors": result.get("errors", 0),
            "averageReactionMs": 0,
            "bestReactionMs": 0,
            "durationMs": result.get("duration_ms"),
            **metrics,
        },
    )
    try:
        await player_access_service.complete_exercise(
            session,
            player_id=principal.player_id,
            session_id=principal.session_id,
            session_player_id=principal.session_player_id,
            session_exercise_id=exercise.session_exercise_id,
            payload=payload,
        )
    except ValidationError as exc:
        if "already completed" in exc.message.lower():
            raise ConflictError("Déjà enregistré.") from exc
        raise


def _now_ms() -> int:
    return int(time.time() * 1000)


async def handle_digit_memory(
    session: AsyncSession,
    principal: PlayerSessionPrincipal,
    *,
    action: str,
    token: str | None,
    answer: list[int] | None,
) -> dict[str, Any]:
    secret = challenge_secret()
    now = _now_ms()

    if action == "start":
        await _resolve_open_exercise(session, principal, "digit-memory")
        begun = digit_memory.begin_digit_attempt(
            session_player_id=str(principal.session_player_id),
            session_id=str(principal.session_id),
            now_ms=now,
            secret=secret,
        )
        return begun

    if action == "digit":
        if not token:
            raise ValidationError("Jeton requis.")
        revealed = digit_memory.reveal_next_digit(token, secret, now)
        if "error" in revealed:
            raise ValidationError(str(revealed["error"]))
        return revealed

    if action == "answer":
        if not token or answer is None:
            raise ValidationError("Réponse incomplète.")
        graded = digit_memory.answer_digit_sequence(token, answer, secret, now)
        if "error" in graded:
            raise ValidationError(str(graded["error"]))
        if not graded.get("finished"):
            return {
                "exact": graded["exact"],
                "positional": graded["positional"],
                "positionErrors": graded["positionErrors"],
                "finished": False,
                "level": graded["level"],
                "length": graded["length"],
                "token": graded["token"],
            }
        if graded.get("sessionPlayerId") != str(principal.session_player_id):
            raise ValidationError("Jeton invalide.")
        await _persist_result(
            session,
            principal,
            slug="digit-memory",
            result=graded["result"],
        )
        metrics = graded["result"]["metrics"]
        return {
            "exact": graded["exact"],
            "positional": graded["positional"],
            "positionErrors": graded["positionErrors"],
            "finished": True,
            "summary": {
                "maximumDigitsMemorized": metrics["maximumDigitsMemorized"],
                "levelsCompleted": metrics["levelsCompleted"],
                "incorrectSequences": graded["result"]["errors"],
            },
        }

    raise ValidationError("Action inconnue.")


async def handle_dual_target(
    session: AsyncSession,
    principal: PlayerSessionPrincipal,
    *,
    action: str,
    token: str | None,
    selected: list[int] | None,
) -> dict[str, Any]:
    secret = challenge_secret()
    now = _now_ms()

    if action == "start":
        await _resolve_open_exercise(session, principal, "dual-target-tracking")
        return dual_target.begin_dual_attempt(
            session_player_id=str(principal.session_player_id),
            session_id=str(principal.session_id),
            now_ms=now,
            secret=secret,
        )

    if action == "submit":
        if not token or selected is None:
            raise ValidationError("Sélection incomplète.")
        graded = dual_target.grade_dual_round(token, selected, secret, now)
        if "error" in graded:
            raise ValidationError(str(graded["error"]))
        if not graded.get("finished"):
            return {
                "both": graded["both"],
                "correctlyIdentifiedTargets": graded["correctlyIdentifiedTargets"],
                "finished": False,
                "token": graded["token"],
                "challenge": graded["challenge"],
            }
        if graded.get("sessionPlayerId") != str(principal.session_player_id):
            raise ValidationError("Jeton invalide.")
        await _persist_result(
            session,
            principal,
            slug="dual-target-tracking",
            result=graded["result"],
        )
        metrics = graded["result"]["metrics"]
        return {
            "both": graded["both"],
            "correctlyIdentifiedTargets": graded["correctlyIdentifiedTargets"],
            "finished": True,
            "summary": {
                "correctlyIdentifiedTargets": metrics["correctlyIdentifiedTargets"],
                "incorrectSelections": metrics["incorrectSelections"],
                "difficultyLevelReached": metrics["difficultyLevelReached"],
                "accuracy": graded["result"]["accuracy"],
            },
        }

    raise ValidationError("Action inconnue.")
