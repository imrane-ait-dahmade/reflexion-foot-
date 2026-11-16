"""Argon2id hashing helpers."""

from app.core.security import hash_secret, needs_rehash, verify_secret


def test_hash_and_verify_password() -> None:
    hashed = hash_secret("coach-password-123")
    assert hashed.startswith("$argon2id$")
    assert verify_secret(hashed, "coach-password-123") is True
    assert verify_secret(hashed, "wrong") is False


def test_hash_player_access_code_never_plaintext() -> None:
    code = "PLAYER-ACCESS-9K2M"
    hashed = hash_secret(code)
    assert code not in hashed
    assert verify_secret(hashed, code) is True


def test_generate_access_code_is_three_letters_three_digits() -> None:
    from app.modules.players.application.credentials import (
        generate_access_code,
        hash_access_code,
        normalize_access_code,
    )

    code = generate_access_code()
    assert len(code) == 6
    assert code[:3].isalpha() and code[:3].isupper()
    assert code[3:].isdigit()
    assert normalize_access_code("kl m-472") == "KLM472"
    hashed = hash_access_code(code)
    assert verify_secret(hashed, normalize_access_code(code)) is True
    assert verify_secret(hashed, normalize_access_code(code.lower())) is True


def test_empty_secret_rejected() -> None:
    try:
        hash_secret("")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


def test_needs_rehash_on_valid_hash() -> None:
    hashed = hash_secret("abc12345")
    assert needs_rehash(hashed) is False
