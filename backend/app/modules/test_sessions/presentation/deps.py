"""Dependencies for player-facing session access."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthenticationError
from app.modules.test_sessions.application.player_access_service import parse_player_token

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class PlayerSessionPrincipal:
    player_id: uuid.UUID
    session_id: uuid.UUID
    session_player_id: uuid.UUID


async def get_player_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> PlayerSessionPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing bearer token")
    player_id, session_id, session_player_id = parse_player_token(credentials.credentials)
    return PlayerSessionPrincipal(
        player_id=player_id,
        session_id=session_id,
        session_player_id=session_player_id,
    )
