"""Pairwise-comparison Elo updates.

Standard Elo, K=32 (more aggressive than chess because preference signal
is one click and we want fast convergence). Initial score 1200 for any
article that hasn't been compared before. The expected-score formula
treats higher = preferred; a higher-rated article SHOULD win against a
lower-rated one.

We update only the two articles involved in a single comparison —
incremental, O(1) per vote, no recompute. Trade-off: the ordering is
path-dependent (a long comparison history converges to truth, but the
first few votes are noisy). Acceptable for a beta; revisit with batch
Bradley-Terry later if it matters.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ArticleEloRating

INITIAL_SCORE = 1200.0
K_FACTOR = 32.0


async def _get_or_init_score(
    session: AsyncSession, user_id: UUID, article_id: UUID
) -> tuple[float, int]:
    """Return (score, comparison_count). Defaults to (1200, 0) when no row exists."""
    row = await session.scalar(
        select(ArticleEloRating).where(
            ArticleEloRating.user_id == user_id,
            ArticleEloRating.article_id == article_id,
        )
    )
    if row is None:
        return INITIAL_SCORE, 0
    return float(row.score), int(row.comparison_count)


async def update_elo(
    session: AsyncSession,
    *,
    user_id: UUID,
    article_a_id: UUID,
    article_b_id: UUID,
    winner_id: UUID,
) -> tuple[float, float]:
    """Apply one Elo update for a head-to-head between A and B.

    Returns the new (score_a, score_b). Caller must commit the surrounding
    transaction.
    """
    score_a, count_a = await _get_or_init_score(session, user_id, article_a_id)
    score_b, count_b = await _get_or_init_score(session, user_id, article_b_id)

    # Expected scores: higher current rating -> higher expected win probability.
    e_a = 1.0 / (1.0 + 10.0 ** ((score_b - score_a) / 400.0))
    e_b = 1.0 - e_a

    s_a = 1.0 if winner_id == article_a_id else 0.0
    s_b = 1.0 - s_a

    new_a = score_a + K_FACTOR * (s_a - e_a)
    new_b = score_b + K_FACTOR * (s_b - e_b)

    now = datetime.now(timezone.utc)
    # Upsert both rows. ON CONFLICT keeps the table the source of truth even
    # if a parallel request raced us.
    for art_id, new_score, prev_count in (
        (article_a_id, new_a, count_a),
        (article_b_id, new_b, count_b),
    ):
        stmt = (
            pg_insert(ArticleEloRating)
            .values(
                user_id=user_id,
                article_id=art_id,
                score=new_score,
                comparison_count=prev_count + 1,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "article_id"],
                set_={
                    "score": new_score,
                    "comparison_count": ArticleEloRating.comparison_count + 1,
                    "updated_at": now,
                },
            )
        )
        await session.execute(stmt)

    return new_a, new_b
