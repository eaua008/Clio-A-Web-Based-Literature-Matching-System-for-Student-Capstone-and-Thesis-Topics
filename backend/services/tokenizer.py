"""
Every function here is pure: the same input always gives the same output, and nothing
outside the function is read or changed. The tokenizer is a pipeline of small steps:

    text -> clean -> split into words -> drop common words

Studies and the student's input run through the same pipeline, so they can be compared.
"""
import re

from services.functional import pipe

MIN_LENGTH = 3  # words shorter than this are dropped (same rule as the database function)

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


tokenize = pipe(split_words, remove_stopwords)