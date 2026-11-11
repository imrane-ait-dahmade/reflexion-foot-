-- Coach can remove a session from their list.
-- The session row, its players and its results stay so AI cohort data remains.

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS training_sessions_visible_idx
  ON training_sessions (coach_id, created_at DESC)
  WHERE archived_at IS NULL;
