from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Topic
from ..schemas import TopicOut

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(session: AsyncSession = Depends(get_session)) -> list[Topic]:
    result = await session.execute(select(Topic).order_by(Topic.name))
    return list(result.scalars().all())


@router.get("/{slug}", response_model=TopicOut)
async def get_topic(slug: str, session: AsyncSession = Depends(get_session)) -> Topic:
    result = await session.execute(select(Topic).where(Topic.slug == slug.lower()))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic
