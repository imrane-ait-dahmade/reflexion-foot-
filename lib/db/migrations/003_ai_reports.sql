-- Coach-only AI reports. Adds tables and enum types.
-- Does not change test_results, sessions, or existing rows.
-- Do not run this against production until it has been reviewed.
--
-- Rollback: stop setting AI_ANALYSIS_ENABLED. Dropping the new table is
-- optional and must be a separate reviewed decision. Do not drop test_results.

CREATE TYPE ai_report_type AS ENUM ('test', 'session', 'progress');

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
  session_player_id  UUID NOT NULL REFERENCES session_players (id) ON DELETE CASCADE,
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

CREATE INDEX ai_reports_coach_lookup_idx
  ON ai_reports (session_id, session_player_id, created_at DESC);
