"""Article comments (flat, signed-in to write, public to read).

Routes:
  GET    /api/articles/{id}/comments  — list (public, paginated)
  POST   /api/articles/{id}/comments  — create (signed-in)
  DELETE /api/comments/{id}           — soft-delete (owner or admin)

Render is plain-text on the client; we don't allow markdown or HTML.
URLs are auto-linkified at render time, not stored as anchors.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..database import get_session
from ..models import Article, Comment, Profile
from ..schemas import PublicProfile

router = APIRouter(tags=["comments"])


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    article_id: UUID
    body: str
    created_at: datetime
    updated_at: datetime
    author: PublicProfile
    can_delete: bool = False  # set per-request


class CommentListResponse(BaseModel):
    items: list[CommentOut]
    total: int


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.get("/api/articles/{article_id}/comments", response_model=CommentListResponse)
async def list_comments(
    article_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> CommentListResponse:
    # Confirm the article exists so we 404 cleanly instead of returning [].
    exists = await session.scalar(select(Article.id).where(Article.id == article_id))
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    rows = (await session.execute(
        select(Comment)
        .where(Comment.article_id == article_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc())
        .limit(limit)
    )).scalars().unique().all()

    viewer_id = viewer.id if viewer else None
    is_admin = False
    if viewer_id:
        role = await session.scalar(
            select(Profile.role).where(Profile.id == viewer_id)
        )
        is_admin = (role == "admin")

    items = []
    for c in rows:
        out = CommentOut.model_validate(c)
        out.author = PublicProfile.model_validate(c.author)
        out.can_delete = bool(viewer_id and (c.user_id == viewer_id or is_admin))
        items.append(out)

    return CommentListResponse(items=items, total=len(items))


@router.post(
    "/api/articles/{article_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    article_id: UUID,
    payload: CommentCreateRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CommentOut:
    exists = await session.scalar(select(Article.id).where(Article.id == article_id))
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    comment = Comment(
        article_id=article_id,
        user_id=current.id,
        body=payload.body.strip(),
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)

    out = CommentOut.model_validate(comment)
    out.author = PublicProfile.model_validate(comment.author)
    out.can_delete = True
    return out


@router.delete(
    "/api/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,  # 204 must have no body — Response signals empty
)
async def delete_comment(
    comment_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    comment = await session.scalar(
        select(Comment).where(Comment.id == comment_id, Comment.deleted_at.is_(None))
    )
    if comment is None:
        # 404 (not 403) when the comment is missing OR already deleted —
        # don't leak whether the id ever existed.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    is_owner = comment.user_id == current.id
    is_admin = False
    if not is_owner:
        role = await session.scalar(select(Profile.role).where(Profile.id == current.id))
        is_admin = (role == "admin")
    if not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")

    comment.deleted_at = datetime.now(timezone.utc)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
