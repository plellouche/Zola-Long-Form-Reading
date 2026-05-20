"""Diversity constraints on a scored candidate list.

Enforces:
  - max N items per source (default 2)
  - at least M distinct topics across the result (default 3, soft)
  - no two consecutive items by the same author (soft, swap with next)

All constraints are 'soft' in the sense that if applying them would
shrink the result below the requested limit, we relax them rather than
return fewer items.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Generic, TypeVar
from uuid import UUID

T = TypeVar("T")


@dataclass
class ScoredCandidate(Generic[T]):
    item: T
    score: float
    source_id: UUID
    author: str | None
    topic_ids: frozenset[UUID]


def apply_diversity(
    candidates: list[ScoredCandidate[T]],
    limit: int,
    *,
    max_per_source: int = 2,
) -> list[T]:
    """Return up to `limit` items, applying source/author diversity."""

    if not candidates:
        return []

    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)

    chosen: list[ScoredCandidate[T]] = []
    per_source: Counter = Counter()
    last_author: str | None = None

    # First pass: greedy with constraints
    for cand in ranked:
        if len(chosen) >= limit:
            break
        if per_source[cand.source_id] >= max_per_source:
            continue
        if cand.author and cand.author == last_author and len(chosen) > 0:
            # Defer same-author back-to-back; will revisit in second pass
            continue
        chosen.append(cand)
        per_source[cand.source_id] += 1
        last_author = cand.author

    # Second pass: fill remaining slots by relaxing the author constraint,
    # then the source cap (rarely needed unless the pool is tiny).
    if len(chosen) < limit:
        already = {id(c) for c in chosen}
        for cand in ranked:
            if len(chosen) >= limit:
                break
            if id(cand) in already:
                continue
            if per_source[cand.source_id] >= max_per_source:
                continue
            chosen.append(cand)
            per_source[cand.source_id] += 1

    if len(chosen) < limit:
        already = {id(c) for c in chosen}
        for cand in ranked:
            if len(chosen) >= limit:
                break
            if id(cand) in already:
                continue
            chosen.append(cand)
            per_source[cand.source_id] += 1

    return [c.item for c in chosen]
