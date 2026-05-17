"""Keyword-based topic tagging.

A coarse heuristic that does ~80% of the work for ~5% of the effort. The
real fix at ~50k articles is sentence embeddings (see COMMAND_CENTER §15).

Combines:
- Per-source default topics (loaded from source_default_topics table by the runner)
- Keyword matches against title + description
"""

from __future__ import annotations

import re

# Each slug maps to a list of lowercase keyword stems. Word-boundary matched.
KEYWORD_TO_TOPICS: dict[str, list[str]] = {
    "philosophy": [
        "philosophy", "philosopher", "metaphysics", "epistemology", "ontology",
        "consciousness", "phenomenology", "ethics", "moral", "existential",
        "stoicism", "nietzsche", "kant", "wittgenstein", "kierkegaard",
    ],
    "science": [
        "science", "scientist", "biology", "physics", "chemistry", "neuroscience",
        "genetics", "evolution", "quantum", "research", "experiment", "molecule",
        "cell", "organism", "species", "neuron", "particle", "fossil", "darwin",
    ],
    "nature-environment": [
        "wildlife", "ecology", "ecosystem", "wilderness", "conservation", "rewilding",
        "forest", "ocean", "biodiversity", "habitat", "river", "wetland", "bird",
        "naturalist",
    ],
    "mountaineering-climbing": [
        "mountaineer", "alpinist", "alpinism", "climb", "climber", "ascent",
        "summit", "glacier", "himalaya", "everest", "k2", "yosemite", "bivouac",
        "ridge", "rope", "belay", "crampon",
    ],
    "adventure-exploration": [
        "adventure", "expedition", "trek", "trekking", "explore", "explorer",
        "backpacking", "thru-hike", "kayak", "kayaking", "paddle", "trail",
        "cycle touring", "bikepacking", "polar",
    ],
    "politics-society": [
        "politics", "political", "policy", "government", "election", "democracy",
        "authoritarian", "fascis", "society", "inequality", "labor", "protest",
        "civil rights", "movement", "voter", "congress",
    ],
    "culture-arts": [
        "art", "artist", "film", "filmmaker", "cinema", "music", "musician",
        "painting", "painter", "sculpture", "exhibition", "museum", "theater",
        "theatre", "design", "fashion", "architecture",
    ],
    "literature-essays": [
        "literature", "literary", "essay", "essayist", "novel", "novelist",
        "fiction", "poetry", "poet", "memoir", "writer", "writing", "writes",
        "novella", "translation", "translator", "prose",
    ],
    "energy-climate": [
        "climate", "carbon", "renewable", "solar", "wind farm", "fossil fuel",
        "emissions", "warming", "decarboniz", "transition", "grid", "nuclear",
        "battery", "ev", "electric vehicle", "heat pump",
    ],
    "history": [
        "history", "historian", "historical", "ancient", "medieval", "century",
        "empire", "civilization", "archaeology", "archaeologist", "antiquity",
        "ww1", "ww2", "world war", "renaissance",
    ],
    "technology": [
        "technology", "software", "computer", "computing", "internet", "ai",
        "artificial intelligence", "algorithm", "data", "programming", "startup",
        "engineer", "code", "open source", "neural network", "llm", "chatbot",
        "gpt",
    ],
    "economics": [
        "economy", "economic", "economist", "market", "trade", "finance",
        "financial", "monetary", "fiscal", "labor market", "gdp", "inflation",
        "recession", "wage", "tariff", "central bank",
    ],
}

# Pre-compile regexes once.
_TOPIC_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    slug: [re.compile(rf"\b{re.escape(kw)}", re.IGNORECASE) for kw in kws]
    for slug, kws in KEYWORD_TO_TOPICS.items()
}


def score_text(text: str) -> dict[str, float]:
    """Return a dict of topic_slug -> raw match count for the given text."""
    if not text:
        return {}
    scores: dict[str, float] = {}
    for slug, patterns in _TOPIC_PATTERNS.items():
        count = sum(1 for p in patterns if p.search(text))
        if count > 0:
            scores[slug] = float(count)
    return scores


def merge_topic_scores(
    text_scores: dict[str, float],
    source_defaults: dict[str, float],
    *,
    max_topics: int = 3,
    text_weight: float = 0.6,
) -> list[tuple[str, float]]:
    """Combine keyword matches with per-source priors.

    Returns up to `max_topics` `(slug, weight)` pairs sorted by combined score.
    Weights are normalized so the top topic gets weight 1.0.
    """
    combined: dict[str, float] = {}
    # Normalize text scores by max so they live in [0, 1].
    if text_scores:
        max_text = max(text_scores.values())
        for slug, raw in text_scores.items():
            combined[slug] = (raw / max_text) * text_weight
    # Add source priors at (1 - text_weight) of their stored weight.
    prior_weight = 1.0 - text_weight
    for slug, w in source_defaults.items():
        combined[slug] = combined.get(slug, 0.0) + w * prior_weight

    if not combined:
        return []

    ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)[:max_topics]
    top = ranked[0][1]
    if top <= 0:
        return []
    return [(slug, score / top) for slug, score in ranked]
