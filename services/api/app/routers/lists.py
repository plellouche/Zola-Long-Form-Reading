"""Reading lists: CRUD + items."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..database import get_session
from ..models import Article, Event, ListItem, Profile, ReadingList
from ..schemas import (
    ArticleSummary,
    ListBrief,
    ListCreate,
    ListDetail,
    ListItemCreate,
    ListItemOut,
    ListReorderRequest,
    ListUpdate,
)

router = APIRouter(prefix="/api/lists", tags=["lists"])


def _brief(row: ReadingList, item_count: int) -> ListBrief:
    base = ListBrief.model_validate(row)
    base.item_count = item_count
    return base


def _detail(row: ReadingList) -> ListDetail:
    base = ListDetail.model_validate(row)
    base.item_count = len(row.items)
    base.items = [
        ListItemOut(
            article=ArticleSummary.model_validate(item.article),
            position=item.position,
            added_at=item.added_at,
        )
        for item in sorted(row.items, key=lambda i: i.position)
    ]
    return base


async def _load_list(session: AsyncSession, list_id: UUID) -> ReadingList:
    row = await session.scalar(select(ReadingList).where(ReadingList.id == list_id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return row


def _ensure_owner(row: ReadingList, current: CurrentUser) -> None:
    if row.user_id != current.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your list")


# ---------- CRUD on lists ----------


@router.post("", response_model=ListBrief, status_code=status.HTTP_201_CREATED)
async def create_list(
    payload: ListCreate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListBrief:
    row = ReadingList(
        user_id=current.id,
        title=payload.title,
        description=payload.description,
        is_public=payload.is_public,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _brief(row, 0)


@router.get("", response_model=list[ListBrief])
async def list_lists(
    user_id: UUID | None = Query(default=None),
    username: str | None = Query(default=None),
    mine: bool = Query(default=False, description="Override: return current user's lists"),
    current: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[ListBrief]:
    target_user_id: UUID | None = None
    if mine:
        if current is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
        target_user_id = current.id
    elif user_id is not None:
        target_user_id = user_id
    elif username is not None:
        profile = await session.scalar(select(Profile).where(Profile.username == username.lower()))
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        target_user_id = profile.id

    item_count_subq = (
        select(ListItem.list_id, func.count(ListItem.id).label("n"))
        .group_by(ListItem.list_id)
        .subquery()
    )

    stmt = (
        select(ReadingList, func.coalesce(item_count_subq.c.n, 0))
        .outerjoin(item_count_subq, item_count_subq.c.list_id == ReadingList.id)
        .order_by(ReadingList.updated_at.desc())
        .limit(100)
    )

    if target_user_id is not None:
        stmt = stmt.where(ReadingList.user_id == target_user_id)
        if current is None or current.id != target_user_id:
            stmt = stmt.where(ReadingList.is_public.is_(True))
    else:
        # No user filter: only show public lists.
        stmt = stmt.where(ReadingList.is_public.is_(True))

    result = await session.execute(stmt)
    return [_brief(row, int(n)) for row, n in result.all()]


@router.get("/{list_id}", response_model=ListDetail)
async def get_list(
    list_id: UUID,
    current: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    row = await _load_list(session, list_id)
    if not row.is_public and (current is None or current.id != row.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return _detail(row)


@router.patch("/{list_id}", response_model=ListDetail)
async def update_list(
    list_id: UUID,
    payload: ListUpdate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    row = await _load_list(session, list_id)
    _ensure_owner(row, current)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await session.commit()
    await session.refresh(row)
    return _detail(row)


@router.delete("/{list_id}")
async def delete_list(
    list_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    row = await _load_list(session, list_id)
    _ensure_owner(row, current)
    await session.delete(row)
    await session.commit()
    return {"ok": True}


# ---------- items ----------


@router.post("/{list_id}/items", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
async def add_item(
    list_id: UUID,
    payload: ListItemCreate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    row = await _load_list(session, list_id)
    _ensure_owner(row, current)

    # Ensure article exists
    article = await session.scalar(select(Article).where(Article.id == payload.article_id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown article_id")

    max_pos = await session.scalar(
        select(func.coalesce(func.max(ListItem.position), -1)).where(ListItem.list_id == list_id)
    )
    next_pos = (max_pos or -1) + 1

    item = ListItem(list_id=list_id, article_id=payload.article_id, position=next_pos)
    session.add(item)
    session.add(
        Event(
            user_id=current.id,
            article_id=payload.article_id,
            event_type="LIST_ADD",
            event_metadata={"list_id": str(list_id)},
        )
    )

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "list_items_uniq" in str(exc.orig) or "duplicate" in str(exc.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Article already in this list"
            ) from exc
        raise
    await session.refresh(row)
    return _detail(row)


@router.delete("/{list_id}/items/{article_id}", response_model=ListDetail)
async def remove_item(
    list_id: UUID,
    article_id: UUID,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    row = await _load_list(session, list_id)
    _ensure_owner(row, current)

    item = await session.scalar(
        select(ListItem).where(ListItem.list_id == list_id, ListItem.article_id == article_id)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not in list")
    await session.delete(item)
    await session.commit()
    await session.refresh(row)
    return _detail(row)


@router.put("/{list_id}/reorder", response_model=ListDetail)
async def reorder_items(
    list_id: UUID,
    payload: ListReorderRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListDetail:
    row = await _load_list(session, list_id)
    _ensure_owner(row, current)

    by_article = {p.article_id: p.position for p in payload.items}
    if not by_article:
        return _detail(row)

    existing_items = list(row.items)
    existing_article_ids = {item.article_id for item in existing_items}
    unknown = set(by_article) - existing_article_ids
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Articles not in list: {sorted(str(u) for u in unknown)}",
        )

    # Use a two-pass swap to satisfy the (list_id, article_id) unique constraint
    # incidentally — positions aren't constrained unique, so a single-pass is fine
    # too. Keeping the simple variant.
    for item in existing_items:
        new_pos = by_article.get(item.article_id)
        if new_pos is not None and new_pos != item.position:
            item.position = new_pos
    await session.commit()
    await session.refresh(row)
    return _detail(row)
