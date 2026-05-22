"""Content filters applied across recs, browse, search, related, etc.

Currently:
- Arachnid exclusion: articles whose title or description matches an arachnid
  keyword are filtered out everywhere, as an accessibility measure for users
  with arachnophobia.

Filters live in one module so a single edit propagates to every surface that
reads articles. Each filter exposes a SQLAlchemy ColumnElement intended for a
`.where(...)` clause, plus a Python predicate used as a defense-in-depth
re-check at the application layer (e.g. before returning a deck card).
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, and_, func, not_, or_

if TYPE_CHECKING:
    from .models import Article

# Word-boundary patterns. Keep this list conservative: only words that are
# unambiguously arachnid references. (Avoid "web", "crawl", "net" — too broad.)
ARACHNID_TERMS: tuple[str, ...] = (
    "spider",
    "spiders",
    "arachnid",
    "arachnids",
    "arachnophob",  # arachnophobia / arachnophobic
    "tarantula",
    "tarantulas",
    "scorpion",
    "scorpions",
    "black widow",
    "brown recluse",
    "huntsman spider",
    "wolf spider",
    "harvestman",
    "harvestmen",
)


# Compiled regex for Python-side checks. \b boundaries so "spiderman" still
# matches the prefix but "spied" / "spire" / "ascorbic" don't.
_PY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(t) for t in ARACHNID_TERMS) + r")\b",
    re.IGNORECASE,
)


def arachnid_exclude_clause(article_cls: "type[Article]") -> ColumnElement[bool]:
    """SQLAlchemy WHERE expression that excludes arachnid-themed articles.

    Usage:
        stmt = select(Article).where(arachnid_exclude_clause(Article))
    """
    # Word-boundary regex pushed into Postgres. lower(...) + ~ '\\bspider\\b'
    # style. Group all terms in one alternation to keep the planner happy.
    alternation = "|".join(re.escape(t) for t in ARACHNID_TERMS)
    pattern = rf"\m({alternation})\M"  # \m \M = Postgres word boundaries
    title_hit = func.lower(article_cls.title).op("~")(pattern)
    desc_hit = and_(
        article_cls.description.is_not(None),
        func.lower(article_cls.description).op("~")(pattern),
    )
    return not_(or_(title_hit, desc_hit))


def is_arachnid_article(title: str | None, description: str | None) -> bool:
    """Python-side check: True if the article text looks arachnid-themed."""
    haystack = " ".join(s for s in (title, description) if s)
    return bool(_PY_PATTERN.search(haystack))
