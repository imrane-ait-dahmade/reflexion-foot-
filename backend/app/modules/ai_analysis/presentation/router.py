"""Coach-facing AI report endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_analysis.application import report_service
from app.modules.ai_analysis.application.schemas import (
    AiReportListResponse,
    AiReportResponse,
    GenerateReportRequest,
)
from app.modules.identity.presentation.deps import (
    AuthenticatedUser,
    require_permissions,
)
from app.shared.infrastructure.database.session import get_db

ai_reports_router = APIRouter(prefix="/ai/reports", tags=["ai-reports"])


@ai_reports_router.get(
    "/sessions/{training_session_id}",
    response_model=AiReportListResponse,
)
async def list_session_reports(
    training_session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("results.view")),
) -> AiReportListResponse:
    return await report_service.list_reports_for_session(
        session, current, training_session_id
    )


@ai_reports_router.get("/{report_id}", response_model=AiReportResponse)
async def get_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("results.view")),
) -> AiReportResponse:
    return await report_service.get_report(session, current, report_id)


@ai_reports_router.post("", response_model=AiReportResponse)
async def generate_report(
    payload: GenerateReportRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("ai.generate")),
) -> AiReportResponse:
    return await report_service.generate_report(session, current, payload)
