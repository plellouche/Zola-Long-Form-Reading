# infra/supabase

Hand-written SQL migrations, RLS policies, and seed data that live alongside (or feed into) Alembic-managed schema.

## Layout
- `migrations/` — raw SQL run against Supabase (e.g. `auth.users` triggers, RLS toggles). Phase 1+.
- `policies/` — RLS policy definitions, one file per table.
- `seed/` — seed data (topics, sources). Run after `alembic upgrade head` creates the tables.

## Apply order (eventual)
1. `alembic upgrade head` (creates app tables from SQLAlchemy models)
2. SQL files in `migrations/` (auth triggers + RLS) via Supabase SQL editor or `psql`
3. Seed files in `seed/`

This folder is empty in Phase 0. Populated starting Phase 1.
