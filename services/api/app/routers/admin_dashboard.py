"""Admin product-analytics dashboard.

Aggregates DAU/WAU/MAU, signup growth, finish/save activity, and top
content from the existing schema (no new event types required). Admin-
gated. The frontend at /admin/dashboard renders the response.

Designed to run as a single endpoint, single SELECT per metric, so the
whole dashboard loads in <500ms even at 10k events. If query latency
becomes a problem later, cache the response in a row of admin_cache or
materialize the per-day rollups.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_admin import require_admin
from ..database import get_session
from ..models import Article, Event, Profile, Source, UserArticleState

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin"])


class DailyPoint(BaseModel):
    date: str  # ISO YYYY-MM-DD
    count: int


class TopArticleRow(BaseModel):
    article_id: str
    title: str
    source_name: str
    source_slug: str
    count: int


class TopSourceRow(BaseModel):
    slug: str
    name: str
    count: int


class DashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    totals: dict[str, int]
    growth: dict[str, list[DailyPoint]]
    engagement: dict[str, Any]
    top_articles_finished: list[TopArticleRow]
    top_sources_saved: list[TopSourceRow]
    top_sources_finished: list[TopSourceRow]


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    _admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    cutoff_7d = now - timedelta(days=7)
    cutoff_1d = now - timedelta(days=1)

    # ---- totals ----
    users_total = await session.scalar(
        select(func.count()).select_from(Profile).where(Profile.onboarded_at.is_not(None))
    )
    articles_total = await session.scalar(
        select(func.count()).select_from(Article)
        .join(Source, Source.id == Article.source_id)
        .where(Source.is_active.is_(True))
    )
    ratings_total = await session.scalar(
        select(func.count()).select_from(UserArticleState).where(UserArticleState.rating.is_not(None))
    )
    finishes_total = await session.scalar(
        select(func.count()).select_from(Event).where(Event.event_type == "FINISH")
    )
    saves_total = await session.scalar(
        select(func.count()).select_from(Event).where(Event.event_type == "SAVE")
    )

    # ---- growth: per-day series for last 30 days ----
    signups_rows = await session.execute(
        select(
            func.date(Profile.created_at).label("d"),
            func.count().label("c"),
        )
        .where(Profile.onboarded_at.is_not(None))
        .where(Profile.created_at >= cutoff_30d)
        .group_by(func.date(Profile.created_at))
        .order_by(func.date(Profile.created_at))
    )
    signups_by_day = [DailyPoint(date=d.isoformat(), count=int(c)) for d, c in signups_rows.all()]

    dau_rows = await session.execute(
        select(
            func.date(Event.created_at).label("d"),
            func.count(func.distinct(Event.user_id)).label("c"),
        )
        .where(Event.created_at >= cutoff_30d)
        .group_by(func.date(Event.created_at))
        .order_by(func.date(Event.created_at))
    )
    dau_by_day = [DailyPoint(date=d.isoformat(), count=int(c)) for d, c in dau_rows.all()]

    finishes_rows = await session.execute(
        select(
            func.date(Event.created_at).label("d"),
            func.count().label("c"),
        )
        .where(Event.event_type == "FINISH")
        .where(Event.created_at >= cutoff_30d)
        .group_by(func.date(Event.created_at))
        .order_by(func.date(Event.created_at))
    )
    finishes_by_day = [DailyPoint(date=d.isoformat(), count=int(c)) for d, c in finishes_rows.all()]

    # ---- engagement aggregates ----
    active_30d = await session.scalar(
        select(func.count(func.distinct(Event.user_id))).where(Event.created_at >= cutoff_30d)
    )
    active_7d = await session.scalar(
        select(func.count(func.distinct(Event.user_id))).where(Event.created_at >= cutoff_7d)
    )
    active_1d = await session.scalar(
        select(func.count(func.distinct(Event.user_id))).where(Event.created_at >= cutoff_1d)
    )
    save_to_finish = (
        round(float(finishes_total or 0) / float(saves_total), 3)
        if saves_total else 0.0
    )
    avg_finishes_per_user = (
        round(float(finishes_total or 0) / float(users_total), 2)
        if users_total else 0.0
    )

    # ---- top articles by FINISH count ----
    top_articles_rows = await session.execute(
        select(
            Event.article_id.label("article_id"),
            func.count().label("c"),
        )
        .where(Event.event_type == "FINISH")
        .where(Event.article_id.is_not(None))
        .group_by(Event.article_id)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_article_ids_counts = list(top_articles_rows.all())
    top_articles: list[TopArticleRow] = []
    if top_article_ids_counts:
        article_ids = [aid for aid, _ in top_article_ids_counts]
        rows = await session.execute(
            select(Article.id, Article.title, Source.slug, Source.name)
            .join(Source, Source.id == Article.source_id)
            .where(Article.id.in_(article_ids))
        )
        meta_by_id = {aid: (title, slug, name) for aid, title, slug, name in rows.all()}
        for aid, c in top_article_ids_counts:
            meta = meta_by_id.get(aid)
            if meta is None:
                continue
            title, slug, name = meta
            top_articles.append(TopArticleRow(
                article_id=str(aid), title=title,
                source_name=name, source_slug=slug, count=int(c),
            ))

    # ---- top sources by SAVE and FINISH ----
    async def _top_sources(event_type: str) -> list[TopSourceRow]:
        rows = await session.execute(
            select(Source.slug, Source.name, func.count().label("c"))
            .join(Article, Article.source_id == Source.id)
            .join(Event, Event.article_id == Article.id)
            .where(Event.event_type == event_type)
            .group_by(Source.id, Source.slug, Source.name)
            .order_by(func.count().desc())
            .limit(10)
        )
        return [TopSourceRow(slug=slug, name=name, count=int(c)) for slug, name, c in rows.all()]

    top_sources_saved = await _top_sources("SAVE")
    top_sources_finished = await _top_sources("FINISH")

    return DashboardResponse(
        totals={
            "users_onboarded": int(users_total or 0),
            "articles_active": int(articles_total or 0),
            "ratings_given": int(ratings_total or 0),
            "articles_finished": int(finishes_total or 0),
            "saves": int(saves_total or 0),
        },
        growth={
            "signups_by_day": signups_by_day,
            "dau_by_day": dau_by_day,
            "finishes_by_day": finishes_by_day,
        },
        engagement={
            "active_30d": int(active_30d or 0),
            "active_7d": int(active_7d or 0),
            "active_1d": int(active_1d or 0),
            "save_to_finish_rate": save_to_finish,
            "avg_finishes_per_user": avg_finishes_per_user,
        },
        top_articles_finished=top_articles,
        top_sources_saved=top_sources_saved,
        top_sources_finished=top_sources_finished,
    )
