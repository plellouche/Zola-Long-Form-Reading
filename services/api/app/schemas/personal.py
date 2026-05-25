from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .content import ArticleSummary

UserArticleStatus = Literal["SAVED", "READING", "FINISHED", "DISMISSED", "INTERESTED"]
ArticleRating = Literal["LOVED", "LIKED", "OK"]


# ---------- user_article_states ----------


class UserArticleStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: UUID
    status: UserArticleStatus
    opened_at: datetime | None
    finished_at: datetime | None
    time_spent_seconds: int
    rating: ArticleRating | None = None
    updated_at: datetime


class SetArticleStateRequest(BaseModel):
    status: UserArticleStatus


class SetArticleRatingRequest(BaseModel):
    """Rate an already-finished article. Send rating=null to clear."""

    rating: ArticleRating | None


class StatefulArticle(BaseModel):
    """Article + the current user's state for it."""

    article: ArticleSummary
    state: UserArticleStateOut


# ---------- lists ----------


class ListBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    title: str
    description: str | None
    is_public: bool
    forked_from_id: UUID | None
    created_at: datetime
    updated_at: datetime
    item_count: int = 0


class ListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article: ArticleSummary
    position: int
    added_at: datetime


class ListDetail(ListBrief):
    items: list[ListItemOut] = Field(default_factory=list)


class ListCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool = True


class ListUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


class ListItemCreate(BaseModel):
    article_id: UUID


class ListItemPositions(BaseModel):
    article_id: UUID
    position: int


class ListReorderRequest(BaseModel):
    items: list[ListItemPositions]
