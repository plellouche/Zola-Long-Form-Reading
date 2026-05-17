from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user_optional
from ..database import get_session
from ..models import Event
from ..schemas import EventCreate, EventOut

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> Event:
    event = Event(
        user_id=current.id if current else None,
        article_id=payload.article_id,
        event_type=payload.event_type,
        event_metadata=payload.metadata,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event
