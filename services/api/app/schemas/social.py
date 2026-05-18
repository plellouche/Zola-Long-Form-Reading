from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from .content import ArticleSummary
from .profile import PublicProfile


class FollowAck(BaseModel):
    follower_id: UUID
    followee_id: UUID
    am_following: bool


class ActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID
    event_type: str  # 'SAVE' | 'LIST_ADD' | ...
    created_at: datetime
    actor: PublicProfile
    article: ArticleSummary
