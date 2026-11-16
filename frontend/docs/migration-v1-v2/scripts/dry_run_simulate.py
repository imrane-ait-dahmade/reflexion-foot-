"""
Read-only V1→V2 migration dry-run.

- SELECT only (no INSERT/UPDATE/DELETE).
- Never prints passwords or connection secrets.
- Writes reconciliation JSON under docs/migration-v1-v2/runs/<stamp>/.

Usage (from repo, with env files present):
  backend/.venv/Scripts/python.exe frontend/docs/migration-v1-v2/scripts/dry_run_simulate.py
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    import psycopg
except ImportError:  # pragma: no cover
    print("psycopg required: pip install 'psycopg[binary]'", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[4]  # football-vision-test
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
RUNS = FRONTEND / "docs" / "migration-v1-v2" / "runs"


def load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def normalize_db_url(url: str) -> str:
    url = url.strip()
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    url = url.replace("postgres://", "postgresql://", 1)
    # asyncpg uses ssl=require; psycopg wants sslmode=require
    url = re.sub(r"([?&])ssl=require", r"\1sslmode=require", url)
    if "sslmode=" not in url and "ssl=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def identity_from_url(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    db = unquote(parsed.path.lstrip("/").split("?")[0])
    user = unquote(parsed.username or "")
    return {
        "host": parsed.hostname or "",
        "database": db,
        "user": user,
        "port": str(parsed.port or 5432),
        "fingerprint": hashlib.sha256(
            f"{parsed.hostname}|{db}|{user}".encode()
        ).hexdigest()[:16],
    }


def fetch_all(conn, sql: str, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        cols = [d.name for d in cur.description] if cur.description else []
        rows = cur.fetchall()
    return cols, rows


def scalar(conn, sql: str, params=None):
    cols, rows = fetch_all(conn, sql, params)
    return rows[0][0] if rows else None


def table_exists(conn, name: str) -> bool:
    return bool(
        scalar(
            conn,
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = %s
            )
            """,
            (name,),
        )
    )


@dataclass
class DryRunResult:
    stamp: str
    source_identity: dict
    target_identity: dict
    identities_distinct: bool
    source_counts: dict
    target_counts: dict
    coach_map: dict
    player_synthesis: dict
    session_map: dict
    result_map: dict
    report_map: dict
    collisions: dict
    missing_relationships: list
    validation: dict
    writes_performed: bool
    rollback: dict


