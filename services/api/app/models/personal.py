from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .content import Article


USER_ARTICLE_STATUS_CHECK = "status in ('SAVED', 'READING', 'FINISHED', 'DISMISSED')"


class UserArticleState(Base):
    __tablename__ = "user_article_states"
    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="user_article_states_uniq"),
        CheckConstraint(USER_ARTICLE_STATUS_CHECK, name="user_article_states_status_check"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    time_spent_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    # Beli-style post-finish rating: LOVED | LIKED | OK | NULL.
    rating: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    article: Mapped[Article] = relationship(lazy="selectin")


class ReadingList(Base):
    __tablename__ = "lists"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
    forked_from_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("lists.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    items: Mapped[list["ListItem"]] = relationship(
        back_populates="reading_list",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ListItem.position",
    )


class ListItem(Base):
    __tablename__ = "list_items"
    __table_args__ = (
        UniqueConstraint("list_id", "article_id", name="list_items_uniq"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    list_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("lists.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    reading_list: Mapped[ReadingList] = relationship(back_populates="items")
    article: Mapped[Article] = relationship(lazy="selectin")
