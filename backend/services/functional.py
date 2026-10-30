"""Helpers for the functional style used in the tokenizer."""
from functools import reduce


def pipe(*steps):
    """pipe(f, g, h)(x) is h(g(f(x)))."""
    def run(value):
        return reduce(lambda result, step: step(result), steps, value)
    return run
