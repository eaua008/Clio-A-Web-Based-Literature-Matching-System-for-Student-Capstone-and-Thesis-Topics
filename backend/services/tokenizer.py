"""
Every function here is pure: the same input always gives the same output, and nothing
outside the function is read or changed. The tokenizer is a pipeline of small steps:

    text -> clean -> split into words -> drop common words -> (stem, word) pairs

Studies and the student's input run through the same pipeline, so they can be compared.
"""
import re
from functools import lru_cache, partial
from operator import itemgetter

from nltk.stem import PorterStemmer

from services.functional import pipe

MIN_LENGTH = 3

STOPWORDS = frozenset("""
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having
he her here hers herself him himself his how i if in into is it its itself just me more most my myself no
nor not now of off on once only or other our ours ourselves out over own same she should so some such than
that the their theirs them themselves then there these they this those through to too under until up very
was we were what when where which while who whom why will with would you your yours yourself yourselves
may might must shall via etc eg ie upon within without across among per
""".split())

_NON_WORD = re.compile(r"[^a-z0-9]+")
_stemmer = PorterStemmer()


def clean_text(text: str) -> str:
    """Lowercase, and turn every symbol or punctuation mark into a space."""
    return _NON_WORD.sub(" ", (text or "").lower()).strip()


def split_words(text: str) -> list:
    return clean_text(text).split()


def is_keepable(word: str) -> bool:
    return len(word) >= MIN_LENGTH and word not in STOPWORDS


def remove_stopwords(words: list) -> list:
    """Drop common words ('the', 'and') and very short words."""
    return list(filter(is_keepable, words))

@lru_cache(maxsize=None)
def stem_word(word: str) -> str:
    """'sensors' -> 'sensor'. Cached because the result never changes."""
    return _stemmer.stem(word)


def with_stem(word: str) -> tuple:
    """(stem, original word). The original is kept to show shared words readably."""
    return (stem_word(word), word)


tokenize_pairs = pipe(split_words, remove_stopwords, partial(map, with_stem), list)
tokenize = pipe(tokenize_pairs, partial(map, itemgetter(0)), list)



def build_token_list(title: str, abstract: str, keywords, keyword_boost: int) -> list:
    """Title, abstract and keywords as one token list. Keywords repeat keyword_boost times."""
    keyword_tokens = tokenize(" ".join(keywords or []))
    return tokenize(title) + tokenize(abstract) + keyword_tokens * max(1, keyword_boost)


def build_display_words(title: str, abstract: str, keywords) -> dict:
    """stem -> shortest original word in the input. Used to show shared words as readable text."""
    pairs = tokenize_pairs(f"{title} {' '.join(keywords or [])} {abstract}")
    # Longest words first: dict() keeps the last value per key, so the shortest word wins.
    return dict(sorted(pairs, key=lambda pair: (len(pair[1]), pair[1]), reverse=True))