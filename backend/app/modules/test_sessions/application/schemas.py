"""Pydantic schemas for training sessions APIs."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

SessionStatusValue = Literal["draft", "in_progress", "completed", "cancelled"]
SessionPlayerStatusValue = Literal["joined", "in_progress", "completed", "withdrawn"]
AttemptStatusValue = Literal["in_progress", "completed", "abandoned"]


class CognitiveTestResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    category: str
    is_active: bool

    model_config = {"from_attributes": True}


class SessionExerciseResponse(BaseModel):
    id: uuid.UUID
    cognitive_test_id: uuid.UUID
    display_order: int
    cognitive_test: CognitiveTestResponse | None = None


class SessionParticipantProgress(BaseModel):
    completed_exercises: int = 0
    total_exercises: int = 0
    current_display_order: int | None = None


class SessionParticipantResponse(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None
    status: SessionPlayerStatusValue
    joined_at: datetime
    progress: SessionParticipantProgress | None = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    session_code: str | None = None
    status: SessionStatusValue
    team_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    players: list[SessionParticipantResponse] = Field(default_factory=list)
    exercises: list[SessionExerciseResponse] = Field(default_factory=list)


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
    page: int
    page_size: int


class CreateSessionRequest(BaseModel):
    player_ids: list[uuid.UUID] = Field(min_length=1)
    exercise_ids: list[uuid.UUID] = Field(min_length=1)
    team_id: uuid.UUID | None = None

    @field_validator("player_ids", "exercise_ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate ids are not allowed")
        return value


class AddSessionPlayersRequest(BaseModel):
    player_ids: list[uuid.UUID] = Field(min_length=1)

    @field_validator("player_ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate ids are not allowed")
        return value


class ReplaceSessionExercisesRequest(BaseModel):
    exercise_ids: list[uuid.UUID] = Field(min_length=1)

    @field_validator("exercise_ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate ids are not allowed")
        return value


class PlayerJoinRequest(BaseModel):
    personal_code: str = Field(min_length=4, max_length=128)
    session_code: str = Field(min_length=4, max_length=32)


class PlayerJoinResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: uuid.UUID
    player_id: uuid.UUID
    session_player_id: uuid.UUID
    session_title: str


class PlayerExerciseProgressItem(BaseModel):
    session_exercise_id: uuid.UUID
    cognitive_test_id: uuid.UUID
    display_order: int
    slug: str
    name: str
    attempt_status: AttemptStatusValue | None = None
    completed: bool = False


class PlayerSessionProgressResponse(BaseModel):
    session_id: uuid.UUID
    session_title: str
    session_status: SessionStatusValue
    participation_status: SessionPlayerStatusValue
    current_display_order: int | None
    exercises: list[PlayerExerciseProgressItem]
    completed_count: int
    remaining_count: int


class CompleteExerciseRequest(BaseModel):
    score: int = Field(ge=0, le=100)
    accuracy: Decimal = Field(ge=0, le=100)
    response_time_ms: int = Field(ge=0)
    result_data: dict[str, Any] = Field(default_factory=dict)
