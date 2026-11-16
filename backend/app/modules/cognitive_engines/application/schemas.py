"""Request/response schemas for challenge engines."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class DigitMemoryRequest(BaseModel):
    action: Literal["start", "digit", "answer"]
    token: str | None = None
    answer: list[int] | None = None


class DualTargetRequest(BaseModel):
    action: Literal["start", "submit"]
    token: str | None = None
    selected: list[int] | None = None


class ObservationCompleteRequest(BaseModel):
    score: int = Field(ge=0, le=100)
    accuracy: float = Field(ge=0, le=100)
    response_time_ms: int = Field(ge=0)
    correct_answers: int = Field(default=0, ge=0)
    errors: int = Field(default=0, ge=0)
    average_reaction_ms: int = Field(default=0, ge=0)
    best_reaction_ms: int = Field(default=0, ge=0)
    duration_ms: int = Field(default=0, ge=0)
    metrics: dict[str, Any] = Field(default_factory=dict)
