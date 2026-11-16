"""Scientific / coaching safeguards for AI report content."""

from __future__ import annotations

import re
from typing import Any

# Forbidden clinical / diagnostic language (FR + EN stems).
_FORBIDDEN = re.compile(
    r"\b("
    r"diagnos(?:e|is|tic)|disorder|psychopatholog|"
    r"depression|anxiety\s+disorder|adhd|autism|"
    r"intelligence\s+quotient|\biq\b|mental\s+illness|"
    r"maladie\s+mentale|trouble\s+psychiatrique|déficit\s+intellectuel|"
    r"diagnostic\s+clinique|psychologue\s+clinicien"
    r")\b",
    re.IGNORECASE,
)


def text_blobs(report: dict[str, Any]) -> list[str]:
    blobs: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, str):
            blobs.append(node)
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(report)
    return blobs


def validate_scientific_safeguards(report: dict[str, Any]) -> str | None:
    """Return an error code if content violates coaching-only constraints."""
    for blob in text_blobs(report):
        if _FORBIDDEN.search(blob):
            return "forbidden_clinical_language"
    fr = report.get("fr") if isinstance(report.get("fr"), dict) else {}
    ar = report.get("ar") if isinstance(report.get("ar"), dict) else {}
    if not fr.get("executive_summary") or not ar.get("executive_summary"):
        return "missing_language"
    limitations = fr.get("limitations") or []
    if not isinstance(limitations, list) or len(limitations) < 1:
        return "missing_limitations"
    return None


def abstention_report(*, reason: str, report_type: str) -> dict[str, Any]:
    """Structured abstention when data is insufficient — never invent results."""
    message_fr = (
        "Données insuffisantes pour produire une analyse fiable. "
        f"Raison : {reason}. Aucune conclusion n'est formulée."
    )
    message_ar = (
        "البيانات غير كافية لإصدار تحليل موثوق. "
        f"السبب: {reason}. لم تُصغ أي استنتاجات."
    )
    empty: list[Any] = []
    return {
        "report_type": report_type,
        "confidence": "low",
        "confidence_reason": reason,
        "status": "abstained",
        "fr": {
            "executive_summary": message_fr,
            "what_was_assessed": "Aucune analyse n'a été réalisée faute de résultats complets.",
            "performance_observations": empty,
            "strengths": empty,
            "development_areas": empty,
            "training_recommendations": empty,
            "coach_action_plan": [
                "Collecter au moins un résultat d'exercice validé avant de régénérer le rapport."
            ],
            "limitations": [
                "Abstention volontaire : pas assez de données observées.",
                "Ceci n'est pas un test médical ou psychologique.",
            ],
        },
        "ar": {
            "executive_summary": message_ar,
            "what_was_assessed": "لم يُجرَ أي تحليل بسبب نقص النتائج المكتملة.",
            "performance_observations": empty,
            "strengths": empty,
            "development_areas": empty,
            "training_recommendations": empty,
            "coach_action_plan": [
                "اجمع نتيجة تمرين واحدة على الأقل قبل إعادة إنشاء التقرير."
            ],
            "limitations": [
                "امتناع متعمد: بيانات غير كافية.",
                "هذا ليس اختباراً طبياً أو نفسياً.",
            ],
        },
    }
