from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import ColumnElement, and_, func, or_, select, tuple_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user_optional
from ..auth_admin import require_admin
from ..cursor import decode_cursor, encode_cursor
from ..database import get_session
from ..filters import arachnid_exclude_clause
from ..models import Article, ArticleTopic, Source, Topic
from ..schemas import (
    ArticleCreate,
    ArticleDetail,
    ArticleSummary,
    ArticleTopicLink,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])

SortKey = Literal["newest", "popular", "reading_time_asc"]


class ArticleListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[ArticleSummary]
    next_cursor: str | None = None


def _summary(article: Article) -> ArticleSummary:
    return ArticleSummary.model_validate(article)


def _detail(article: Article) -> ArticleDetail:
    base = ArticleDetail.model_validate(article)
    base.topics = [
        ArticleTopicLink(topic_id=link.topic_id, weight=link.weight)
        for link in article.topic_links
    ]
    return base


def _sort_columns(sort: SortKey) -> tuple[ColumnElement, ColumnElement]:
    """Return (key_column, id_column) for the requested sort. Descending order."""
    if sort == "newest":
        return Article.created_at, Article.id
    if sort == "popular":
        return Article.save_count, Article.id
    if sort == "reading_time_asc":
        return Article.reading_time_minutes, Article.id
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown sort")


def _row_cursor_value(article: Article, sort: SortKey):
    if sort == "newest":
        return article.created_at
    if sort == "popular":
        return article.save_count
    if sort == "reading_time_asc":
        return article.reading_time_minutes
    return None


def _parse_cursor_value(sort: SortKey, raw_key):
    """Coerce JSON-decoded cursor key back to the column's Python type."""
    if sort == "newest":
        if isinstance(raw_key, str):
            return datetime.fromisoformat(raw_key)
        return raw_key
    return raw_key


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    q: str | None = Query(default=None, description="Full-text search query"),
    source_slug: str | None = Query(default=None),
    topic_slug: str | None = Query(default=None),
    min_reading_time: int | None = Query(default=None, ge=0, le=600),
    max_reading_time: int | None = Query(default=None, ge=0, le=600),
    from_date: date | None = Query(default=None, description="publication_date >= this"),
    to_date: date | None = Query(default=None, description="publication_date <= this"),
    sort: SortKey = Query(default="newest"),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> ArticleListResponse:
    return await _execute(
        session=session,
        q=q,
        source_slug=source_slug,
        topic_slug=topic_slug,
        min_reading_time=min_reading_time,
        max_reading_time=max_reading_time,
        from_date=from_date,
        to_date=to_date,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )


async def _execute(
    *,
    session: AsyncSession,
    q: str | None,
    source_slug: str | None,
    topic_slug: str | None,
    min_reading_time: int | None,
    max_reading_time: int | None,
    from_date: date | None,
    to_date: date | None,
    sort: SortKey,
    cursor: str | None,
    limit: int,
) -> ArticleListResponse:
    stmt = select(Article).where(arachnid_exclude_clause(Article))

    if source_slug:
        stmt = stmt.join(Source).where(Source.slug == source_slug.lower())
    if topic_slug:
        stmt = stmt.join(ArticleTopic, ArticleTopic.article_id == Article.id).join(
            Topic, Topic.id == ArticleTopic.topic_id
        ).where(Topic.slug == topic_slug.lower())
    if min_reading_time is not None:
        stmt = stmt.where(Article.reading_time_minutes >= min_reading_time)
    if max_reading_time is not None:
        stmt = stmt.where(Article.reading_time_minutes <= max_reading_time)
    if from_date is not None:
        stmt = stmt.where(Article.publication_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(Article.publication_date <= to_date)
    if q and q.strip():
        ts_query = func.websearch_to_tsquery("english", q)
        stmt = stmt.where(Article.search_tsv.op("@@")(ts_query))

    key_col, id_col = _sort_columns(sort)
    ascending = sort == "reading_time_asc"

    if ascending:
        # reading time has nulls; exclude them for stable ordering
        stmt = stmt.where(Article.reading_time_minutes.is_not(None))

    if cursor:
        try:
            raw_key, last_id = decode_cursor(cursor)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc
        key_val = _parse_cursor_value(sort, raw_key)
        op = ">" if ascending else "<"
        stmt = stmt.where(
            tuple_(key_col, id_col).op(op)(tuple_(key_val, last_id))
        )

    if ascending:
        stmt = stmt.order_by(key_col.asc(), id_col.asc())
    else:
        stmt = stmt.order_by(key_col.desc(), id_col.desc())

    stmt = stmt.limit(limit + 1)

    result = await session.execute(stmt)
    fetched = list(result.scalars().unique().all())
    has_more = len(fetched) > limit
    items_db = fetched[:limit]

    next_cursor: str | None = None
    if has_more and items_db:
        last = items_db[-1]
        next_cursor = encode_cursor(_row_cursor_value(last, sort), last.id)

    return ArticleListResponse(
        items=[_summary(a) for a in items_db],
        next_cursor=next_cursor,
    )


@router.get("/{article_id}", response_model=ArticleDetail)
async def get_article(
    article_id: UUID, session: AsyncSession = Depends(get_session)
) -> ArticleDetail:
    result = await session.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _detail(article)


@router.post("", response_model=ArticleDetail, status_code=status.HTTP_201_CREATED)
async def create_article(
    payload: ArticleCreate,
    session: AsyncSession = Depends(get_session),
    admin: CurrentUser = Depends(require_admin),
) -> ArticleDetail:
    source_result = await session.execute(select(Source).where(Source.id == payload.source_id))
    source = source_result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown source_id")

    if payload.topic_ids:
        topics_result = await session.execute(
            select(Topic.id).where(Topic.id.in_(payload.topic_ids))
        )
        found = {row[0] for row in topics_result.all()}
        missing = set(payload.topic_ids) - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown topic ids: {sorted(str(m) for m in missing)}",
            )

    article = Article(
        source_id=payload.source_id,
        title=payload.title,
        author=payload.author,
        publication_date=payload.publication_date,
        canonical_url=str(payload.canonical_url),
        og_image_url=str(payload.og_image_url) if payload.og_image_url else None,
        description=payload.description,
        reading_time_minutes=payload.reading_time_minutes,
        word_count=payload.word_count,
        content_policy=payload.content_policy or source.content_policy,
        quality_score=payload.quality_score,
        submitted_by=admin.id,
    )
    session.add(article)

    try:
        await session.flush()
        for tid in payload.topic_ids:
            session.add(ArticleTopic(article_id=article.id, topic_id=tid, weight=1.0))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "canonical_url" in str(exc.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An article with that canonical URL already exists.",
            ) from exc
        raise

    await session.refresh(article)
    return _detail(article)
