"""Small helpers for the functional style used in the tokenizer."""
from functools import reduce


def pipe(*steps):
    """Chain functions left to right: pipe(f, g, h)(x) == h(g(f(x))).
    Each step receives the previous step's result. Nothing is stored or changed
    along the way, so the same input always gives the same output.
    """
    def run(value):
        return reduce(lambda result, step: step(result), steps, value)
    return run