"""Unit tests for AI scientific safeguards and abstention."""

from app.modules.ai_analysis.application.safeguards import (
    abstention_report,
    validate_scientific_safeguards,
)


def test_abstention_has_limitations_and_bilingual_summary() -> None:
    report = abstention_report(reason="no_completed_attempts", report_type="session")
    assert report["status"] == "abstained"
    assert report["confidence"] == "low"
    assert validate_scientific_safeguards(report) is None


def test_forbidden_clinical_language_rejected() -> None:
    report = abstention_report(reason="x", report_type="test")
    report["fr"]["executive_summary"] = "Possible ADHD diagnosis from reaction times."
    assert validate_scientific_safeguards(report) == "forbidden_clinical_language"


def test_missing_limitations_rejected() -> None:
    report = abstention_report(reason="x", report_type="test")
    report["fr"]["limitations"] = []
    assert validate_scientific_safeguards(report) == "missing_limitations"
