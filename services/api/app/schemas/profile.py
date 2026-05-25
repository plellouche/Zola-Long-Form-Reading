from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9_-]{3,30}$")


class ProfileMe(BaseModel):
    """Authenticated user's view of their own profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    role: str  # 'user' | 'admin'
    onboarded_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class PublicProfile(BaseModel):
    """Public view of a user's profile."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None
    avatar_url: str | None
    bio: str | None
    followers_count: int = 0
    following_count: int = 0
    am_following: bool = False  # caller follows this user
    is_self: bool = False  # caller IS this user


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=500)


class OnboardingRequest(BaseModel):
    username: str
    display_name: str | None = Field(default=None, max_length=80)
    topic_ids: list[UUID] = Field(default_factory=list)

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError(
                "username must be 3-30 chars, lowercase letters/digits/underscore/hyphen"
            )
        return v


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    description: str | None


class ProfileStats(BaseModel):
    """Reading stats for a user's profile card.

    Numbers are derived from `user_article_states` rows with status='FINISHED'
    plus a join to `articles` for length. Falls back to zeros when the user
    has no finishes yet.
    """

    finished_count: int
    hours_read: float  # sum of reading_time_minutes / 60, rounded to 1 decimal
    sources_explored: int
    avg_minutes: int | None  # mean reading_time_minutes across finished
    current_streak: int  # consecutive days ending today with ≥1 finish
    top_source: dict | None  # {slug, name, count} of the most-finished source
