-- Add Recherche Visuelle Séquentielle to the existing test_slug enum.
-- Safe: adds one value. Does not rename, drop, or rewrite existing rows.
-- The shared number layout is derived from the session id, so no new column
-- or table is required.
--
-- Apply once on the existing database, outside a manual transaction if the
-- Postgres version rejects ADD VALUE inside a transaction:
--
--   ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'sequential-visual-search';
--
-- Rollback: PostgreSQL cannot remove an enum value. Stop assigning this slug
-- and leave the value in place. Results of the existing exercises stay untouched.

ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'sequential-visual-search';
