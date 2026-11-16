"""AI report API schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ReportTypeValue = Literal["test", "session", "progress", "group"]


class GenerateReportRequest(BaseModel):
    report_type: ReportTypeValue
    session_player_id: uuid.UUID | None = None
    training_session_id: uuid.UUID | None = None
    focus_test_slug: str | None = Field(default=None, max_length=64)
    force: bool = False


class AiReportResponse(BaseModel):
    id: uuid.UUID
    report_type: ReportTypeValue
    session_player_id: uuid.UUID | None
    training_session_id: uuid.UUID | None
    report_data: dict[str, Any]
    model_name: str | None
    prompt_version: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AiReportListResponse(BaseModel):
    items: list[AiReportResponse]
    total: int
