"""Staff training-session use cases."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.cognitive_tests.infrastructure.models import CognitiveTest, SessionExercise
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.teams.application.team_access import (
    assert_can_access_player,
    assert_team_assignable_for_actor,
    is_platform_admin,
)
from app.modules.teams.infrastructure.repositories import TeamRepository
from app.modules.test_sessions.application.schemas import (
    AddSessionPlayersRequest,
    CognitiveTestResponse,
    CreateSessionRequest,
    ReplaceSessionExercisesRequest,
    SessionExerciseResponse,
    SessionListResponse,
    SessionParticipantProgress,
    SessionParticipantResponse,
    SessionResponse,
)
from app.modules.test_sessions.application.session_codes import generate_session_code
from app.modules.test_sessions.infrastructure.models import SessionPlayer, TrainingSession
from app.modules.test_sessions.infrastructure.repositories import (
    SessionExerciseRepository,
    SessionNameCounterRepository,
    SessionPlayerRepository,
    TrainingSessionRepository,
)
from app.shared.infrastructure.database.enums import (
    AttemptStatus,
    SessionPlayerStatus,
    SessionStatus,
)


def _enum_value(value: object) -> str:
    return getattr(value, "value", value)  # type: ignore[return-value]


def _include_code(status: SessionStatus | str) -> bool:
    return _enum_value(status) in {
        SessionStatus.DRAFT.value,
        SessionStatus.IN_PROGRESS.value,
    }


def _serialize_session(
    training: TrainingSession,
    *,
    include_code: bool | None = None,
) -> SessionResponse:
    show_code = _include_code(training.status) if include_code is None else include_code
    exercises = sorted(training.exercises, key=lambda e: e.display_order)
    total_ex = len(exercises)
    players: list[SessionParticipantResponse] = []
    for sp in training.players:
        completed_ids = {
            a.session_exercise_id
            for a in sp.attempts
            if _enum_value(a.status) == AttemptStatus.COMPLETED.value
        }
        current = None
        for ex in exercises:
            if ex.id not in completed_ids:
                current = ex.display_order
                break
        players.append(
            SessionParticipantResponse(
                id=sp.id,
                player_id=sp.player_id,
                first_name=sp.player.first_name if sp.player else None,
                last_name=sp.player.last_name if sp.player else None,
                status=_enum_value(sp.status),  # type: ignore[arg-type]
                joined_at=sp.joined_at,
                progress=SessionParticipantProgress(
                    completed_exercises=len(completed_ids),
                    total_exercises=total_ex,
                    current_display_order=current,
                ),
            )
        )
    return SessionResponse(
        id=training.id,
        title=training.title,
        session_code=training.session_code if show_code else None,
        status=_enum_value(training.status),  # type: ignore[arg-type]
        team_id=training.team_id,
        created_by=training.created_by,
        created_at=training.created_at,
        updated_at=training.updated_at,
        players=players,
        exercises=[
            SessionExerciseResponse(
                id=ex.id,
                cognitive_test_id=ex.cognitive_test_id,
                display_order=ex.display_order,
                cognitive_test=(
                    CognitiveTestResponse.model_validate(ex.cognitive_test)
                    if ex.cognitive_test is not None
                    else None
                ),
            )
            for ex in exercises
        ],
    )


async def _unique_code(repo: TrainingSessionRepository) -> str:
    for _ in range(20):
        code = generate_session_code()
        if not await repo.code_exists(code):
            return code
    raise ValidationError("Unable to generate a unique session code")


async def _validate_exercises(
    session: AsyncSession,
    exercise_ids: list[uuid.UUID],
) -> None:
    rows = list(
        (
            await session.scalars(
                select(CognitiveTest).where(
                    CognitiveTest.id.in_(exercise_ids),
                    CognitiveTest.is_active.is_(True),
                )
            )
        ).all()
    )
    found = {r.id for r in rows}
    missing = set(exercise_ids) - found
    if missing:
        raise ValidationError("One or more cognitive exercises are invalid or inactive")


async def _assert_can_view_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    training: TrainingSession,
) -> None:
    if is_platform_admin(user):
        return
    repo = TrainingSessionRepository(session)
    stmt = select(TrainingSession.id).where(
        TrainingSession.id == training.id,
        repo._scope_filter(user.id),
    )
    if await session.scalar(stmt) is None:
        raise NotFoundError("Session not found")


async def list_cognitive_tests(session: AsyncSession) -> list[CognitiveTestResponse]:
    rows = list(
        (
            await session.scalars(
                select(CognitiveTest)
                .where(CognitiveTest.is_active.is_(True))
                .order_by(CognitiveTest.name.asc())
            )
        ).all()
    )
    return [CognitiveTestResponse.model_validate(r) for r in rows]


async def list_sessions(
    session: AsyncSession,
    user: AuthenticatedUser,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: SessionStatus | None = None,
) -> SessionListResponse:
    if page < 1:
        raise ValidationError("page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise ValidationError("page_size must be between 1 and 100")
    scope = None if is_platform_admin(user) else user.id
    rows, total = await TrainingSessionRepository(session).list_sessions(
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        scope_user_id=scope,
    )
    return SessionListResponse(
        items=[_serialize_session(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
) -> SessionResponse:
    training = await TrainingSessionRepository(session).get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    return _serialize_session(training)


async def create_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    payload: CreateSessionRequest,
) -> SessionResponse:
    if payload.team_id is not None:
        if is_platform_admin(user):
            team = await TeamRepository(session).get_by_id(payload.team_id)
            if team is None or not team.is_active:
                raise ValidationError("Team not found or inactive")
        else:
            await assert_team_assignable_for_actor(session, user, payload.team_id)

    for player_id in payload.player_ids:
        await assert_can_access_player(session, user, player_id)

    await _validate_exercises(session, payload.exercise_ids)

    repo = TrainingSessionRepository(session)
    year = datetime.now(UTC).year
    title = await SessionNameCounterRepository(session).next_title(year)
    code = await _unique_code(repo)

    training = TrainingSession(
        title=title,
        session_code=code,
        created_by=user.id,
        team_id=payload.team_id,
        status=SessionStatus.DRAFT,
    )
    await repo.add(training)

    for player_id in payload.player_ids:
        session.add(
            SessionPlayer(
                session_id=training.id,
                player_id=player_id,
                status=SessionPlayerStatus.JOINED,
            )
        )
    await SessionExerciseRepository(session).replace_for_session(
        training.id,
        payload.exercise_ids,
    )
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)


async def add_players(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
    payload: AddSessionPlayersRequest,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) != SessionStatus.DRAFT.value:
        raise ValidationError("Participants can only be changed while draft")

    existing = {
        sp.player_id
        for sp in training.players
        if _enum_value(sp.status) != SessionPlayerStatus.WITHDRAWN.value
    }
    for player_id in payload.player_ids:
        await assert_can_access_player(session, user, player_id)
        if player_id in existing:
            raise ConflictError("Player is already registered in this session")
        session.add(
            SessionPlayer(
                session_id=training.id,
                player_id=player_id,
                status=SessionPlayerStatus.JOINED,
            )
        )
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)


async def remove_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
    player_id: uuid.UUID,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) != SessionStatus.DRAFT.value:
        raise ValidationError("Participants can only be changed while draft")

    sp_repo = SessionPlayerRepository(session)
    row = await sp_repo.get(session_id=session_id, player_id=player_id)
    if row is None or _enum_value(row.status) == SessionPlayerStatus.WITHDRAWN.value:
        raise NotFoundError("Participant not found")

    attempt_count = await sp_repo.count_attempts(row.id)
    training_id = training.id
    if attempt_count > 0:
        row.status = SessionPlayerStatus.WITHDRAWN
    else:
        # Remove from relationship collection to avoid delete-orphan resurrection.
        training.players.remove(row)
        await session.delete(row)

    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training_id)
    assert loaded is not None
    return _serialize_session(loaded)


async def replace_exercises(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
    payload: ReplaceSessionExercisesRequest,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) != SessionStatus.DRAFT.value:
        raise ValidationError("Exercises can only be changed while draft")

    await _validate_exercises(session, payload.exercise_ids)
    training_id = training.id
    # Clear via relationship so cascade delete-orphan does not resurrect rows.
    training.exercises.clear()
    await session.flush()
    for index, test_id in enumerate(payload.exercise_ids):
        training.exercises.append(
            SessionExercise(
                session_id=training_id,
                cognitive_test_id=test_id,
                display_order=index,
            )
        )
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training_id)
    assert loaded is not None
    return _serialize_session(loaded)


async def start_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) != SessionStatus.DRAFT.value:
        raise ValidationError("Only draft sessions can be started")
    active_players = [
        p for p in training.players if _enum_value(p.status) != SessionPlayerStatus.WITHDRAWN.value
    ]
    if not active_players:
        raise ValidationError("Cannot start a session without participants")
    if not training.exercises:
        raise ValidationError("Cannot start a session without exercises")
    training.status = SessionStatus.IN_PROGRESS
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)


async def complete_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) != SessionStatus.IN_PROGRESS.value:
        raise ValidationError("Only in-progress sessions can be completed")
    training.status = SessionStatus.COMPLETED
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)


async def cancel_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) not in {
        SessionStatus.DRAFT.value,
        SessionStatus.IN_PROGRESS.value,
    }:
        raise ValidationError("Only draft or in-progress sessions can be cancelled")
    training.status = SessionStatus.CANCELLED
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)


async def rotate_session_code(
    session: AsyncSession,
    user: AuthenticatedUser,
    session_id: uuid.UUID,
) -> SessionResponse:
    repo = TrainingSessionRepository(session)
    training = await repo.get_by_id(session_id)
    if training is None:
        raise NotFoundError("Session not found")
    await _assert_can_view_session(session, user, training)
    if _enum_value(training.status) not in {
        SessionStatus.DRAFT.value,
        SessionStatus.IN_PROGRESS.value,
    }:
        raise ValidationError("Session code can only be rotated while draft or in progress")
    training.session_code = await _unique_code(repo)
    training.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(training.id)
    assert loaded is not None
    return _serialize_session(loaded)
