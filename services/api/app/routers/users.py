from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..auth_admin import maybe_bootstrap_admin
from ..config import Settings, get_settings
from ..database import get_session
from ..models import Follow, Profile, Topic, UserTopic
from ..schemas import OnboardingRequest, ProfileMe, ProfileUpdate, PublicProfile

router = APIRouter(prefix="/api/users", tags=["users"])


async def _load_profile(session: AsyncSession, user_id: UUID) -> Profile:
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        # The auth.users → profiles trigger should always run; if it didn't, surface clearly.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile row missing for current user; signup trigger may have failed.",
        )
    return profile


@router.get("/me", response_model=ProfileMe)
async def get_me(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Profile:
    profile = await _load_profile(session, current.id)
    await maybe_bootstrap_admin(session, profile, current, settings)
    return profile


@router.patch("/me", response_model=ProfileMe)
async def update_me(
    payload: ProfileUpdate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    profile = await _load_profile(session, current.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.post("/me/onboarding", response_model=ProfileMe)
async def complete_onboarding(
    payload: OnboardingRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    profile = await _load_profile(session, current.id)

    if profile.onboarded_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Onboarding already completed.",
        )

    # Validate referenced topics exist.
    if payload.topic_ids:
        result = await session.execute(select(Topic.id).where(Topic.id.in_(payload.topic_ids)))
        found = {row[0] for row in result.all()}
        missing = set(payload.topic_ids) - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown topic ids: {sorted(str(m) for m in missing)}",
            )

    profile.username = payload.username
    if payload.display_name is not None:
        profile.display_name = payload.display_name
    profile.onboarded_at = datetime.now(timezone.utc)

    # Replace user_topics with the new set (onboarding only runs once, so 'replace' is fine).
    await session.execute(delete(UserTopic).where(UserTopic.user_id == current.id))
    for topic_id in payload.topic_ids:
        session.add(UserTopic(user_id=current.id, topic_id=topic_id, weight=1.0))

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # Most likely a duplicate username.
        if "profiles_username_key" in str(exc.orig) or "duplicate key" in str(exc.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken.",
            ) from exc
        raise

    await session.refresh(profile)
    return profile


@router.get("/{username}", response_model=PublicProfile)
async def get_user_by_username(
    username: str,
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> PublicProfile:
    profile = await session.scalar(
        select(Profile).where(
            Profile.username == username.lower(),
            Profile.onboarded_at.is_not(None),
        )
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    followers = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.followee_id == profile.id)
    )
    following = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.follower_id == profile.id)
    )
    am_following = False
    is_self = False
    if viewer is not None:
        is_self = viewer.id == profile.id
        if not is_self:
            am_following = bool(
                await session.scalar(
                    select(Follow).where(
                        Follow.follower_id == viewer.id,
                        Follow.followee_id == profile.id,
                    )
                )
            )

    out = PublicProfile.model_validate(profile)
    out.followers_count = int(followers or 0)
    out.following_count = int(following or 0)
    out.am_following = am_following
    out.is_self = is_self
    return out
