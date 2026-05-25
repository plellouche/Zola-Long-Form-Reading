"""Per-user article state: save / reading / finished / dismissed."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_session
from ..models import Article, ArticleTopic, Event, Source, UserArticleState
from ..schemas import (
    ArticleSummary,
    SetArticleRatingRequest,
    SetArticleStateRequest,
    StatefulArticle,
    UserArticleStateOut,
    UserArticleStatus,
)

router = APIRouter(prefix="/api/me/articles", tags=["me"])


EVENT_BY_STATUS = {
    "SAVED": "SAVE",
    "FINISHED": "FINISH",
    "DISMISSED": "DISMISS",
    "READING": "OPEN",
}


@router.post("/{article_id}/state", response_model=UserArticleStateOut)
async def set_state(
    article_id: UUID,
    payload: SetArticleStateRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserArticleState:
    # Confirm the article exists (cheap; surfaces 404 cleanly).
    article = await session.scalar(select(Article).where(Article.id == article_id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    now = datetime.now(timezone.utc)
    set_clause = {"status": payload.status, "updated_at": now}
    if payload.status == "READING":
        set_clause["opened_at"] = now
    elif payload.status == "FINISHED":
        set_clause["finished_at"] = now

    stmt = (
        pg_insert(UserArticleState)
        .values(
            user_id=current.id,
            article_id=article_id,
            status=payload.status,
            opened_at=now if payload.status in ("READING", "FINISHED") else None,
            finished_at=now if payload.status == "FINISHED" else None,
        )
        .on_conflict_do_update(
            index_elements=["user_id", "article_id"],
            set_=set_clause,
        )
        .returning(UserArticleState)
    )
    result = await session.execute(stmt)
    row = result.scalar_one()

    # Emit an event for analytics / recs. Non-blocking failure path: rely on
    # the DB transaction; if Event insert fails the whole commit rolls back.
    event_type = EVENT_BY_STATUS.get(payload.status)
    if event_type:
        session.add(
            Event(
                user_id=current.id,
                article_id=article_id,
                event_type=event_type,
                event_metadata={"from": "user_state"},
            )
        )

    await session.commit()
    await session.refresh(row)
    return row


@router.put("/{article_id}/rating", response_model=UserArticleStateOut)
async def set_rating(
    article_id: UUID,
    payload: SetArticleRatingRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserArticleState:
    """Set or clear the post-finish rating on an article.

    Rating is independent of status — you can rate an article that isn't
    marked FINISHED yet, though the UI normally only surfaces this control
    after a FINISH. We do NOT auto-mark FINISHED here; the front-end is
    responsible for the status transition.
    """
    row = await session.scalar(
        select(UserArticleState).where(
            UserArticleState.user_id == current.id,
            UserArticleState.article_id == article_id,
        )
    )
    if row is None:
        # No state row yet — create one with status=FINISHED so the rating
        # has a meaningful anchor. This keeps the rating-without-finish
        # gesture cheap on the front-end.
        article = await session.scalar(select(Article).where(Article.id == article_id))
        if article is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
        now = datetime.now(timezone.utc)
        row = UserArticleState(
            user_id=current.id,
            article_id=article_id,
            status="FINISHED",
            opened_at=now,
            finished_at=now,
            rating=payload.rating,
        )
        session.add(row)
    else:
        row.rating = payload.rating
        row.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(row)
    return row


@router.delete("/{article_id}/state")
async def clear_state(
    article_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    existing = await session.scalar(
        select(UserArticleState).where(
            UserArticleState.user_id == current.id,
            UserArticleState.article_id == article_id,
        )
    )
    if existing is not None:
        await session.delete(existing)
        await session.commit()
    return {"ok": True}


@router.get("/{article_id}/state", response_model=UserArticleStateOut)
async def get_state(
    article_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserArticleState:
    row = await session.scalar(
        select(UserArticleState).where(
            UserArticleState.user_id == current.id,
            UserArticleState.article_id == article_id,
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No state for article")
    return row


@router.get("", response_model=list[StatefulArticle])
async def list_my_articles(
    status_filter: UserArticleStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=60, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[StatefulArticle]:
    stmt = (
        select(UserArticleState, Article)
        .join(Article, Article.id == UserArticleState.article_id)
        .where(UserArticleState.user_id == current.id)
        .order_by(UserArticleState.updated_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(UserArticleState.status == status_filter)

    result = await session.execute(stmt)
    out: list[StatefulArticle] = []
    for state_row, article in result.unique().all():
        out.append(
            StatefulArticle(
                article=ArticleSummary.model_validate(article),
                state=UserArticleStateOut.model_validate(state_row),
            )
        )
    return out
