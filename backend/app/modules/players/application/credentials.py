"""One-time player access-code generation (plaintext never persisted)."""

from __future__ import annotations

import secrets

from app.core.security import hash_secret

# Unambiguous letters/digits for verbal recall (no I/O/0/1).
_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_DIGITS = "23456789"


def generate_access_code() -> str:
    """Memorable staff-facing code: 3 letters + 3 digits (e.g. KLM472)."""
    letters = "".join(secrets.choice(_LETTERS) for _ in range(3))
    digits = "".join(secrets.choice(_DIGITS) for _ in range(3))
    return f"{letters}{digits}"


def normalize_access_code(raw: str) -> str:
    """Strip separators and uppercase so players can type casually."""
    return raw.strip().upper().replace(" ", "").replace("-", "")


def hash_access_code(code: str) -> str:
    return hash_secret(normalize_access_code(code))
