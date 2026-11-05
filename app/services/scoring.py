from app.config import Settings
from app.services.tokenizer import build_token_list, tokenize_pairs

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
