"""AI report generation, persistence, and retrieval (V2 source of truth)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.ai_analysis.application.config import (
    PROMPT_VERSION,
    estimate_cost_usd,
    load_ai_settings,
)
from app.modules.ai_analysis.application.context_builder import (
    allowed_metric_keys,
    load_player_attempt_bundle,
    load_session_group_bundle,
)
from app.modules.ai_analysis.application import openai_provider
from app.modules.ai_analysis.application.safeguards import (
    abstention_report,
    validate_scientific_safeguards,
)
from app.modules.ai_analysis.application.schemas import (
    AiReportListResponse,
    AiReportResponse,
    GenerateReportRequest,
)
from app.modules.ai_analysis.infrastructure.models import AiReport
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.test_sessions.application import session_service
from app.shared.infrastructure.database.enums import AiReportType


def _to_response(row: AiReport) -> AiReportResponse:
    return AiReportResponse.model_validate(row)


def _persist_row(
    *,
    report_type: AiReportType,
    session_player_id: uuid.UUID | None,
    training_session_id: uuid.UUID,
    content: dict[str, Any],
    source_attempt_ids: list[str],
    focus_test_slug: str | None,
    model_name: str | None,
    input_tokens: int,
    output_tokens: int,
    cost: float,
) -> AiReport:
    return AiReport(
        report_type=report_type,
        session_player_id=session_player_id,
        training_session_id=training_session_id,
        report_data={
            **content,
            "focus_test_slug": focus_test_slug,
            "source_attempt_ids": source_attempt_ids,
            "token_usage": {"input": input_tokens, "output": output_tokens},
            "estimated_cost_usd": cost,
        },
        model_name=model_name,
        prompt_version=PROMPT_VERSION,
    )


async def list_reports_for_session(
    session: AsyncSession,
    user: AuthenticatedUser,
    training_session_id: uuid.UUID,
) -> AiReportListResponse:
    await session_service.get_session(session, user, training_session_id)
    rows = list(
        (
            await session.scalars(
                select(AiReport)
                .where(AiReport.training_session_id == training_session_id)
                .order_by(AiReport.created_at.desc())
            )
        ).all()
    )
    return AiReportListResponse(items=[_to_response(r) for r in rows], total=len(rows))


async def get_report(
    session: AsyncSession,
    user: AuthenticatedUser,
    report_id: uuid.UUID,
) -> AiReportResponse:
    row = await session.get(AiReport, report_id)
    if row is None:
        raise NotFoundError("Report not found")
    if row.training_session_id is not None:
        await session_service.get_session(session, user, row.training_session_id)
    return _to_response(row)


async def _generate_from_provider(
    *,
    context: dict[str, Any],
    report_type: str,
) -> tuple[dict[str, Any], str, int, int, float]:
    settings = load_ai_settings()
    if not settings.enabled:
        content = abstention_report(reason="ai_provider_disabled", report_type=report_type)
        return content, "", 0, 0, 0.0

    generated = await openai_provider.generate_structured_report(
        context=context,
        settings=settings,
    )
    content = generated["content"]
    if not isinstance(content, dict):
        raise ValidationError("invalid_model_json")
    content.setdefault("report_type", report_type)
    content["status"] = "ready"
    safeguard = validate_scientific_safeguards(content)
    if safeguard:
        raise ValidationError(f"safeguard_rejected:{safeguard}")
    cost = estimate_cost_usd(
        generated["input_tokens"],
        generated["output_tokens"],
        settings,
    )
    return content, generated["model"], generated["input_tokens"], generated["output_tokens"], cost


async def generate_group_report(
    session: AsyncSession,
    user: AuthenticatedUser,
    payload: GenerateReportRequest,
) -> AiReportResponse:
    if payload.training_session_id is None:
        raise ValidationError("training_session_id is required for group reports")

    training_session_id = payload.training_session_id
    await session_service.get_session(session, user, training_session_id)

    bundle = await load_session_group_bundle(session, training_session_id=training_session_id)
    if bundle is None:
        raise NotFoundError("Session not found")

    report_type = AiReportType.GROUP
    source_attempt_ids = list(bundle["source_attempt_ids"])

    if not payload.force:
        existing = await session.scalar(
            select(AiReport)
            .where(
                AiReport.training_session_id == training_session_id,
                AiReport.report_type == report_type,
                AiReport.session_player_id.is_(None),
            )
            .order_by(AiReport.created_at.desc())
            .limit(1)
        )
        if existing is not None:
            data = existing.report_data if isinstance(existing.report_data, dict) else {}
            if set(data.get("source_attempt_ids") or []) == set(source_attempt_ids) and data.get(
                "status"
            ) in {"ready", "abstained"}:
                raise ConflictError("Report already exists for these attempts")

    finished = bundle["finished_players"]
    if not finished:
        content = abstention_report(
            reason="no_finished_players",
            report_type="group",
        )
        row = _persist_row(
            report_type=report_type,
            session_player_id=None,
            training_session_id=training_session_id,
            content=content,
            source_attempt_ids=source_attempt_ids,
            focus_test_slug=None,
            model_name=None,
            input_tokens=0,
            output_tokens=0,
            cost=0.0,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _to_response(row)

    # Privacy: only finished players' aggregate scores in the model payload.
    context: dict[str, Any] = {
        "prompt_version": PROMPT_VERSION,
        "report_type": "group",
        "session_title": bundle["session_title"],
        "tests": [],
        "group_players": [
            {
                "display_name": p["display_name"],
                "finished": True,
                "tests": p["tests"],
            }
            for p in finished
        ],
        "allowed_metric_keys": ["score", "accuracy", "test_slug"],
        "focus_test_slug": None,
    }
    content, model, in_tok, out_tok, cost = await _generate_from_provider(
        context=context,
        report_type="group",
    )
    row = _persist_row(
        report_type=report_type,
        session_player_id=None,
        training_session_id=training_session_id,
        content=content,
        source_attempt_ids=source_attempt_ids,
        focus_test_slug=None,
        model_name=model or None,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cost=cost,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_response(row)


async def generate_report(
    session: AsyncSession,
    user: AuthenticatedUser,
    payload: GenerateReportRequest,
) -> AiReportResponse:
    if payload.report_type == "group":
        return await generate_group_report(session, user, payload)

    if payload.report_type not in {"test", "session", "progress"}:
        raise ValidationError("Unsupported report type")

    if payload.session_player_id is None:
        raise ValidationError("session_player_id is required")

    bundle = await load_player_attempt_bundle(session, session_player_id=payload.session_player_id)
    if bundle is None:
        raise NotFoundError("Session player not found")

    training_session_id = uuid.UUID(bundle["training_session_id"])
    await session_service.get_session(session, user, training_session_id)

    if payload.training_session_id and payload.training_session_id != training_session_id:
        raise ValidationError("session_player does not belong to training_session")

    tests = bundle["tests"]
    if payload.focus_test_slug:
        tests = [t for t in tests if t["test_slug"] == payload.focus_test_slug]

    report_type = AiReportType(payload.report_type)

    if not payload.force:
        existing = await session.scalar(
            select(AiReport)
            .where(
                AiReport.session_player_id == payload.session_player_id,
                AiReport.report_type == report_type,
            )
            .order_by(AiReport.created_at.desc())
            .limit(1)
        )
        if existing is not None:
            data = existing.report_data if isinstance(existing.report_data, dict) else {}
            same_focus = data.get("focus_test_slug") == payload.focus_test_slug
            same_attempts = set(data.get("source_attempt_ids") or []) == set(
                bundle["source_attempt_ids"]
            )
            if same_focus and same_attempts and data.get("status") in {"ready", "abstained"}:
                raise ConflictError("Report already exists for these attempts")

    source_attempt_ids = [t["attempt_id"] for t in tests] or bundle["source_attempt_ids"]

    if not tests:
        content = abstention_report(
            reason="no_completed_attempts",
            report_type=payload.report_type,
        )
        row = _persist_row(
            report_type=report_type,
            session_player_id=payload.session_player_id,
            training_session_id=training_session_id,
            content=content,
            source_attempt_ids=source_attempt_ids,
            focus_test_slug=payload.focus_test_slug,
            model_name=None,
            input_tokens=0,
            output_tokens=0,
            cost=0.0,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _to_response(row)

    context: dict[str, Any] = {
        "prompt_version": PROMPT_VERSION,
        "report_type": payload.report_type,
        "tests": tests,
        "focus_test_slug": payload.focus_test_slug,
        "allowed_metric_keys": allowed_metric_keys(tests),
        "session_title": bundle["session_title"],
    }
    content, model, in_tok, out_tok, cost = await _generate_from_provider(
        context=context,
        report_type=payload.report_type,
    )
    row = _persist_row(
        report_type=report_type,
        session_player_id=payload.session_player_id,
        training_session_id=training_session_id,
        content=content,
        source_attempt_ids=source_attempt_ids,
        focus_test_slug=payload.focus_test_slug,
        model_name=model or None,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cost=cost,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_response(row)
