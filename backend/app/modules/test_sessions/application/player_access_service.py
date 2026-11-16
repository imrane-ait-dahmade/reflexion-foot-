"""Player dual-code join and sequential exercise progression."""

from __future__ import annotations

import time
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from threading import Lock

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, NotFoundError, ValidationError
from app.core.security import (
    create_player_session_token,
    decode_player_session_token,
    verify_secret,
)
from app.modules.players.application.credentials import normalize_access_code
from app.modules.players.infrastructure.models import PlayerCredential
from app.modules.results.infrastructure.models import TestAttempt, TestResult
from app.modules.test_sessions.application.schemas import (
    CompleteExerciseRequest,
    PlayerExerciseProgressItem,
    PlayerJoinRequest,
    PlayerJoinResponse,
    PlayerSessionProgressResponse,
)
from app.modules.test_sessions.application.session_codes import normalize_session_code
from app.modules.test_sessions.infrastructure.models import SessionPlayer, TrainingSession
from app.modules.test_sessions.infrastructure.repositories import (
    SessionPlayerRepository,
    TrainingSessionRepository,
)
from app.shared.infrastructure.database.enums import (
    AttemptStatus,
    SessionPlayerStatus,
    SessionStatus,
)


def _val(value: object) -> str:
    return str(getattr(value, "value", value))


# Simple in-process rate limit (per process). Keyed by normalized session code.
_JOIN_LOCK = Lock()
_JOIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_JOIN_WINDOW_SECONDS = 60.0
_JOIN_MAX_ATTEMPTS = 10


def _rate_limit_join(session_code: str) -> None:
    now = time.monotonic()
    key = session_code
    with _JOIN_LOCK:
        bucket = [t for t in _JOIN_ATTEMPTS[key] if now - t < _JOIN_WINDOW_SECONDS]
        if len(bucket) >= _JOIN_MAX_ATTEMPTS:
            _JOIN_ATTEMPTS[key] = bucket
            raise AuthenticationError("Too many attempts. Try again later.")
        bucket.append(now)
        _JOIN_ATTEMPTS[key] = bucket


async def _match_registered_player(
    session: AsyncSession,
    *,
    training: TrainingSession,
    personal_code: str,
) -> tuple[uuid.UUID, SessionPlayer] | None:
    """Verify personal code against credentials of registered session players only."""
    candidates = [
        sp for sp in training.players if _val(sp.status) != SessionPlayerStatus.WITHDRAWN.value
    ]
    if not candidates:
        return None
    player_ids = [sp.player_id for sp in candidates]
    stmt = select(PlayerCredential).where(
        PlayerCredential.player_id.in_(player_ids),
        PlayerCredential.revoked_at.is_(None),
    )
    credentials = list((await session.scalars(stmt)).all())
    matched_player_id: uuid.UUID | None = None
    for cred in credentials:
        if verify_secret(cred.code_hash, personal_code):
            matched_player_id = cred.player_id
            break
    if matched_player_id is None:
        return None
    sp = next(sp for sp in candidates if sp.player_id == matched_player_id)
    return matched_player_id, sp


async def join_session(
    session: AsyncSession,
    payload: PlayerJoinRequest,
) -> PlayerJoinResponse:
    session_code = normalize_session_code(payload.session_code)
    _rate_limit_join(session_code)

    # Generic failure path — never reveal which factor failed.
    async def _fail() -> None:
        raise AuthenticationError("Invalid credentials or session access denied")

    training = await TrainingSessionRepository(session).get_by_code(session_code)
    if training is None or _val(training.status) != SessionStatus.IN_PROGRESS.value:
        await _fail()
        raise AssertionError("unreachable")

    matched = await _match_registered_player(
        session,
        training=training,
        personal_code=normalize_access_code(payload.personal_code),
    )
    if matched is None:
        await _fail()
        raise AssertionError("unreachable")
    player_id, sp = matched

    if _val(sp.status) == SessionPlayerStatus.JOINED.value:
        sp.status = SessionPlayerStatus.IN_PROGRESS
        await session.commit()

    token, expires_in = create_player_session_token(
        player_id=player_id,
        session_id=training.id,
        session_player_id=sp.id,
    )
    return PlayerJoinResponse(
        access_token=token,
        expires_in=expires_in,
        session_id=training.id,
        player_id=player_id,
        session_player_id=sp.id,
        session_title=training.title,
    )


