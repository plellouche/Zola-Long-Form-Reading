"""Recommendation endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..database import get_session
from ..models import ReadingList
from ..recs import for_you_feed, list_recommendations, related_articles
from ..schemas import ArticleSummary

router = APIRouter(prefix="/api", tags=["recs"])


@router.get("/feed", response_model=list[ArticleSummary])
async def get_for_you_feed(
    limit: int = Query(default=24, ge=1, le=60),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    articles = await for_you_feed(session, current.id, limit=limit)
    return [ArticleSummary.model_validate(a) for a in articles]


@router.get("/articles/{article_id}/related", response_model=list[ArticleSummary])
async def get_related(
    article_id: UUID,
    limit: int = Query(default=6, ge=1, le=24),
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    articles = await related_articles(
        session,
        article_id,
        limit=limit,
        viewer_id=viewer.id if viewer else None,
    )
    return [ArticleSummary.model_validate(a) for a in articles]


@router.get("/lists/{list_id}/recommendations", response_model=list[ArticleSummary])
async def get_list_recs(
    list_id: UUID,
    limit: int = Query(default=6, ge=1, le=24),
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    # List recs visible only to the owner of private lists; public lists are open.
    target = await session.scalar(select(ReadingList).where(ReadingList.id == list_id))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    if not target.is_public and (viewer is None or viewer.id != target.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")

    articles = await list_recommendations(session, list_id, limit=limit)
    return [ArticleSummary.model_validate(a) for a in articles]
