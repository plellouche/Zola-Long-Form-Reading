"""Discovery deck — swipe-based article surfacing.

GET  /api/discover/deck       — N article candidates for the swipe stack
POST /api/discover/swipe      — record a swipe (left / right / up / down)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_session
from ..models import Article, Event, UserArticleState
from ..recs import for_discover_deck
from ..schemas import ArticleSummary, UserArticleStateOut

router = APIRouter(prefix="/api/discover", tags=["discover"])


SwipeDirection = Literal["left", "right", "up", "down"]


# Mapping from swipe direction to the state we upsert (if any) and the
# event type we log.
DIRECTION_TO_STATUS: dict[str, str | None] = {
    "left": "DISMISSED",
    "right": "INTERESTED",
    "up": "SAVED",
    "down": None,  # source-fatigue: no per-article state change
}

DIRECTION_TO_EVENT: dict[str, str] = {
    "left": "SWIPE_LEFT",
    "right": "SWIPE_RIGHT",
    "up": "SWIPE_UP",
    "down": "SWIPE_DOWN",
}


class SwipeRequest(BaseModel):
    article_id: UUID
    direction: SwipeDirection


class SwipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: UUID
    direction: SwipeDirection
    state: UserArticleStateOut | None = None


@router.get("/deck", response_model=list[ArticleSummary])
async def get_deck(
    limit: int = Query(default=25, ge=1, le=50),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    articles = await for_discover_deck(session, current.id, limit=limit)
    return [ArticleSummary.model_validate(a) for a in articles]


@router.post("/swipe", response_model=SwipeResponse)
async def post_swipe(
    payload: SwipeRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SwipeResponse:
    article = await session.scalar(
        select(Article).where(Article.id == payload.article_id)
    )
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    now = datetime.now(timezone.utc)
    target_status = DIRECTION_TO_STATUS[payload.direction]
    state_out: UserArticleStateOut | None = None

    if target_status is not None:
        set_clause: dict[str, object] = {"status": target_status, "updated_at": now}
        opened_at = now if target_status in ("READING", "FINISHED") else None
        finished_at = now if target_status == "FINISHED" else None
        if opened_at is not None:
            set_clause["opened_at"] = opened_at
        if finished_at is not None:
            set_clause["finished_at"] = finished_at

        stmt = (
            pg_insert(UserArticleState)
            .values(
                user_id=current.id,
                article_id=payload.article_id,
                status=target_status,
                opened_at=opened_at,
                finished_at=finished_at,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "article_id"],
                set_=set_clause,
            )
            .returning(UserArticleState)
        )
        result = await session.execute(stmt)
        row = result.scalar_one()
        state_out = UserArticleStateOut.model_validate(row)

    # Log the swipe event. For "down" we also attach the source_id so the
    # recs source-fatigue lookup can find it.
    event_metadata: dict[str, object] = {"from": "discover"}
    if payload.direction == "down":
        event_metadata["source_id"] = str(article.source_id)

    session.add(
        Event(
            user_id=current.id,
            article_id=payload.article_id,
            event_type=DIRECTION_TO_EVENT[payload.direction],
            event_metadata=event_metadata,
        )
    )

    # For swipe-down, also emit the SOURCE_FATIGUE event the recs engine
    # actually looks for. Kept as a separate row so the swipe log stays
    # clean and the fatigue lookup query stays narrow.
    if payload.direction == "down":
        session.add(
            Event(
                user_id=current.id,
                article_id=payload.article_id,
                event_type="SOURCE_FATIGUE",
                event_metadata={"source_id": str(article.source_id)},
            )
        )

    await session.commit()

    return SwipeResponse(
        article_id=payload.article_id,
        direction=payload.direction,
        state=state_out,
    )
