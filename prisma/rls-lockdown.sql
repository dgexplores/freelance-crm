-- Enable Row-Level Security on every public table and deny all access by
-- default (no policies). This app talks to Postgres directly via Prisma
-- (DATABASE_URL), never through Supabase's PostgREST/anon-key API, so it
-- does not need any RLS policies to keep working. Enabling RLS with zero
-- policies simply blocks the auto-generated REST API from touching this
-- data, which is what Supabase's security advisor flagged:
--   - rls_disabled_in_public (Table publicly accessible)
--   - sensitive_columns_exposed (Sensitive data publicly accessible)
--
-- Deliberately NOT using FORCE ROW LEVEL SECURITY: that would also apply
-- RLS to the table owner, and Prisma's DATABASE_URL role is the table
-- owner on Supabase, so forcing it would break the app itself (no
-- policies = it would lock itself out too). Plain ENABLE already stops
-- the anon/authenticated PostgREST roles, which is the actual exposure.
--
-- Run this once in the Supabase SQL Editor for the freelance-crm-prod
-- project (or via `psql "$DATABASE_URL" -f prisma/rls-lockdown.sql`).
-- Safe to re-run (idempotent).

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;
