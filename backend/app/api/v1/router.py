"""API v1 router aggregate."""

from fastapi import APIRouter

from app.modules.ai_analysis.presentation.router import ai_reports_router
from app.modules.cognitive_engines.presentation.router import player_exercises_router
from app.modules.identity.presentation.router import auth_router, users_router
from app.modules.players.presentation.router import players_router, positions_router
from app.modules.teams.presentation.router import teams_router
from app.modules.test_sessions.presentation.player_router import player_session_router
from app.modules.test_sessions.presentation.router import (
    cognitive_tests_router,
    sessions_router,
)

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(players_router)
api_router.include_router(positions_router)
api_router.include_router(teams_router)
api_router.include_router(sessions_router)
api_router.include_router(cognitive_tests_router)
api_router.include_router(player_session_router)
api_router.include_router(player_exercises_router)
api_router.include_router(ai_reports_router)
