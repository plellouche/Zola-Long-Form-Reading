from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

ContentPolicyType = Literal["REDIRECT_ONLY", "EMBED_ALLOWED", "FULLTEXT_ALLOWED"]
SourceKindType = Literal["PUBLICATION", "BLOG", "DISCOVERY_SURFACE", "PAYWALLED_FREE_SUBSET"]
AccessTierType = Literal["free", "metered", "locked", "unknown"]

# Strictness order: locked > metered > free > unknown.
# Used by resolve_access_tier() to pick the more-restrictive signal when the
# article and its source disagree (e.g. NYer tags an article 'free' but the
# source is hinted 'metered').
_TIER_STRICTNESS = {"locked": 3, "metered": 2, "free": 1, "unknown": 0}


def resolve_access_tier(article_tier: str, source_hint: str | None) -> AccessTierType:
    """Pick the stricter of (per-article signal, source-level curator hint).

    Per-article tier comes from the publisher's emitted metadata at ingest
    time. Source hint comes from human curation (`sources.paywall_hint`).
    The resolution rule: a publisher saying 'metered' overrides a source
    hint of nothing, but a curator marking the source 'metered' overrides a
    publisher's optimistic 'free'.
    """
    candidates: list[str] = [article_tier]
    if source_hint:
        candidates.append(source_hint)
    return max(candidates, key=lambda t: _TIER_STRICTNESS.get(t, 0))  # type: ignore[return-value]
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
    last_ingest_status: str | None = None
    last_ingest_article_count: int = 0
    last_ingest_error: str | None = None
    consecutive_failures: int = 0
    article_count: int = 0
    followers_count: int = 0
    am_following: bool = False
    created_at: datetime


class SourceFollowAck(BaseModel):
    source_id: UUID
    am_following: bool


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
    access_tier: AccessTierType
    quality_score: float
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _resolve_access_tier_from_source_hint(cls, data: Any) -> Any:
        """If serializing a SQLAlchemy Article, fold source.paywall_hint into
        access_tier so callers see the stricter (article, source) value.

        Skips when `data` is already a dict (POST payloads, tests) — those
        callers either pass access_tier directly or accept the default.
        """
        if isinstance(data, dict):
            return data
        article_tier = getattr(data, "access_tier", "unknown")
        src = getattr(data, "source", None)
        src_hint = getattr(src, "paywall_hint", None) if src is not None else None
        resolved = resolve_access_tier(article_tier, src_hint)
        # Replace the orm attribute via a tiny shim object so model_validate's
        # attribute access still finds everything else on the original.
        if resolved != article_tier:
            object.__setattr__(data, "access_tier", resolved)
        return data


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
    access_tier: AccessTierType = "unknown"
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
