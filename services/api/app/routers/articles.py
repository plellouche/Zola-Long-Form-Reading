from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user_optional
from ..auth_admin import require_admin
from ..database import get_session
from ..models import Article, ArticleTopic, Source, Topic
from ..schemas import (
    ArticleCreate,
    ArticleDetail,
    ArticleSummary,
    ArticleTopicLink,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _summary(article: Article) -> ArticleSummary:
    return ArticleSummary.model_validate(article)


def _detail(article: Article) -> ArticleDetail:
    base = ArticleDetail.model_validate(article)
    base.topics = [
        ArticleTopicLink(topic_id=link.topic_id, weight=link.weight)
        for link in article.topic_links
    ]
    return base


@router.get("", response_model=list[ArticleSummary])
async def list_articles(
    source_slug: str | None = Query(default=None),
    topic_slug: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    stmt = select(Article)

    if source_slug:
        stmt = stmt.join(Source).where(Source.slug == source_slug.lower())
    if topic_slug:
        stmt = stmt.join(ArticleTopic, ArticleTopic.article_id == Article.id).join(
            Topic, Topic.id == ArticleTopic.topic_id
        ).where(Topic.slug == topic_slug.lower())

    stmt = stmt.order_by(
        Article.publication_date.desc().nullslast(),
        Article.created_at.desc(),
    ).offset(offset).limit(limit)

    result = await session.execute(stmt)
    return [_summary(a) for a in result.scalars().unique().all()]


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
        await session.flush()  # get article.id before topic links
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
