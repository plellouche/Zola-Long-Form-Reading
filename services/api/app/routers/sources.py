from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..auth_admin import require_admin
from ..database import get_session
from ..models import Article, Source, SourceFollow
from ..schemas import SourceCreate, SourceFollowAck, SourceOut, SourceUpdate

router = APIRouter(prefix="/api/sources", tags=["sources"])


def _to_out(
    source: Source,
    article_count: int,
    *,
    followers_count: int = 0,
    am_following: bool = False,
) -> SourceOut:
    base = SourceOut.model_validate(source)
    base.article_count = article_count
    base.followers_count = followers_count
    base.am_following = am_following
    return base


@router.get("", response_model=list[SourceOut])
async def list_sources(
    active: bool | None = Query(default=None, description="Filter by is_active"),
    session: AsyncSession = Depends(get_session),
) -> list[SourceOut]:
    count_subq = (
        select(Article.source_id, func.count(Article.id).label("n"))
        .group_by(Article.source_id)
        .subquery()
    )
    stmt = (
        select(Source, func.coalesce(count_subq.c.n, 0))
        .outerjoin(count_subq, count_subq.c.source_id == Source.id)
        .order_by(Source.name)
    )
    if active is not None:
        stmt = stmt.where(Source.is_active.is_(active))
    result = await session.execute(stmt)
    return [_to_out(src, int(n)) for src, n in result.all()]


@router.get("/{slug}", response_model=SourceOut)
async def get_source(
    slug: str,
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> SourceOut:
    result = await session.execute(select(Source).where(Source.slug == slug.lower()))
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    article_count = await session.scalar(
        select(func.count(Article.id)).where(Article.source_id == source.id)
    )
    followers_count = await session.scalar(
        select(func.count()).select_from(SourceFollow).where(SourceFollow.source_id == source.id)
    )
    am_following = False
    if viewer is not None:
        am_following = bool(
            await session.scalar(
                select(SourceFollow).where(
                    SourceFollow.user_id == viewer.id,
                    SourceFollow.source_id == source.id,
                )
            )
        )
    return _to_out(
        source,
        int(article_count or 0),
        followers_count=int(followers_count or 0),
        am_following=am_following,
    )


@router.post("/{slug}/follow", response_model=SourceFollowAck)
async def follow_source(
    slug: str,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SourceFollowAck:
    source = await session.scalar(select(Source).where(Source.slug == slug.lower()))
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    stmt = (
        pg_insert(SourceFollow)
        .values(user_id=current.id, source_id=source.id)
        .on_conflict_do_nothing()
    )
    await session.execute(stmt)
    await session.commit()
    return SourceFollowAck(source_id=source.id, am_following=True)


@router.delete("/{slug}/follow", response_model=SourceFollowAck)
async def unfollow_source(
    slug: str,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SourceFollowAck:
    source = await session.scalar(select(Source).where(Source.slug == slug.lower()))
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    existing = await session.scalar(
        select(SourceFollow).where(
            SourceFollow.user_id == current.id,
            SourceFollow.source_id == source.id,
        )
    )
    if existing is not None:
        await session.delete(existing)
        await session.commit()
    return SourceFollowAck(source_id=source.id, am_following=False)


@router.post("", response_model=SourceOut, status_code=status.HTTP_201_CREATED)
async def create_source(
    payload: SourceCreate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_admin),
) -> Source:
    source = Source(
        name=payload.name,
        slug=payload.slug,
        homepage_url=str(payload.homepage_url),
        rss_url=str(payload.rss_url) if payload.rss_url else None,
        content_policy=payload.content_policy,
        kind=payload.kind,
        trust_score=payload.trust_score,
        is_active=payload.is_active,
    )
    session.add(source)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A source with that slug already exists.",
        ) from exc
    await session.refresh(source)
    return source


@router.patch("/{source_id}", response_model=SourceOut)
async def update_source(
    source_id: UUID,
    payload: SourceUpdate,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_admin),
) -> Source:
    result = await session.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in {"homepage_url", "rss_url"} and value is not None:
            value = str(value)
        setattr(source, field, value)
    await session.commit()
    await session.refresh(source)
    return source
