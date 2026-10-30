"""
This module is written with loops and running totals on purpose. Building the index
means counting, adding up and filling tables one step at a time, and doing that with
explicit loops is the clearest and fastest way to write it.

Same formula as match_studies() in database/03_functions.sql, so both give similar scores:
  term weight = (1 + ln(count)) * idf          idf = ln((1 + N) / (1 + df)) + 1
"""
import math
from collections import Counter, defaultdict

from services.tokenizer import build_token_list


def term_frequency(count: int) -> float:
    """A word used 10 times is not 10x as important as one used once, so dampen it with ln."""
    return 1.0 + math.log(count)


def compute_idf(token_lists: list) -> dict:
    """How rare each term is. Rare terms (few studies use them) get a higher weight."""
    doc_freq = Counter()
    for tokens in token_lists:
        doc_freq.update(set(tokens))

    total = len(token_lists)
    idf = {}
    for term, df in doc_freq.items():
        idf[term] = math.log((1 + total) / (1 + df)) + 1
    return idf


def build_postings(token_lists: list, idf: dict):
    """For each term, the studies that contain it and the term's weight in each.
    Also returns each study's vector length (norm), needed for cosine similarity."""
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


class StudyIndex:
    def __init__(self, studies: list, keyword_boost: int = 2):
        self.keyword_boost = keyword_boost
        self.studies = studies

        self.tokens = []            
        for study in studies:
            self.tokens.append(build_token_list(study.title, study.abstract, study.keywords, keyword_boost))

        self.idf = compute_idf(self.tokens)
        self.unseen_idf = math.log(1 + len(studies)) + 1  
        self.postings, self.norms = build_postings(self.tokens, self.idf)

    def query_vector(self, tokens: list) -> dict:
        """The student's input as {term: weight}, using the same formula as the studies."""
        vector = {}
        for term, count in Counter(tokens).items():
            vector[term] = term_frequency(count) * self.idf.get(term, self.unseen_idf)
        return vector