"""Admin-role enforcement helpers."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import CurrentUser, get_current_user
from .config import Settings, get_settings
from .database import get_session
from .models import Profile


async def _load_profile(session: AsyncSession, user_id) -> Profile:
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


async def maybe_bootstrap_admin(
    session: AsyncSession,
    profile: Profile,
    current: CurrentUser,
    settings: Settings,
) -> None:
    """Promote a user to admin if their email is in ADMIN_BOOTSTRAP_EMAILS."""
    if profile.role == "admin":
        return
    if not current.email:
        return
    if current.email.lower() not in settings.admin_emails:
        return
    profile.role = "admin"
    await session.commit()


async def require_admin(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    profile = await _load_profile(session, current.id)
    await maybe_bootstrap_admin(session, profile, current, settings)
    if profile.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current
