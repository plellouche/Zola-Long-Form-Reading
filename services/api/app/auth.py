from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from .config import Settings, get_settings

ASYMMETRIC_ALGS = {"ES256", "RS256", "EdDSA"}


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    role: str  # 'authenticated' from Supabase tokens; app-level role lives on `profiles`


@lru_cache(maxsize=1)
def _jwks_client(supabase_url: str) -> PyJWKClient:
    """Cache the JWKS client across requests (it has its own key cache too)."""
    url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return auth_header.split(" ", 1)[1].strip()


def _decode_token(token: str, settings: Settings) -> dict:
    """Verify a Supabase access token, supporting both modern (ES256/RS256 via JWKS)
    and legacy (HS256 shared secret) signing schemes."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Malformed token: {exc}"
        ) from exc

    alg = header.get("alg")
    kid = header.get("kid")

    common = {"audience": "authenticated"}

    if alg in ASYMMETRIC_ALGS and kid:
        signing_key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token).key
        return jwt.decode(token, signing_key, algorithms=[alg], **common)

    if alg == "HS256":
        return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], **common)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Unsupported token algorithm: {alg}",
    )


def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    token = _extract_bearer_token(request)
    try:
        payload = _decode_token(token, settings)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}"
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")

    try:
        user_id = UUID(sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a UUID",
        ) from exc

    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )


def get_current_user_optional(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    if not request.headers.get("Authorization"):
        return None
    return get_current_user(request, settings)
