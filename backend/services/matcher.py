"""
Two styles here:
  * FUNCTIONAL: to_percent, similarity_label and shape_match are pure. They only turn their
    arguments into a result, so they are easy to test and the order of calls does not matter.
  * IMPERATIVE: MatchService owns the study index and changes it over time (build, rebuild).
"""
import threading
import time
from functools import partial
from typing import Optional

from config import Settings, load_settings
from models.study_model import StudyModel
from services.tfidf import Scored, StudyIndex
from services.tokenizer import build_display_words, build_token_list
from services.validation import validate_input

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


def shape_match(result: Scored, display: dict, settings: Settings) -> dict:
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
        "url": study.url,
        "study_type": study.study_type,
        "cited_by": study.cited_by,
        "access": study.access,
        "setting": study.setting,
        "is_sample": study.is_sample,
    }


class MatchService:
    """Holds the study index in memory, rebuilds it every `cache_ttl` seconds and answers find_matches()."""

    def __init__(self, study_model, settings: Optional[Settings] = None):
        self.model = study_model
        self.settings = settings or load_settings()
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
        return list(map(partial(shape_match, display=display, settings=self.settings), results))

_default_service: Optional[MatchService] = None

def find_matches(title, abstract, keywords, limit: Optional[int] = None) -> list:
    """The function Person B calls. Uses one shared MatchService connected to Supabase."""
    global _default_service
    if _default_service is None:
        settings = load_settings()
        _default_service = MatchService(StudyModel(settings), settings)
    return _default_service.find_matches(title, abstract, keywords, limit)