def main() -> int:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fe_env = load_env_file(FRONTEND / ".env.local")
    be_env = load_env_file(BACKEND / ".env")

    v1_url_raw = fe_env.get("DATABASE_URL") or os.environ.get("V1_DATABASE_URL", "")
    v2_url_raw = be_env.get("DATABASE_URL") or os.environ.get("V2_DATABASE_URL", "")
    app_env = be_env.get("APP_ENV", "unknown")

    if not v1_url_raw or not v2_url_raw:
        print("STOP: cannot positively identify both DATABASE_URL values.", file=sys.stderr)
        return 1

    v1_url = normalize_db_url(v1_url_raw)
    v2_url = normalize_db_url(v2_url_raw)
    src_id = identity_from_url(v1_url)
    tgt_id = identity_from_url(v2_url)

    if src_id["fingerprint"] == tgt_id["fingerprint"]:
        print("STOP: source and target appear to be the same database.", file=sys.stderr)
        return 1

    if app_env.lower() not in {"development", "dev", "test", "local"}:
        print(
            f"STOP: APP_ENV={app_env!r} is not an approved TEST/dev environment.",
            file=sys.stderr,
        )
        return 1

    # Connect read-only where supported
    src = psycopg.connect(v1_url, connect_timeout=30)
    tgt = psycopg.connect(v2_url, connect_timeout=30)
    try:
        for conn in (src, tgt):
            conn.read_only = True
            with conn.cursor() as cur:
                cur.execute("SET default_transaction_read_only = on")

        # --- counts ---
        source_counts: dict[str, int] = {}
        for table, sql in [
            ("users_total", "SELECT COUNT(*) FROM users"),
            ("users_coach", "SELECT COUNT(*) FROM users WHERE role = 'coach'"),
            ("users_player", "SELECT COUNT(*) FROM users WHERE role = 'player'"),
            ("training_sessions", "SELECT COUNT(*) FROM training_sessions"),
            ("session_exercises", "SELECT COUNT(*) FROM session_exercises"),
            ("session_players", "SELECT COUNT(*) FROM session_players"),
            ("test_results", "SELECT COUNT(*) FROM test_results"),
            ("ai_reports", "SELECT COUNT(*) FROM ai_reports"),
        ]:
            if table.split("_")[0] == "users" or table_exists(src, table if "users" not in table else "users"):
                try:
                    source_counts[table] = int(scalar(src, sql) or 0)
                except Exception as exc:  # noqa: BLE001
                    source_counts[table] = -1
                    source_counts[f"{table}_error"] = str(exc)[:120]

        # Fix: always count users tables if users exists
        if table_exists(src, "users"):
            source_counts["users_total"] = int(scalar(src, "SELECT COUNT(*) FROM users") or 0)
            source_counts["users_coach"] = int(
                scalar(src, "SELECT COUNT(*) FROM users WHERE role::text = 'coach'") or 0
            )
            source_counts["users_player"] = int(
                scalar(src, "SELECT COUNT(*) FROM users WHERE role::text = 'player'") or 0
            )
        for t in (
            "training_sessions",
            "session_exercises",
            "session_players",
            "test_results",
            "ai_reports",
        ):
            source_counts[t] = (
                int(scalar(src, f"SELECT COUNT(*) FROM {t}") or 0)
                if table_exists(src, t)
                else 0
            )

        target_counts: dict[str, int] = {}
        for t in (
            "users",
            "players",
            "teams",
            "training_sessions",
            "session_exercises",
            "session_players",
            "test_attempts",
            "test_results",
            "ai_reports",
            "positions",
            "cognitive_tests",
        ):
            target_counts[t] = (
                int(scalar(tgt, f"SELECT COUNT(*) FROM {t}") or 0)
                if table_exists(tgt, t)
                else 0
            )

        # --- coach mapping (email) ---
        coaches = []
        if table_exists(src, "users"):
            _, rows = fetch_all(
                src,
                """
                SELECT id::text, lower(trim(email)), display_name, auth_user_id
                FROM users
                WHERE role::text = 'coach' AND email IS NOT NULL AND length(trim(email)) > 0
                """,
            )
            coaches = [
                {
                    "v1_user_id": r[0],
                    "email": r[1],
                    "display_name": r[2],
                    "better_auth_id": r[3],
                }
                for r in rows
            ]

        v2_users_by_email: dict[str, str] = {}
        if table_exists(tgt, "users"):
            _, rows = fetch_all(
                tgt,
                "SELECT id::text, lower(trim(email)) FROM users WHERE email IS NOT NULL",
            )
            v2_users_by_email = {r[1]: r[0] for r in rows}

        coach_matched = []
        coach_to_create = []
        email_dups_v1 = [
            e for e, n in Counter(c["email"] for c in coaches).items() if n > 1
        ]
        for c in coaches:
            if c["email"] in v2_users_by_email:
                coach_matched.append(
                    {
                        **c,
                        "v2_user_id": v2_users_by_email[c["email"]],
                        "action": "map_existing",
                    }
                )
            else:
                coach_to_create.append({**c, "action": "create_staff_no_password_copy"})

        # --- player synthesis from session_players ---
        player_rows = []
        if table_exists(src, "session_players") and table_exists(src, "training_sessions"):
            _, rows = fetch_all(
                src,
                """
                SELECT sp.id::text,
                       sp.session_id::text,
                       lower(trim(sp.display_name)) AS name_key,
                       sp.display_name,
                       sp.user_id::text,
                       ts.coach_id::text,
                       ts.code
                FROM session_players sp
                JOIN training_sessions ts ON ts.id = sp.session_id
                """,
            )
            player_rows = rows

        # synthetic key: coach_id + name_key
        synth_groups: dict[tuple[str, str], list] = defaultdict(list)
        blank_names = 0
        for r in player_rows:
            name_key = r[2] or ""
            if len(name_key) < 2:
                blank_names += 1
                continue
            synth_groups[(r[5], name_key)].append(
                {
                    "v1_session_player_id": r[0],
                    "v1_session_id": r[1],
                    "display_name": r[3],
                    "v1_user_id": r[4],
                    "coach_id": r[5],
                    "session_code": r[6],
                }
            )

        # detect ambiguous names across same coach already grouped; flag multi-session reuse as OK
        multi_session_identities = sum(1 for g in synth_groups.values() if len(g) > 1)

        # existing V2 players by lower(first||' '||last) naive
        v2_player_names: dict[str, list[str]] = defaultdict(list)
        if table_exists(tgt, "players"):
            _, rows = fetch_all(
                tgt,
                "SELECT id::text, lower(trim(first_name || ' ' || last_name)) FROM players",
            )
            for r in rows:
                v2_player_names[r[1]].append(r[0])

        player_actions = []
        name_collisions_with_v2 = 0
        for (coach_id, name_key), members in synth_groups.items():
            parts = name_key.split()
            first = parts[0] if parts else name_key
            last = " ".join(parts[1:]) if len(parts) > 1 else "Migrated"
            existing = v2_player_names.get(name_key, [])
            action = "create_synthetic_player"
            if existing:
                action = "review_possible_duplicate"
                name_collisions_with_v2 += 1
            player_actions.append(
                {
                    "synth_key": f"{coach_id}|{name_key}",
                    "coach_id": coach_id,
                    "name_key": name_key,
                    "first_name": first.title(),
                    "last_name": last.title(),
                    "v1_session_player_ids": [m["v1_session_player_id"] for m in members],
                    "session_codes": sorted({m["session_code"] for m in members}),
                    "v2_name_matches": existing,
                    "action": action,
                }
            )

        # --- sessions ---
        sessions = []
        if table_exists(src, "training_sessions"):
            _, rows = fetch_all(
                src,
                """
                SELECT id::text, coach_id::text, code, title, status::text,
                       archived_at IS NOT NULL, starts_at::text, ends_at::text
                FROM training_sessions
                """,
            )
            sessions = rows

        v2_session_ids = set()
        v2_session_codes = set()
        if table_exists(tgt, "training_sessions"):
            _, rows = fetch_all(tgt, "SELECT id::text, session_code FROM training_sessions")
            v2_session_ids = {r[0] for r in rows}
            v2_session_codes = {r[1] for r in rows}

        session_actions = []
        code_collisions = 0
        uuid_collisions = 0
        for r in sessions:
            sid, coach_id, code, title, status, archived, starts, ends = r
            action = "insert_preserve_uuid"
            if sid in v2_session_ids:
                action = "skip_uuid_exists"
                uuid_collisions += 1
            elif code in v2_session_codes:
                action = "insert_new_uuid_code_collision"
                code_collisions += 1
            status_map = {
                "draft": "draft",
                "active": "in_progress",
                "closed": "completed",
            }
            session_actions.append(
                {
                    "v1_session_id": sid,
                    "coach_id": coach_id,
                    "code": code,
                    "title": title,
                    "v1_status": status,
                    "v2_status": status_map.get(status, "draft"),
                    "archived": archived,
                    "action": action,
                }
            )

        # --- exercises ---
        v2_slugs = {}
        if table_exists(tgt, "cognitive_tests"):
            _, rows = fetch_all(tgt, "SELECT id::text, slug FROM cognitive_tests")
            v2_slugs = {r[1]: r[0] for r in rows}

        missing_slugs = []
        exercise_count = 0
        if table_exists(src, "session_exercises"):
            _, rows = fetch_all(
                src,
                "SELECT session_id::text, test_slug::text, sort_order FROM session_exercises",
            )
            exercise_count = len(rows)
            for sid, slug, _ in rows:
                if slug not in v2_slugs:
                    missing_slugs.append({"session_id": sid, "slug": slug})

        # --- results ---
        result_actions = []
        orphan_results = 0
        if table_exists(src, "test_results"):
            _, rows = fetch_all(
                src,
                """
                SELECT tr.id::text, tr.session_id::text, tr.session_player_id::text,
                       tr.test_slug::text, tr.score, tr.accuracy::float
                FROM test_results tr
                """,
            )
            sp_ids = {r[0] for r in player_rows}
            for r in rows:
                ok = r[2] in sp_ids
                if not ok:
                    orphan_results += 1
                result_actions.append(
                    {
                        "v1_result_id": r[0],
                        "session_id": r[1],
                        "session_player_id": r[2],
                        "slug": r[3],
                        "score": r[4],
                        "accuracy": r[5],
                        "action": "create_attempt_and_result" if ok else "skip_orphan",
                        "slug_in_catalogue": r[3] in v2_slugs,
                    }
                )

        # --- ai reports ---
        report_actions = []
        if table_exists(src, "ai_reports"):
            _, rows = fetch_all(
                src,
                """
                SELECT id::text, session_id::text, session_player_id::text,
                       report_type::text, status::text
                FROM ai_reports
                """,
            )
            for r in rows:
                report_actions.append(
                    {
                        "v1_report_id": r[0],
                        "session_id": r[1],
                        "session_player_id": r[2],
                        "report_type": r[3],
                        "status": r[4],
                        "action": "load_json_only_http_blocked",
                    }
                )

        missing_relationships = []
        if missing_slugs:
            missing_relationships.append(
                {
                    "type": "cognitive_test_slug_missing_in_v2",
                    "count": len(missing_slugs),
                    "examples": missing_slugs[:10],
                }
            )
        if orphan_results:
            missing_relationships.append(
                {
                    "type": "test_results_orphan_session_player",
                    "count": orphan_results,
                }
            )
        if blank_names:
            missing_relationships.append(
                {"type": "blank_display_names", "count": blank_names}
            )

        validation = {
            "uuids_preservable_sessions": sum(
                1 for s in session_actions if s["action"] == "insert_preserve_uuid"
            ),
            "session_uuid_collisions": uuid_collisions,
            "session_code_collisions": code_collisions,
            "coach_emails_duplicated_in_v1": email_dups_v1,
            "player_name_collisions_with_v2": name_collisions_with_v2,
            "synthetic_player_identities": len(player_actions),
            "multi_session_shared_identities": multi_session_identities,
            "exercises_total": exercise_count,
            "results_migratable": sum(
                1 for r in result_actions if r["action"] == "create_attempt_and_result"
            ),
            "results_skipped": sum(
                1 for r in result_actions if r["action"] != "create_attempt_and_result"
            ),
            "reports_json_loadable": len(report_actions),
            "passwords_copied": False,
            "writes_performed": False,
        }

        result = DryRunResult(
            stamp=stamp,
            source_identity={**src_id, "role": "V1_Neon", "app": "frontend"},
            target_identity={
                **tgt_id,
                "role": "V2_Postgres",
                "app_env": app_env,
                "note": "Treated as development/TEST per APP_ENV; no Neon branch clone created in this run",
            },
            identities_distinct=True,
            source_counts=source_counts,
            target_counts=target_counts,
            coach_map={
                "matched_existing": coach_matched,
                "to_create_without_password": coach_to_create,
                "matched_count": len(coach_matched),
                "create_count": len(coach_to_create),
            },
            player_synthesis={
                "identities": player_actions[:200],
                "identity_count": len(player_actions),
                "truncated": len(player_actions) > 200,
            },
            session_map={
                "actions": session_actions[:200],
                "session_count": len(session_actions),
                "truncated": len(session_actions) > 200,
            },
            result_map={
                "sample": result_actions[:100],
                "result_count": len(result_actions),
                "truncated": len(result_actions) > 100,
            },
            report_map={
                "sample": report_actions[:100],
                "report_count": len(report_actions),
                "truncated": len(report_actions) > 100,
            },
            collisions={
                "v1_coach_duplicate_emails": email_dups_v1,
                "session_uuid_collisions": uuid_collisions,
                "session_code_collisions": code_collisions,
                "player_name_collisions_with_v2": name_collisions_with_v2,
            },
            missing_relationships=missing_relationships,
            validation=validation,
            writes_performed=False,
            rollback={
                "strategy": "No writes performed — rollback is N/A for this dry-run. "
                "For a future write run: restore V2 snapshot / Neon branch; "
                "V1 remains read-only source of truth until explicit approval.",
                "v1_untouched": True,
            },
        )

        out_dir = RUNS / stamp
        out_dir.mkdir(parents=True, exist_ok=True)
        payload = asdict(result)
        (out_dir / "dry_run.json").write_text(
            json.dumps(payload, indent=2, default=str),
            encoding="utf-8",
        )
        # inventory "backup" evidence (counts only)
        (out_dir / "inventory_backup.json").write_text(
            json.dumps(
                {
                    "stamp": stamp,
                    "source": src_id,
                    "target": {**tgt_id, "app_env": app_env},
                    "source_counts": source_counts,
                    "target_counts": target_counts,
                    "note": "Logical inventory only — not a full pg_dump. Prefer Neon PITR/branch before write ETL.",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(json.dumps({"ok": True, "stamp": stamp, "out": str(out_dir)}, indent=2))
        return 0
    finally:
        src.close()
        tgt.close()


if __name__ == "__main__":
    raise SystemExit(main())
