-- Add digit memory and dual-target tracking to the existing test_slug enum.
-- Safe: adds two values. Does not rename, drop, or rewrite existing rows.
-- Hidden answers are derived on the server from the session id and the server
-- secret, so no new table is required.
--
-- Apply once on the existing database:
--
--   ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'digit-memory';
--   ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'dual-target-tracking';
--
-- Rollback: PostgreSQL cannot remove an enum value. Stop assigning these
-- slugs and leave the values in place.

ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'digit-memory';
ALTER TYPE test_slug ADD VALUE IF NOT EXISTS 'dual-target-tracking';
