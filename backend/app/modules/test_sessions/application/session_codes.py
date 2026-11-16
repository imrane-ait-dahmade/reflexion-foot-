"""Verbal session access-code generation (temporary, unique plaintext)."""

from __future__ import annotations

import secrets

# Unambiguous alphabet (no I/O/0/1).
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


def generate_session_code(length: int = _CODE_LENGTH) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def normalize_session_code(raw: str) -> str:
    return raw.strip().upper().replace(" ", "").replace("-", "")
