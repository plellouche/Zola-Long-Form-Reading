from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Article, Profile
from ..schemas import ArticleSummary, PublicProfile

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchResponse(BaseModel):
    articles: list[ArticleSummary]
    users: list[PublicProfile]


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    limit_articles: int = Query(default=20, ge=1, le=50),
    limit_users: int = Query(default=10, ge=0, le=50),
    session: AsyncSession = Depends(get_session),
) -> SearchResponse:
    term = q.strip()
    if not term:
        return SearchResponse(articles=[], users=[])

    # ---- articles via full-text search, ranked ----
    ts_query = func.websearch_to_tsquery("english", term)
    article_stmt = (
        select(Article)
        .where(Article.search_tsv.op("@@")(ts_query))
        .order_by(
            func.ts_rank_cd(Article.search_tsv, ts_query).desc(),
            Article.created_at.desc(),
        )
        .limit(limit_articles)
    )
    art_result = await session.execute(article_stmt)
    articles = list(art_result.scalars().unique().all())

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
    )
