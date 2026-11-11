-- Group report for a whole session (one row per session, no player).
ALTER TYPE ai_report_type ADD VALUE IF NOT EXISTS 'group';

ALTER TABLE ai_reports
  ALTER COLUMN session_player_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_reports_group_uidx
  ON ai_reports (session_id)
  WHERE report_type = 'group';
