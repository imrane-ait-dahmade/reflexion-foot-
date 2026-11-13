-- RealScouting Academy — PostgreSQL schema
-- Roles: coach creates a session + code; players join with the code and submit results.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('coach', 'player');

CREATE TYPE session_status AS ENUM ('draft', 'active', 'closed');

-- Must stay in sync with lib/tests/registry.ts
CREATE TYPE test_slug AS ENUM (
  'visual-tracking',
  'visual-memory',
  'reaction-time',
  'peripheral-vision',
  'football-visual-scanning',
  'sequential-visual-search',
  'digit-memory',
  'dual-target-tracking'
);

-- ---------------------------------------------------------------------------
-- Users
-- Coaches always have an account.
-- Players may also have an account later; for MVP they can join a session
-- with only a display name (see session_players.user_id nullable).
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  password_hash TEXT,
  display_name  TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'player',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_coach_email_required
    CHECK (role <> 'coach' OR email IS NOT NULL)
);

CREATE INDEX users_role_idx ON users (role);

-- ---------------------------------------------------------------------------
-- Training sessions
-- A coach creates a session and shares `code` with players.
-- ---------------------------------------------------------------------------

CREATE TABLE training_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      session_status NOT NULL DEFAULT 'draft',
  -- If true, exercises are picked randomly when the session is activated.
  randomize_exercises BOOLEAN NOT NULL DEFAULT true,
  -- How many exercises to include when randomize_exercises = true.
  exercise_count INTEGER NOT NULL DEFAULT 2
    CHECK (exercise_count >= 1 AND exercise_count <= 10),
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  -- Set when the coach removes the session from their list.
  -- The row, the players and the results stay so the AI can still use them.
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT training_sessions_code_format
    CHECK (code ~ '^[A-Z0-9]{4,8}$'),
  CONSTRAINT training_sessions_window
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX training_sessions_code_uidx
  ON training_sessions (code);

CREATE INDEX training_sessions_coach_idx
  ON training_sessions (coach_id, created_at DESC);

CREATE INDEX training_sessions_status_idx
  ON training_sessions (status);

-- ---------------------------------------------------------------------------
-- Exercises assigned to a session
-- Either chosen by the coach, or generated randomly on activation.
-- ---------------------------------------------------------------------------

CREATE TABLE session_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES training_sessions (id) ON DELETE CASCADE,
  test_slug   test_slug NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT session_exercises_unique_test
    UNIQUE (session_id, test_slug),
  CONSTRAINT session_exercises_sort_unique
    UNIQUE (session_id, sort_order)
);

CREATE INDEX session_exercises_session_idx
  ON session_exercises (session_id, sort_order);

-- ---------------------------------------------------------------------------
-- Players who joined a session (via code)
-- ---------------------------------------------------------------------------

CREATE TABLE session_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES training_sessions (id) ON DELETE CASCADE,
  -- Optional link to a registered player account.
  user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT session_players_name_not_blank
    CHECK (length(trim(display_name)) >= 2)
);

CREATE UNIQUE INDEX session_players_session_name_uidx
  ON session_players (session_id, lower(display_name));

CREATE INDEX session_players_session_idx
  ON session_players (session_id, joined_at);

