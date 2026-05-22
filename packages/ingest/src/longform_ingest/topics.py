"""Keyword-based topic tagging.

A coarse heuristic that does ~80% of the work for ~5% of the effort. The
real fix at ~50k articles is sentence embeddings (see COMMAND_CENTER §15).

Combines:
- Per-source default topics (loaded from source_default_topics table by the runner)
- Keyword matches against title + description

Each topic exposes two keyword tiers:

  strong  — unambiguous; one match is enough to tag the topic
  weak    — ambiguous in isolation (e.g. "summit" matches political summits
            and mountain summits); need 2+ matches OR a co-occurring strong
            match for the topic to be tagged

Scoring: strong matches count 2.0 each, weak matches 1.0. A topic only
appears in the output if its total score >= MIN_TOPIC_SCORE (= 2.0). This
threshold means "the topic was either explicitly named or it appears at
least twice in passing."
"""

from __future__ import annotations

import re

STRONG_WEIGHT = 2.0
WEAK_WEIGHT = 1.0
MIN_TOPIC_SCORE = 2.0


# Each slug maps to {strong: [...], weak: [...]} of lowercase keyword stems.
# Word-boundary matched.
KEYWORD_TO_TOPICS: dict[str, dict[str, list[str]]] = {
    "philosophy": {
        "strong": [
            "philosopher", "metaphysics", "epistemology", "ontology",
            "phenomenology", "stoicism", "nietzsche", "kant", "wittgenstein",
            "kierkegaard", "philosophy",
        ],
        "weak": ["ethics", "moral", "consciousness", "existential"],
    },
    "science": {
        "strong": [
            "neuroscience", "genetics", "quantum", "neuron", "fossil", "darwin",
            "biology", "physics", "chemistry", "molecule", "scientist",
        ],
        "weak": [
            "science", "evolution", "research", "experiment", "cell",
            "organism", "species", "particle",
        ],
    },
    "nature-environment": {
        "strong": [
            "wildlife", "ecology", "ecosystem", "wilderness", "conservation",
            "rewilding", "biodiversity", "naturalist", "habitat", "wetland",
        ],
        "weak": ["forest", "ocean", "river", "bird"],
    },
    "mountaineering-climbing": {
        "strong": [
            "mountaineer", "mountaineering", "alpinist", "alpinism",
            "climber", "everest", "k2", "himalaya", "himalayan",
            "yosemite", "bivouac", "belay", "crampon", "ice axe",
            "free solo", "big wall", "scrambling",
        ],
        # "summit", "ascent", "climb", "ridge", "rope", "pitch", "peak" are
        # all heavily ambiguous (political summit, social climber, ridge of
        # high pressure, rope-a-dope, sales pitch). Need a corroborating
        # strong term or 2+ weak hits to count.
        "weak": [
            "summit", "ascent", "climb", "ridge", "rope", "pitch", "peak",
            "glacier", "rappel",
        ],
    },
    "adventure-exploration": {
        "strong": [
            "expedition", "thru-hike", "bikepacking", "polar expedition",
            "trekking", "kayaking", "circumnavigat",
        ],
        "weak": [
            "adventure", "trek", "explore", "explorer", "backpacking",
            "kayak", "paddle", "trail", "cycle touring", "polar",
        ],
    },
    "politics-society": {
        "strong": [
            "election", "democracy", "authoritarian", "fascis", "congress",
            "voter", "political party", "civil rights",
        ],
        "weak": [
            "politics", "political", "policy", "government", "society",
            "inequality", "labor", "protest", "movement",
        ],
    },
    "culture-arts": {
        "strong": [
            "filmmaker", "cinema", "musician", "sculpture", "exhibition",
            "museum", "theater", "theatre", "architecture",
        ],
        "weak": [
            "art", "artist", "film", "music", "painting", "painter",
            "design", "fashion",
        ],
    },
    "literature-essays": {
        "strong": [
            "novelist", "essayist", "novella", "translator", "poet",
            "memoir", "literary",
        ],
        "weak": [
            "literature", "essay", "novel", "fiction", "poetry", "writer",
            "writing", "writes", "translation", "prose",
        ],
    },
    "energy-climate": {
        "strong": [
            "carbon", "renewable", "decarboniz", "emissions", "fossil fuel",
            "heat pump", "electric vehicle", "wind farm",
        ],
        "weak": [
            "climate", "solar", "warming", "transition", "grid", "nuclear",
            "battery", "ev",
        ],
    },
    "history": {
        "strong": [
            "historian", "archaeology", "archaeologist", "antiquity",
            "medieval", "renaissance", "ww1", "ww2", "world war",
        ],
        "weak": [
            "history", "historical", "ancient", "century", "empire",
            "civilization",
        ],
    },
    "technology": {
        "strong": [
            "artificial intelligence", "algorithm", "open source",
            "neural network", "programming", "software", "computing",
            "llm", "chatbot", "gpt",
        ],
        "weak": [
            "technology", "computer", "internet", "ai", "data",
            "startup", "engineer", "code",
        ],
    },
    "economics": {
        "strong": [
            "economist", "monetary", "fiscal", "gdp", "inflation",
            "recession", "central bank", "tariff",
        ],
        "weak": [
            "economy", "economic", "market", "trade", "finance",
            "financial", "labor market", "wage",
        ],
    },
}

# Pre-compile regexes once.
_STRONG_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    slug: [re.compile(rf"\b{re.escape(kw)}", re.IGNORECASE) for kw in tier["strong"]]
    for slug, tier in KEYWORD_TO_TOPICS.items()
}
_WEAK_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    slug: [re.compile(rf"\b{re.escape(kw)}", re.IGNORECASE) for kw in tier["weak"]]
    for slug, tier in KEYWORD_TO_TOPICS.items()
}


def score_text(text: str) -> dict[str, float]:
    """Return a dict of topic_slug -> weighted score for the given text.

    Topics whose score is below MIN_TOPIC_SCORE are dropped — a topic must
    earn its place with either an unambiguous keyword or multiple weak hits.
    """
    if not text:
        return {}
    scores: dict[str, float] = {}
    for slug in KEYWORD_TO_TOPICS:
        strong_hits = sum(1 for p in _STRONG_PATTERNS[slug] if p.search(text))
        weak_hits = sum(1 for p in _WEAK_PATTERNS[slug] if p.search(text))
        score = strong_hits * STRONG_WEIGHT + weak_hits * WEAK_WEIGHT
        if score >= MIN_TOPIC_SCORE:
            scores[slug] = score
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
