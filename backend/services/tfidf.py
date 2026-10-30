"""TF-IDF index of the studies, written with loops and running totals.

Same formula as match_studies() in database/03_functions.sql:
  weight = (1 + ln(count)) * idf,  idf = ln((1 + N) / (1 + df)) + 1
"""
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Optional

from models.study_model import Study
from services.tokenizer import build_token_list

def term_frequency(count: int) -> float:
    """1 + ln(count), so repeating a word counts for less each time."""
    return 1.0 + math.log(count)


def compute_idf(token_lists: list) -> dict:
    """Rarer terms get a higher idf."""
    doc_freq = Counter()
    for tokens in token_lists:
        doc_freq.update(set(tokens))

    total = len(token_lists)
    idf = {}
    for term, df in doc_freq.items():
        idf[term] = math.log((1 + total) / (1 + df)) + 1
    return idf


def build_postings(token_lists: list, idf: dict):
    """term -> [(study position, weight)], plus each study's vector length for the cosine."""
    postings = defaultdict(list)              # term -> [(study position, weight), ...]
    norms = []
    for position, tokens in enumerate(token_lists):
        squares = 0.0
        for term, count in Counter(tokens).items():
            weight = term_frequency(count) * idf[term]
            postings[term].append((position, weight))
            squares += weight * weight
        norms.append(math.sqrt(squares))
    return postings, norms

@dataclass
class Scored:
    study: Study
    score: float
    shared: list

class StudyIndex:
    def __init__(self, studies: list, keyword_boost: int):
        self.keyword_boost = keyword_boost
        self.studies = studies

        self.tokens = []            
        for study in studies:
            self.tokens.append(build_token_list(study.title, study.abstract, study.keywords, keyword_boost))

        self.idf = compute_idf(self.tokens)
        self.unseen_idf = math.log(1 + len(studies)) + 1  
        self.postings, self.norms = build_postings(self.tokens, self.idf)

    def query_vector(self, tokens: list) -> dict:
        """The input as {term: weight}, weighted the same way as the studies."""
        vector = {}
        for term, count in Counter(tokens).items():
            vector[term] = term_frequency(count) * self.idf.get(term, self.unseen_idf)
        return vector


    def compare(self, tokens: list, min_score: float, limit: Optional[int] = None) -> list:
        """Score every study that shares at least one word with the input, best first."""
        query = self.query_vector(tokens)
        query_norm = math.sqrt(sum(weight * weight for weight in query.values()))
        if query_norm == 0:
            return []

        dots = defaultdict(float)
        parts = defaultdict(list)
        for term, query_weight in query.items():
            for position, study_weight in self.postings.get(term, ()):
                contribution = query_weight * study_weight
                dots[position] += contribution
                parts[position].append((term, contribution))

        results = []
        for position, dot in dots.items():
            if self.norms[position] == 0:
                continue
            score = 100.0 * dot / (self.norms[position] * query_norm)   
            if score > 0 and score >= min_score:
                shared = sorted(parts[position], key=lambda part: -part[1])
                results.append(Scored(self.studies[position], score, shared))

        results.sort(key=lambda r: (-round(r.score, 1), -(r.study.year or 0), r.study.id))
        return results[:limit] if limit else results