CREATE INDEX session_players_user_idx
  ON session_players (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Test results
-- One row per completed exercise for a player in a session.
-- Shared metrics are columns; test-specific details live in `metrics` JSONB.
-- ---------------------------------------------------------------------------

CREATE TABLE test_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES training_sessions (id) ON DELETE CASCADE,
  session_player_id  UUID NOT NULL REFERENCES session_players (id) ON DELETE CASCADE,
  test_slug          test_slug NOT NULL,

  score              INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  accuracy           NUMERIC(5, 1) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  correct_answers    INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  errors             INTEGER NOT NULL DEFAULT 0 CHECK (errors >= 0),
  average_reaction_ms INTEGER NOT NULL DEFAULT 0 CHECK (average_reaction_ms >= 0),
  best_reaction_ms   INTEGER NOT NULL DEFAULT 0 CHECK (best_reaction_ms >= 0),
  duration_ms        INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),

  -- Extra fields per test, e.g.:
  -- visual-tracking: { "targetsFound": 18, "wrongClicks": 4 }
  -- visual-memory:   { "roundsCompleted": 8, "correctCells": 37 }
  -- reaction-time:   { "attempts": 10, "falseStarts": 2, "worstReactionTime": 542 }
  -- peripheral-vision: { "trials": 19, "missed": 4, "leftAccuracy": 42.9, "rightAccuracy": 66.7 }
  -- football-visual-scanning: { "missed": 1, "incorrect": 2, "closestCorrect": 2, "closestTotal": 3 }
  -- sequential-visual-search: { "completionTimeMs": 82500, "totalNumbers": 50, "numbersFound": 50, "completionStatus": "completed" }
  metrics            JSONB NOT NULL DEFAULT '{}'::jsonb,

  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A player can only submit one result per exercise in a session.
  CONSTRAINT test_results_unique_attempt
    UNIQUE (session_player_id, test_slug)
);

CREATE INDEX test_results_session_idx
  ON test_results (session_id, completed_at DESC);

CREATE INDEX test_results_player_idx
  ON test_results (session_player_id);

CREATE INDEX test_results_test_idx
  ON test_results (test_slug);

-- Keep session_id consistent with the player's session.
CREATE OR REPLACE FUNCTION enforce_result_session_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM session_players sp
    WHERE sp.id = NEW.session_player_id
      AND sp.session_id = NEW.session_id
  ) THEN
    RAISE EXCEPTION 'session_player % does not belong to session %',
      NEW.session_player_id, NEW.session_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM session_exercises se
    WHERE se.session_id = NEW.session_id
      AND se.test_slug = NEW.test_slug
  ) THEN
    RAISE EXCEPTION 'test % is not part of session %',
      NEW.test_slug, NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_results_session_match
  BEFORE INSERT OR UPDATE ON test_results
  FOR EACH ROW
  EXECUTE FUNCTION enforce_result_session_match();

-- ---------------------------------------------------------------------------
-- Helpful views for the coach dashboard
-- ---------------------------------------------------------------------------

CREATE VIEW session_player_summary AS
SELECT
  sp.session_id,
  sp.id AS session_player_id,
  sp.display_name,
  sp.joined_at,
  count(tr.id)::INTEGER AS completed_tests,
  coalesce(round(avg(tr.score)::numeric, 1), 0) AS average_score,
  coalesce(sum(tr.score), 0)::INTEGER AS total_score
FROM session_players sp
LEFT JOIN test_results tr ON tr.session_player_id = sp.id
GROUP BY sp.session_id, sp.id, sp.display_name, sp.joined_at;

-- ---------------------------------------------------------------------------
-- Coach-only AI reports. Original test_results rows stay unchanged.
-- Apply lib/db/migrations/003_ai_reports.sql on an existing database.
-- ---------------------------------------------------------------------------

CREATE TYPE ai_report_type AS ENUM ('test', 'session', 'progress', 'group');

CREATE TYPE ai_report_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'not_eligible'
);

CREATE TABLE ai_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES training_sessions (id) ON DELETE CASCADE,
  session_player_id  UUID REFERENCES session_players (id) ON DELETE CASCADE,
  test_result_id     UUID REFERENCES test_results (id) ON DELETE CASCADE,
  report_type        ai_report_type NOT NULL,
  status             ai_report_status NOT NULL DEFAULT 'pending',
  report_data        JSONB,
  model              TEXT,
  prompt_version     TEXT,
  input_tokens       INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens      INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  error_code         TEXT,
  generated_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_reports_test_uidx
  ON ai_reports (session_player_id, test_result_id, report_type)
  WHERE test_result_id IS NOT NULL;

CREATE UNIQUE INDEX ai_reports_player_session_uidx
  ON ai_reports (session_player_id, session_id, report_type)
  WHERE report_type IN ('session', 'progress');

CREATE UNIQUE INDEX ai_reports_group_uidx
  ON ai_reports (session_id)
  WHERE report_type = 'group';

CREATE INDEX ai_reports_coach_lookup_idx
  ON ai_reports (session_id, session_player_id, created_at DESC);