def parse_player_token(token: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    try:
        payload = decode_player_session_token(token)
        return (
            uuid.UUID(str(payload["player_id"])),
            uuid.UUID(str(payload["session_id"])),
            uuid.UUID(str(payload["session_player_id"])),
        )
    except Exception as exc:  # noqa: BLE001
        raise AuthenticationError("Invalid or expired player session token") from exc


async def _load_participation(
    session: AsyncSession,
    *,
    player_id: uuid.UUID,
    session_id: uuid.UUID,
    session_player_id: uuid.UUID,
) -> tuple[TrainingSession, SessionPlayer]:
    training = await TrainingSessionRepository(session).get_by_id(session_id)
    if training is None or _val(training.status) != SessionStatus.IN_PROGRESS.value:
        raise AuthenticationError("Session is not available")
    sp = await SessionPlayerRepository(session).get(
        session_id=session_id,
        player_id=player_id,
    )
    if (
        sp is None
        or sp.id != session_player_id
        or _val(sp.status) == SessionPlayerStatus.WITHDRAWN.value
    ):
        raise AuthenticationError("Session participation not found")
    return training, sp


async def get_progress(
    session: AsyncSession,
    *,
    player_id: uuid.UUID,
    session_id: uuid.UUID,
    session_player_id: uuid.UUID,
) -> PlayerSessionProgressResponse:
    training, sp = await _load_participation(
        session,
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )
    attempt_rows = list(
        (
            await session.scalars(select(TestAttempt).where(TestAttempt.session_player_id == sp.id))
        ).all()
    )
    attempts_by_ex = {a.session_exercise_id: a for a in attempt_rows}
    exercises = sorted(training.exercises, key=lambda e: e.display_order)
    items: list[PlayerExerciseProgressItem] = []
    current: int | None = None
    completed_count = 0
    for ex in exercises:
        attempt = attempts_by_ex.get(ex.id)
        completed = attempt is not None and _val(attempt.status) == AttemptStatus.COMPLETED.value
        if completed:
            completed_count += 1
        elif current is None:
            current = ex.display_order
        items.append(
            PlayerExerciseProgressItem(
                session_exercise_id=ex.id,
                cognitive_test_id=ex.cognitive_test_id,
                display_order=ex.display_order,
                slug=ex.cognitive_test.slug if ex.cognitive_test else "",
                name=ex.cognitive_test.name if ex.cognitive_test else "",
                attempt_status=(_val(attempt.status) if attempt is not None else None),  # type: ignore[arg-type]
                completed=completed,
            )
        )
    return PlayerSessionProgressResponse(
        session_id=training.id,
        session_title=training.title,
        session_status=_val(training.status),  # type: ignore[arg-type]
        participation_status=_val(sp.status),  # type: ignore[arg-type]
        current_display_order=current,
        exercises=items,
        completed_count=completed_count,
        remaining_count=len(exercises) - completed_count,
    )


async def start_exercise(
    session: AsyncSession,
    *,
    player_id: uuid.UUID,
    session_id: uuid.UUID,
    session_player_id: uuid.UUID,
    session_exercise_id: uuid.UUID,
) -> PlayerSessionProgressResponse:
    training, sp = await _load_participation(
        session,
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )
    exercises = sorted(training.exercises, key=lambda e: e.display_order)
    target = next((e for e in exercises if e.id == session_exercise_id), None)
    if target is None:
        raise NotFoundError("Exercise not assigned to this session")

    attempts_by_ex = {a.session_exercise_id: a for a in sp.attempts}
    for ex in exercises:
        attempt = attempts_by_ex.get(ex.id)
        done = attempt is not None and _val(attempt.status) == AttemptStatus.COMPLETED.value
        if not done:
            if ex.id != session_exercise_id:
                raise ValidationError("Exercises must be completed in order")
            break

    existing = attempts_by_ex.get(session_exercise_id)
    if existing is not None:
        if _val(existing.status) == AttemptStatus.COMPLETED.value:
            raise ValidationError("Exercise already completed")
        # already in progress — idempotent
        return await get_progress(
            session,
            player_id=player_id,
            session_id=session_id,
            session_player_id=session_player_id,
        )

    session.add(
        TestAttempt(
            session_player_id=sp.id,
            session_exercise_id=session_exercise_id,
            status=AttemptStatus.IN_PROGRESS,
        )
    )
    if _val(sp.status) == SessionPlayerStatus.JOINED.value:
        sp.status = SessionPlayerStatus.IN_PROGRESS
    await session.commit()
    return await get_progress(
        session,
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )


async def complete_exercise(
    session: AsyncSession,
    *,
    player_id: uuid.UUID,
    session_id: uuid.UUID,
    session_player_id: uuid.UUID,
    session_exercise_id: uuid.UUID,
    payload: CompleteExerciseRequest,
) -> PlayerSessionProgressResponse:
    training, sp = await _load_participation(
        session,
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )
    exercises = sorted(training.exercises, key=lambda e: e.display_order)
    if not any(e.id == session_exercise_id for e in exercises):
        raise NotFoundError("Exercise not assigned to this session")

    attempts_by_ex = {a.session_exercise_id: a for a in sp.attempts}
    for ex in exercises:
        attempt_row = attempts_by_ex.get(ex.id)
        done = attempt_row is not None and _val(attempt_row.status) == AttemptStatus.COMPLETED.value
        if not done:
            if ex.id != session_exercise_id:
                raise ValidationError("Exercises must be completed in order")
            break

    attempt = attempts_by_ex.get(session_exercise_id)
    if attempt is not None and _val(attempt.status) == AttemptStatus.COMPLETED.value:
        raise ValidationError("Exercise already completed")

    if attempt is None:
        attempt = TestAttempt(
            session_player_id=sp.id,
            session_exercise_id=session_exercise_id,
            status=AttemptStatus.IN_PROGRESS,
        )
        session.add(attempt)
        await session.flush()

    now = datetime.now(UTC)
    attempt.status = AttemptStatus.COMPLETED
    attempt.completed_at = now
    existing_result = await session.scalar(
        select(TestResult).where(TestResult.attempt_id == attempt.id)
    )
    if existing_result is None:
        session.add(
            TestResult(
                attempt_id=attempt.id,
                score=payload.score,
                accuracy=payload.accuracy,
                response_time_ms=payload.response_time_ms,
                result_data=payload.result_data,
            )
        )

    # Mark participation complete when all exercises done.
    completed_ids = {
        a.session_exercise_id
        for a in sp.attempts
        if _val(a.status) == AttemptStatus.COMPLETED.value
    }
    completed_ids.add(session_exercise_id)
    if all(e.id in completed_ids for e in exercises):
        sp.status = SessionPlayerStatus.COMPLETED
    elif _val(sp.status) == SessionPlayerStatus.JOINED.value:
        sp.status = SessionPlayerStatus.IN_PROGRESS

    await session.commit()
    return await get_progress(
        session,
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )
