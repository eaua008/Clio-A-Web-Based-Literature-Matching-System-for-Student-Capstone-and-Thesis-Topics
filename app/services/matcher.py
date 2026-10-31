"""Validates the input, scores it against the studies and shapes the results.

to_percent, similarity_label and shape_match are pure functions.
MatchService is stateful: it keeps the index cache.
"""
import threading
import time
from functools import partial
from typing import Optional

from app.config import Settings, get_settings
from app.models.study_model import StudyModel
from app.services.tfidf import Scored, StudyIndex
from app.services.tokenizer import build_display_words, build_token_list, tokenize_pairs
from app.services.validation import validate_input

MAX_SHARED_WORDS = 8


def to_percent(score: float) -> float:
    """Keep the score between 0 and 100 with one decimal."""
    return round(max(0.0, min(100.0, score)), 1)


def similarity_label(score: float, settings: Settings) -> str:
    if score >= settings.high_score:
        return "High similarity"
    if score >= settings.medium_score:
        return "Medium similarity"
    return "Low similarity"


def missing_terms(study, keywords) -> list:
    """Words from the project's keywords that never appear in the study (stemmed, so 'sensors' = 'sensor')."""
    study_stems = set(build_token_list(study.title, study.abstract, study.keywords, 1))
    seen, words = set(), []
    for stem, word in tokenize_pairs(" ".join(keywords or [])):
        if stem not in study_stems and stem not in seen:
            seen.add(stem)
            words.append(word)
    return words[:MAX_SHARED_WORDS]


def shape_match(result: Scored, display: dict, keywords: list, settings: Settings) -> dict:
    """One Scored result as the dict the rest of the backend works with."""
    study, score = result.study, to_percent(result.score)
    return {
        "study_id": study.id,
        "title": study.title,
        "score": score,
        "similarity": similarity_label(score, settings),
        "source": study.source_name,
        "kind": study.source_type,
        "year": study.year,
        "authors": ", ".join(study.authors),
        "abstract": study.abstract,
        "shared_terms": [display.get(term, term) for term, _ in result.shared[:MAX_SHARED_WORDS]],
        "missing_terms": missing_terms(study, keywords),
        "url": study.url,
        "study_type": study.study_type,
        "cited_by": study.cited_by,
        "access": study.access,
        "setting": study.setting,
        "is_sample": study.is_sample,
    }


class MatchService:
    """Keeps the study index in memory and rebuilds it every cache_ttl seconds."""

    def __init__(self, study_model, settings: Optional[Settings] = None):
        self.model = study_model
        self.settings = settings or get_settings()
        self._index = None
        self._built_at = 0.0
        self._lock = threading.Lock()         # two requests must not rebuild the index at the same time

    def refresh_index(self) -> StudyIndex:
        """Read the studies again and rebuild the index. Call this after studies are added."""
        with self._lock:
            self._index = StudyIndex(self.model.get_all_studies(), self.settings.keyword_boost)
            self._built_at = time.monotonic()
            return self._index

    def get_index(self) -> StudyIndex:
        too_old = time.monotonic() - self._built_at > self.settings.cache_ttl
        if self._index is None or too_old:
            return self.refresh_index()
        return self._index

    def find_matches(self, title, abstract, keywords, limit: Optional[int] = None) -> list:
        """Up to `limit` matches, best first. Raises ValidationError on bad input."""
        data = validate_input(title, abstract, keywords)
        limit = min(max(int(limit or self.settings.default_limit), 1), self.settings.max_limit)

        tokens = build_token_list(data["title"], data["abstract"], data["keywords"], self.settings.keyword_boost)
        display = build_display_words(data["title"], data["abstract"], data["keywords"])
        results = self.get_index().compare(tokens, self.settings.min_score, limit)
        return list(map(partial(shape_match, display=display, keywords=data["keywords"], settings=self.settings), results))

_default_service: Optional[MatchService] = None

def find_matches(title, abstract, keywords, limit: Optional[int] = None) -> list:
    """Entry point for the match route. Uses one shared MatchService."""
    global _default_service
    if _default_service is None:
        settings = get_settings()
        _default_service = MatchService(StudyModel(settings), settings)
    return _default_service.find_matches(title, abstract, keywords, limit)