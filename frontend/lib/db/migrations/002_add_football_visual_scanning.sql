-- Add Football Visual Scanning to the existing test_slug enum.
-- Safe: adds one value. Does not rename, drop, or rewrite existing rows.
--
-- Apply once on the production database (Neon), outside a manual transaction
-- if your Postgres version rejects ADD VALUE inside a transaction:
--
--   ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'football-visual-scanning';
--
-- Rollback: PostgreSQL cannot remove an enum value without recreating the
-- type. Do not do that. To roll back the app, stop assigning this slug and
-- leave the enum value in place. Existing results for the four original
-- tests stay untouched.

ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'football-visual-scanning';
