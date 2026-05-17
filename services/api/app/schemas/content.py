from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

ContentPolicyType = Literal["REDIRECT_ONLY", "EMBED_ALLOWED", "FULLTEXT_ALLOWED"]
SourceKindType = Literal["PUBLICATION", "BLOG", "DISCOVERY_SURFACE", "PAYWALLED_FREE_SUBSET"]
EventTypeType = Literal[
    "OPEN", "FINISH", "SAVE", "DISMISS", "LINK_CLICK", "LIST_ADD", "FOLLOW", "UNFOLLOW"
]


# ---------- sources ----------


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    homepage_url: str
    rss_url: str | None
    content_policy: ContentPolicyType
    kind: SourceKindType
    trust_score: float
    is_active: bool
    last_ingested_at: datetime | None
    created_at: datetime


class SourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9-]+$")
    homepage_url: HttpUrl
    rss_url: HttpUrl | None = None
    content_policy: ContentPolicyType = "REDIRECT_ONLY"
    kind: SourceKindType = "PUBLICATION"
    trust_score: float = Field(default=0.7, ge=0.0, le=1.0)
    is_active: bool = True


class SourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    homepage_url: HttpUrl | None = None
    rss_url: HttpUrl | None = None
    content_policy: ContentPolicyType | None = None
    kind: SourceKindType | None = None
    trust_score: float | None = Field(default=None, ge=0.0, le=1.0)
    is_active: bool | None = None


# ---------- articles ----------


class ArticleTopicLink(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    topic_id: UUID
    weight: float


class ArticleSummary(BaseModel):
    """Card view: enough to render a list/grid without a join roundtrip."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: SourceOut
    title: str
    author: str | None
    publication_date: date | None
    canonical_url: str
    og_image_url: str | None
    description: str | None
    reading_time_minutes: int | None
    content_policy: ContentPolicyType
    quality_score: float
    created_at: datetime


class ArticleDetail(ArticleSummary):
    word_count: int | None
    full_text: str | None
    save_count: int
    finish_count: int
    topics: list[ArticleTopicLink] = Field(default_factory=list)


class ArticleCreate(BaseModel):
    source_id: UUID
    title: str = Field(min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=200)
    publication_date: date | None = None
    canonical_url: HttpUrl
    og_image_url: HttpUrl | None = None
    description: str | None = Field(default=None, max_length=2000)
    reading_time_minutes: int | None = Field(default=None, ge=0, le=600)
    word_count: int | None = Field(default=None, ge=0)
    content_policy: ContentPolicyType | None = None  # falls back to source.content_policy
    quality_score: float = Field(default=0.5, ge=0.0, le=1.0)
    topic_ids: list[UUID] = Field(default_factory=list)


# ---------- events ----------


class EventCreate(BaseModel):
    event_type: EventTypeType
    article_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: EventTypeType
    user_id: UUID | None
    article_id: UUID | None
    created_at: datetime
