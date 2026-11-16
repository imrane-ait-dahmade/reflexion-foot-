"""Integrity tests for V2 SQLAlchemy schema (metadata only — no production DB)."""

from sqlalchemy import UniqueConstraint
from sqlalchemy.schema import Index

from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.models import V2_TABLES, import_all_models
from app.shared.infrastructure.database.seeds import (
    COGNITIVE_TEST_SEEDS,
    POSITION_SEEDS,
    ROLE_SEEDS,
)


def _tables():
    import_all_models()
    return Base.metadata.tables


def test_expected_v2_models_are_registered() -> None:
    models = import_all_models()
    assert {m.__tablename__ for m in models} == set(V2_TABLES)
    assert set(_tables().keys()) == set(V2_TABLES)


def test_primary_keys_exist() -> None:
    tables = _tables()
    for name in V2_TABLES:
        assert "id" in tables[name].primary_key.columns or name in {
            "user_roles",
            "role_permissions",
            "player_secondary_positions",
            "session_name_counters",
        }


def test_composite_primary_keys_for_associations() -> None:
    tables = _tables()
    assert set(tables["user_roles"].primary_key.columns.keys()) == {
        "user_id",
        "role_id",
    }
    assert set(tables["role_permissions"].primary_key.columns.keys()) == {
        "role_id",
        "permission_id",
    }


def test_foreign_keys_core_graph() -> None:
    tables = _tables()

    def refs(table: str, col: str) -> set[str]:
        out: set[str] = set()
        for fk in tables[table].foreign_key_constraints:
            if col in fk.column_keys:
                for e in fk.elements:
                    out.add(e.column.table.name)
        return out

    assert refs("training_sessions", "created_by") == {"users"}
    assert refs("session_players", "session_id") == {"training_sessions"}
    assert refs("session_players", "player_id") == {"players"}
    assert refs("players", "primary_position_id") == {"positions"}
    assert refs("player_secondary_positions", "player_id") == {"players"}
    assert refs("player_secondary_positions", "position_id") == {"positions"}
    assert refs("player_notes", "player_id") == {"players"}
    assert refs("player_notes", "author_user_id") == {"users"}
    assert refs("player_credentials", "player_id") == {"players"}
    assert refs("team_staff", "team_id") == {"teams"}
    assert refs("team_staff", "user_id") == {"users"}
    assert refs("team_players", "team_id") == {"teams"}
    assert refs("team_players", "player_id") == {"players"}
    assert refs("session_exercises", "session_id") == {"training_sessions"}
    assert refs("session_exercises", "cognitive_test_id") == {"cognitive_tests"}
    assert refs("test_attempts", "session_player_id") == {"session_players"}
    assert refs("test_attempts", "session_exercise_id") == {"session_exercises"}
    assert refs("test_results", "attempt_id") == {"test_attempts"}
    assert refs("ai_reports", "session_player_id") == {"session_players"}
    assert refs("ai_reports", "training_session_id") == {"training_sessions"}


def test_unique_constraints_for_product_rules() -> None:
    tables = _tables()

    assert tables["users"].c.email.unique is True
    assert tables["roles"].c.name.unique is True
    assert tables["permissions"].c.code.unique is True
    assert tables["positions"].c.code.unique is True
    assert tables["cognitive_tests"].c.slug.unique is True
    assert tables["training_sessions"].c.session_code.unique is True
    assert tables["test_results"].c.attempt_id.unique is True

    attempt_ucs = {
        uc.name for uc in tables["test_attempts"].constraints if isinstance(uc, UniqueConstraint)
    }
    assert "test_attempts_one_per_exercise_uidx" in attempt_ucs

    sp_ucs = {
        uc.name for uc in tables["session_players"].constraints if isinstance(uc, UniqueConstraint)
    }
    assert "session_players_session_player_uidx" in sp_ucs

    cred_indexes = {
        idx.name
        for idx in tables["player_credentials"].indexes
        if isinstance(idx, Index) and idx.unique
    }
    assert "player_credentials_active_player_uidx" in cred_indexes


def test_metadata_sort_order_is_consistent() -> None:
    import_all_models()
    names = [t.name for t in Base.metadata.sorted_tables]
    assert names.index("users") < names.index("training_sessions")
    assert names.index("players") < names.index("session_players")
    assert names.index("cognitive_tests") < names.index("session_exercises")
    assert names.index("test_attempts") < names.index("test_results")


def test_no_v1_only_columns_on_users() -> None:
    users = _tables()["users"]
    assert "auth_user_id" not in users.c
    assert "display_name" not in users.c
    assert "full_name" in users.c
    assert "password_hash" in users.c
    assert "is_active" in users.c


def test_refresh_tokens_table_registered() -> None:
    tables = _tables()
    assert "refresh_tokens" in tables
    rt = tables["refresh_tokens"]
    assert "token_hash" in rt.c
    assert rt.c.token_hash.unique is True


def test_seed_catalog_matches_expected_counts() -> None:
    assert {r.name for r in ROLE_SEEDS} == {"admin", "coach", "staff"}
    assert "player" not in {r.name for r in ROLE_SEEDS}
    assert len(POSITION_SEEDS) == 10
    assert [p.code for p in POSITION_SEEDS] == [
        "GK",
        "CB",
        "LB",
        "RB",
        "CDM",
        "CM",
        "CAM",
        "LW",
        "RW",
        "ST",
    ]
    assert len(COGNITIVE_TEST_SEEDS) == 8
    assert COGNITIVE_TEST_SEEDS[0].slug == "visual-tracking"
    assert COGNITIVE_TEST_SEEDS[4].name == "Lecture du jeu"
