"""Admin-only: invite users by email via Supabase Auth admin API."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from ..auth import CurrentUser
from ..auth_admin import require_admin
from ..config import Settings, get_settings

router = APIRouter(prefix="/api/admin/invites", tags=["admin"])


class InviteRequest(BaseModel):
    email: EmailStr


class InviteResponse(BaseModel):
    invited: bool
    email: EmailStr
    user_id: str | None = None
    detail: str | None = None


@router.post("", response_model=InviteResponse)
async def invite_user(
    payload: InviteRequest,
    settings: Settings = Depends(get_settings),
    admin: CurrentUser = Depends(require_admin),
) -> InviteResponse:
    """Send a Supabase invite email to `payload.email` using the service-role key."""
    url = f"{settings.supabase_url}/auth/v1/invite"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json={"email": payload.email}, timeout=20.0)
    if resp.status_code >= 400:
        detail: str
        try:
            data = resp.json()
            detail = data.get("msg") or data.get("error_description") or data.get("error") or resp.text
        except ValueError:
            detail = resp.text
        # 422 typically means "user already exists" — surface that distinctly.
        if "already" in detail.lower() or resp.status_code == 422:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email {payload.email} already exists",
            )
        raise HTTPException(status_code=resp.status_code, detail=detail)

    body = resp.json()
    return InviteResponse(
        invited=True,
        email=payload.email,
        user_id=body.get("id") or body.get("user", {}).get("id"),
        detail=None,
    )
