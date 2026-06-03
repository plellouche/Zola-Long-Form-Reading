from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_session
from ..embeddings import embed_query
from ..filters import arachnid_exclude_clause
from ..models import Article, Profile
from ..schemas import ArticleSummary, PublicProfile

router = APIRouter(prefix="/api/search", tags=["search"])

SearchMode = Literal["keyword", "semantic", "hybrid"]


class SearchResponse(BaseModel):
    articles: list[ArticleSummary]
    users: list[PublicProfile]
    mode_used: SearchMode = "keyword"


async def _keyword_articles(
    session: AsyncSession, term: str, limit: int
) -> list[Article]:
    ts_query = func.websearch_to_tsquery("english", term)
    stmt = (
        select(Article)
        .where(Article.search_tsv.op("@@")(ts_query))
        .where(arachnid_exclude_clause(Article))
        .order_by(
            func.ts_rank_cd(Article.search_tsv, ts_query).desc(),
            Article.created_at.desc(),
        )
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def _semantic_articles(
    session: AsyncSession, term: str, limit: int
) -> list[Article] | None:
    """Embed the query, return the nearest articles by cosine. Returns None
    if semantic search isn't available (flag off, model not loadable,
    no embedded articles in the DB yet) — caller falls back."""
    settings = get_settings()
    if not settings.semantic_search_enabled:
        return None
    vec = embed_query(term)
    if vec is None:
        return None
    vec_literal = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
    # pgvector <=> is cosine DISTANCE (lower = more similar); ORDER BY ASC.
    stmt = (
        select(Article)
        .where(Article.embedding.is_not(None))
        .where(arachnid_exclude_clause(Article))
        .order_by(text("embedding <=> :v").bindparams(v=vec_literal))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


def _merge_hybrid(
    keyword_hits: list[Article], semantic_hits: list[Article], limit: int
) -> list[Article]:
    """Interleave keyword + semantic ranks, dedupe by id, take top N. The
    keyword hits lead by one slot since they have higher precision on
    queries that already match terms exactly."""
    seen: set = set()
    out: list[Article] = []
    for k, s in zip(keyword_hits, semantic_hits, strict=False):
        for a in (k, s):
            if a.id not in seen:
                seen.add(a.id)
                out.append(a)
                if len(out) >= limit:
                    return out
    # Drain remainder
    for a in keyword_hits + semantic_hits:
        if a.id not in seen:
            seen.add(a.id)
            out.append(a)
            if len(out) >= limit:
                break
    return out


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    mode: SearchMode = Query(default="keyword"),
    limit_articles: int = Query(default=20, ge=1, le=50),
    limit_users: int = Query(default=10, ge=0, le=50),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    term = q.strip()
    if not term:
        return SearchResponse(articles=[], users=[])

    mode_used: SearchMode = mode
    articles: list[Article] = []

    if mode in ("semantic", "hybrid"):
        semantic = await _semantic_articles(session, term, limit_articles)
        if semantic is None:
            # Graceful fallback when the model isn't available — pretend
            # the caller asked for keyword.
            mode_used = "keyword"
            articles = await _keyword_articles(session, term, limit_articles)
        elif mode == "semantic":
            articles = semantic
        else:  # hybrid
            keyword = await _keyword_articles(session, term, limit_articles)
            articles = _merge_hybrid(keyword, semantic, limit_articles)
    else:
        articles = await _keyword_articles(session, term, limit_articles)

    # ---- users by username / display_name ILIKE ----
    users: list[Profile] = []
    if limit_users > 0:
        like = f"%{term.lower()}%"
        user_stmt = (
            select(Profile)
            .where(Profile.onboarded_at.is_not(None))
            .where(
                or_(
                    func.lower(Profile.username).like(like),
                    func.lower(Profile.display_name).like(like),
                )
            )
            .order_by(Profile.username)
            .limit(limit_users)
        )
        user_result = await session.execute(user_stmt)
        users = list(user_result.scalars().all())

    return SearchResponse(
        articles=[ArticleSummary.model_validate(a) for a in articles],
        users=[PublicProfile.model_validate(u) for u in users],
        mode_used=mode_used,
    )
