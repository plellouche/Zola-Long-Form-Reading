-- =============================================================================
-- Source-level paywall hint
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/012_source_paywall_hint.sql
-- Idempotent.
--
-- Motivation: per-article detection (articles.access_tier from migration 011)
-- only works on publishers that emit honest paywall metadata. The Atlantic
-- does. New Yorker, Wired, Bloomberg, Harper's tag almost every article as
-- 'free' even when metered — their HTML claims "no payment required" because
-- a reader's first N reads ARE free, which is true on a per-article basis but
-- misleading on a feed-discovery surface.
--
-- This column lets a curator stamp "I know this publication is metered/locked
-- in practice." The API then resolves the effective tier:
--
--   effective_tier = MAX_BY_STRICTNESS(article.access_tier, source.paywall_hint)
--   where locked > metered > free > unknown
--
-- So:
--   - Atlantic article tagged 'metered'  + source hint NULL    -> 'metered'
--   - NYer article tagged 'free'         + source hint 'metered' -> 'metered'
--   - Independent post tagged 'unknown'  + source hint NULL    -> 'unknown'
--   - Harper's article tagged 'free'     + source hint 'locked'  -> 'locked'
-- =============================================================================

alter table public.sources
  add column if not exists paywall_hint text null
    check (paywall_hint is null or paywall_hint in ('free', 'metered', 'locked'));

-- Seed hints for known paywalled publishers. Mostly 'metered' — these
-- publications give a small free-read allowance per month, then ask you to
-- subscribe. 'locked' would mean "no free reads at all" (no one in the
-- current lineup is fully locked).
update public.sources set paywall_hint = 'metered'
  where slug in ('new-yorker', 'wired', 'atlantic', 'harpers');

-- The Conversation, ProPublica, Aeon, Hakai, Paul Graham, Public Domain
-- Review, Sapiens, etc. are all open-access — leave paywall_hint NULL.
