from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, TSVECTOR, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


CONTENT_POLICY_CHECK = "content_policy in ('REDIRECT_ONLY', 'EMBED_ALLOWED', 'FULLTEXT_ALLOWED')"
SOURCE_KIND_CHECK = "kind in ('PUBLICATION', 'BLOG', 'DISCOVERY_SURFACE', 'PAYWALLED_FREE_SUBSET')"
EVENT_TYPE_CHECK = (
    "event_type in ('OPEN', 'FINISH', 'SAVE', 'DISMISS', 'LINK_CLICK', 'LIST_ADD', 'FOLLOW', 'UNFOLLOW')"
)


class Source(Base):
    __tablename__ = "sources"
    __table_args__ = (
        CheckConstraint(CONTENT_POLICY_CHECK, name="sources_content_policy_check"),
        CheckConstraint(SOURCE_KIND_CHECK, name="sources_kind_check"),
        CheckConstraint("trust_score >= 0 and trust_score <= 1", name="sources_trust_score_range"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    homepage_url: Mapped[str] = mapped_column(Text, nullable=False)
    rss_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_policy: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'REDIRECT_ONLY'")
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'PUBLICATION'"))
    trust_score: Mapped[float] = mapped_column(nullable=False, server_default=text("0.7"))
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
    last_ingested_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    last_ingest_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_ingest_etag: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_ingest_modified: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_ingest_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_ingest_article_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    consecutive_failures: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    # See migration 009. fetch_strategy decides which adapter the ingest
    # runner uses for this source. Default is 'rss' so existing sources
    # keep behaving as before.
    fetch_strategy: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'rss'")
    )
    archive_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    archive_link_selector: Mapped[str | None] = mapped_column(Text, nullable=True)
    sitemap_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sitemap_url_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_word_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )


class Article(Base):
    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(CONTENT_POLICY_CHECK, name="articles_content_policy_check"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    source_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    publication_date: Mapped[date | None] = mapped_column(nullable=True)
    canonical_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    og_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reading_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_policy: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'REDIRECT_ONLY'")
    )
    full_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[float] = mapped_column(nullable=False, server_default=text("0.5"))
    save_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    finish_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    submitted_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    # Generated column maintained by Postgres (migration 002). Read-only from ORM.
    search_tsv: Mapped[str] = mapped_column(TSVECTOR, nullable=False, deferred=True)

    source: Mapped[Source] = relationship(lazy="selectin")
    topic_links: Mapped[list["ArticleTopic"]] = relationship(
        back_populates="article", lazy="selectin", cascade="all, delete-orphan"
    )


class ArticleTopic(Base):
    __tablename__ = "article_topics"

    article_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("articles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    topic_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        primary_key=True,
    )
    weight: Mapped[float] = mapped_column(nullable=False, server_default=text("1.0"))

    article: Mapped[Article] = relationship(back_populates="topic_links")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (CheckConstraint(EVENT_TYPE_CHECK, name="events_event_type_check"),)

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    article_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("articles.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_metadata: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
