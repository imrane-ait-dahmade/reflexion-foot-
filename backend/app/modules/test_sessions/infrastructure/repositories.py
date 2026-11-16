"""SQLAlchemy repositories for training sessions."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.cognitive_tests.infrastructure.models import SessionExercise
from app.modules.results.infrastructure.models import TestAttempt
from app.modules.teams.infrastructure.models import TeamPlayer, TeamStaff
from app.modules.test_sessions.infrastructure.models import (
    SessionNameCounter,
    SessionPlayer,
    TrainingSession,
)
from app.shared.infrastructure.database.enums import SessionPlayerStatus, SessionStatus
from app.shared.infrastructure.database.models import import_all_models

import_all_models()


def _session_load_options():
    return (
        selectinload(TrainingSession.players).selectinload(SessionPlayer.player),
        selectinload(TrainingSession.players)
        .selectinload(SessionPlayer.attempts)
        .selectinload(TestAttempt.result),
        selectinload(TrainingSession.exercises).selectinload(SessionExercise.cognitive_test),
    )


class SessionNameCounterRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def next_title(self, year: int) -> str:
        stmt = select(SessionNameCounter).where(SessionNameCounter.year == year).with_for_update()
        counter = await self._session.scalar(stmt)
        if counter is None:
            counter = SessionNameCounter(year=year, last_value=0)
            self._session.add(counter)
            await self._session.flush()
            # Re-lock the inserted row
            counter = await self._session.scalar(stmt)
            assert counter is not None
        counter.last_value += 1
        await self._session.flush()
        return f"Session #{year}-{counter.last_value:03d}"


class TrainingSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, session_id: uuid.UUID) -> TrainingSession | None:
        stmt = (
            select(TrainingSession)
            .where(TrainingSession.id == session_id)
            .options(*_session_load_options())
        )
        return await self._session.scalar(stmt)

    async def get_by_code(self, code: str) -> TrainingSession | None:
        stmt = (
            select(TrainingSession)
            .where(TrainingSession.session_code == code)
            .options(*_session_load_options())
        )
        return await self._session.scalar(stmt)

    async def code_exists(self, code: str) -> bool:
        return (
            await self._session.scalar(
                select(TrainingSession.id).where(TrainingSession.session_code == code)
            )
            is not None
        )

    async def add(self, training: TrainingSession) -> TrainingSession:
        self._session.add(training)
        await self._session.flush()
        return training

    def _scope_filter(self, user_id: uuid.UUID):
        visible_players = (
            select(TeamPlayer.player_id)
            .join(
                TeamStaff,
                and_(
                    TeamStaff.team_id == TeamPlayer.team_id,
                    TeamStaff.user_id == user_id,
                    TeamStaff.is_active.is_(True),
                ),
            )
            .where(TeamPlayer.is_active.is_(True))
        )
        active_teams = select(TeamStaff.team_id).where(
            TeamStaff.user_id == user_id,
            TeamStaff.is_active.is_(True),
        )
        participant_match = exists(
            select(SessionPlayer.id).where(
                SessionPlayer.session_id == TrainingSession.id,
                SessionPlayer.player_id.in_(visible_players),
                SessionPlayer.status != SessionPlayerStatus.WITHDRAWN,
            )
        )
        return or_(
            TrainingSession.created_by == user_id,
            TrainingSession.team_id.in_(active_teams),
            participant_match,
        )

    async def list_sessions(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        status: SessionStatus | None = None,
        scope_user_id: uuid.UUID | None = None,
    ) -> tuple[list[TrainingSession], int]:
        filters = []
        if scope_user_id is not None:
            filters.append(self._scope_filter(scope_user_id))
        if search:
            term = f"%{search.strip().lower()}%"
            filters.append(func.lower(TrainingSession.title).like(term))
        if status is not None:
            filters.append(TrainingSession.status == status)

        where_clause = and_(*filters) if filters else True
        total = int(
            await self._session.scalar(
                select(func.count()).select_from(TrainingSession).where(where_clause)
            )
            or 0
        )
        stmt = (
            select(TrainingSession)
            .where(where_clause)
            .options(*_session_load_options())
            .order_by(TrainingSession.created_at.desc(), TrainingSession.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self._session.scalars(stmt)).all()), total


class SessionPlayerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(
        self,
        *,
        session_id: uuid.UUID,
        player_id: uuid.UUID,
    ) -> SessionPlayer | None:
        return await self._session.scalar(
            select(SessionPlayer)
            .where(
                SessionPlayer.session_id == session_id,
                SessionPlayer.player_id == player_id,
            )
            .options(
                selectinload(SessionPlayer.attempts).selectinload(TestAttempt.result),
                selectinload(SessionPlayer.player),
            )
        )

    async def add(self, row: SessionPlayer) -> SessionPlayer:
        self._session.add(row)
        await self._session.flush()
        return row

    async def delete(self, row: SessionPlayer) -> None:
        await self._session.delete(row)
        await self._session.flush()

    async def count_attempts(self, session_player_id: uuid.UUID) -> int:
        return int(
            await self._session.scalar(
                select(func.count())
                .select_from(TestAttempt)
                .where(TestAttempt.session_player_id == session_player_id)
            )
            or 0
        )


class SessionExerciseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def replace_for_session(
        self,
        session_id: uuid.UUID,
        exercise_ids: list[uuid.UUID],
    ) -> list[SessionExercise]:
        await self._session.execute(
            delete(SessionExercise).where(SessionExercise.session_id == session_id)
        )
        await self._session.flush()
        rows: list[SessionExercise] = []
        for index, test_id in enumerate(exercise_ids):
            row = SessionExercise(
                session_id=session_id,
                cognitive_test_id=test_id,
                display_order=index,
            )
            self._session.add(row)
            rows.append(row)
        await self._session.flush()
        return rows

    async def get_by_id(
        self,
        session_exercise_id: uuid.UUID,
    ) -> SessionExercise | None:
        return await self._session.scalar(
            select(SessionExercise)
            .where(SessionExercise.id == session_exercise_id)
            .options(selectinload(SessionExercise.cognitive_test))
        )
