"""Follows + activity feed."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..database import get_session
from ..models import Article, Event, Follow, Profile
from ..schemas import ActivityItem, ArticleSummary, FollowAck, PublicProfile

router = APIRouter(prefix="/api", tags=["social"])


async def _resolve_user(session: AsyncSession, username: str) -> Profile:
    profile = await session.scalar(
        select(Profile).where(Profile.username == username.lower())
    )
    if profile is None or profile.onboarded_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return profile


def _public_profile(
    target: Profile,
    *,
    followers: int,
    following: int,
    am_following: bool,
    is_self: bool,
) -> PublicProfile:
    out = PublicProfile.model_validate(target)
    out.followers_count = followers
    out.following_count = following
    out.am_following = am_following
    out.is_self = is_self
    return out


async def _public_profile_with_counts(
    session: AsyncSession, target: Profile, viewer_id: UUID | None
) -> PublicProfile:
    followers = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.followee_id == target.id)
    )
    following = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.follower_id == target.id)
    )
    am_following = False
    if viewer_id is not None and viewer_id != target.id:
        am_following = bool(
            await session.scalar(
                select(Follow).where(
                    Follow.follower_id == viewer_id,
                    Follow.followee_id == target.id,
                )
            )
        )
    return _public_profile(
        target,
        followers=int(followers or 0),
        following=int(following or 0),
        am_following=am_following,
        is_self=viewer_id is not None and viewer_id == target.id,
    )


# ---------- follow / unfollow ----------


@router.post("/users/{username}/follow", response_model=FollowAck)
async def follow_user(
    username: str,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FollowAck:
    target = await _resolve_user(session, username)
    if target.id == current.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")
    stmt = (
        pg_insert(Follow)
        .values(follower_id=current.id, followee_id=target.id)
        .on_conflict_do_nothing(index_elements=["follower_id", "followee_id"])
    )
    await session.execute(stmt)
    session.add(
        Event(
            user_id=current.id,
            event_type="FOLLOW",
            event_metadata={"followee_id": str(target.id)},
        )
    )
    await session.commit()
    return FollowAck(follower_id=current.id, followee_id=target.id, am_following=True)


@router.delete("/users/{username}/follow", response_model=FollowAck)
async def unfollow_user(
    username: str,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FollowAck:
    target = await _resolve_user(session, username)
    existing = await session.scalar(
        select(Follow).where(
            Follow.follower_id == current.id, Follow.followee_id == target.id
        )
    )
    if existing is not None:
        await session.delete(existing)
        session.add(
            Event(
                user_id=current.id,
                event_type="UNFOLLOW",
                event_metadata={"followee_id": str(target.id)},
            )
        )
        await session.commit()
    return FollowAck(follower_id=current.id, followee_id=target.id, am_following=False)


@router.get("/users/{username}/followers", response_model=list[PublicProfile])
async def list_followers(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[PublicProfile]:
    target = await _resolve_user(session, username)
    result = await session.execute(
        select(Profile)
        .join(Follow, Follow.follower_id == Profile.id)
        .where(Follow.followee_id == target.id)
        .order_by(Follow.created_at.desc())
        .limit(limit)
    )
    profiles = list(result.scalars().all())
    viewer_id = viewer.id if viewer else None
    out: list[PublicProfile] = []
    for p in profiles:
        out.append(await _public_profile_with_counts(session, p, viewer_id))
    return out


@router.get("/users/{username}/following", response_model=list[PublicProfile])
async def list_following(
    username: str,
    limit: int = Query(default=50, ge=1, le=200),
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[PublicProfile]:
    target = await _resolve_user(session, username)
    result = await session.execute(
        select(Profile)
        .join(Follow, Follow.followee_id == Profile.id)
        .where(Follow.follower_id == target.id)
        .order_by(Follow.created_at.desc())
        .limit(limit)
    )
    profiles = list(result.scalars().all())
    viewer_id = viewer.id if viewer else None
    out: list[PublicProfile] = []
    for p in profiles:
        out.append(await _public_profile_with_counts(session, p, viewer_id))
    return out


# ---------- activity feed ----------


@router.get("/me/feed/activity", response_model=list[ActivityItem])
async def my_activity_feed(
    limit: int = Query(default=30, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ActivityItem]:
    """Recent SAVE / LIST_ADD events from users I follow."""
    followee_subq = (
        select(Follow.followee_id).where(Follow.follower_id == current.id).subquery()
    )
    stmt = (
        select(Event, Profile, Article)
        .join(Profile, Profile.id == Event.user_id)
        .join(Article, Article.id == Event.article_id)
        .where(Event.user_id.in_(select(followee_subq.c.followee_id)))
        .where(Event.event_type.in_(["SAVE", "LIST_ADD"]))
        .where(Event.article_id.is_not(None))
        .order_by(Event.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    items: list[ActivityItem] = []
    for event, profile, article in result.unique().all():
        items.append(
            ActivityItem(
                event_id=event.id,
                event_type=event.event_type,
                created_at=event.created_at,
                actor=_public_profile(
                    profile,
                    followers=0,
                    following=0,
                    am_following=True,  # by definition of being in this feed
                    is_self=False,
                ),
                article=ArticleSummary.model_validate(article),
            )
        )
    return items
