-- =============================================================================
-- pgvector extension + per-article embedding column
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/017_article_embeddings.sql
-- Idempotent.
--
-- This is the foundational schema change for Phase 18 (semantic search +
-- embedding-based recs). It does NOT populate embeddings — backfill is a
-- separate Python job that requires sentence-transformers (see
-- packages/ingest/src/longform_ingest/embeddings.py — to be added).
--
-- Vector dim 384 matches sentence-transformers/all-MiniLM-L6-v2, the model
-- the roadmap commits to. If we ever swap models, drop + recreate the column
-- with the new dimension and re-run backfill.
--
-- HNSW index is intentionally deferred until ~10k articles. Below that
-- threshold a sequential scan is faster than the index overhead, and
-- building an HNSW takes minutes per 10k rows. When ready:
--
--   CREATE INDEX articles_embedding_hnsw_idx
--     ON public.articles USING hnsw (embedding vector_cosine_ops);
-- =============================================================================

create extension if not exists vector;

alter table public.articles
  add column if not exists embedding vector(384);

-- Partial index on rows that HAVE an embedding (during backfill, most rows
-- will be null). Helps the query planner skip null rows cheaply.
create index if not exists articles_has_embedding_idx
  on public.articles ((embedding is not null))
  where embedding is not null;
