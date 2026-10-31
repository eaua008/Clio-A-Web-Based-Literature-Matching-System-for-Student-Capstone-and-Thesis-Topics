"""Logic paradigm: ownership and label rules, written as facts and rules instead of if-statements.

Facts are tuples, such as ("project", "p1", "u1"). A rule says the head is true when every
literal in its body is true. Terms that start with "?" are variables, like X in Prolog.

    owns(?u, ?p)          :- project(?p, ?u).
    denied(?u, ?a, ?p)    :- request(?u, ?a, ?p), not can(?u, ?a, ?p).
    note_too_long(?m)     :- note_length(?m, ?n), max_note_length(?max), ?n > ?max.

The engine derives every fact it can (forward chaining), then answers questions about them.
"not" is negation as failure: "not X" holds when X can't be derived. The rules are run in
layers (strata), so a rule that says "not X" runs only after every rule that derives X.
"""
import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterator, Optional

from app.errors import RuleViolation

RELATIONS = ("Duplicate", "Similar", "Related background", "Not relevant")
MAX_NOTE_LENGTH = 5000


def is_variable(term) -> bool:
    return isinstance(term, str) and term.startswith("?")


def resolve(term, binding: dict):
    return binding.get(term, term) if is_variable(term) else term


def unify(pattern: tuple, fact: tuple, binding: dict) -> Optional[dict]:
    """The binding extended so that pattern equals fact, or None if they can't match."""
    if len(pattern) != len(fact):
        return None
    result = dict(binding)
    for term, value in zip(pattern, fact):
        if is_variable(term):
            if term in result and result[term] != value:
                return None
            result[term] = value
        elif term != value:
            return None
    return result


# ---- Literals: the three kinds of condition a rule body can contain (polymorphic solve) ----

class Literal(ABC):
    negated = False
    predicate = None  # the fact name this literal looks up (None for built-in tests)

    @abstractmethod
    def solve(self, kb: "KnowledgeBase", binding: dict) -> Iterator[dict]:
        """Every binding that makes this literal true."""


@dataclass(frozen=True)
class Is(Literal):
    """A fact must exist: Is("project", "?p", "?u")."""
    terms: tuple

    def __init__(self, *terms):
        object.__setattr__(self, "terms", terms)

    @property
    def predicate(self):
        return self.terms[0]

    def solve(self, kb, binding):
        for fact in list(kb.facts):
            found = unify(self.terms, fact, binding)
            if found is not None:
                yield found


@dataclass(frozen=True)
class Not(Literal):
    """Negation as failure: true when the fact can't be found."""
    terms: tuple
    negated = True

    def __init__(self, *terms):
        object.__setattr__(self, "terms", terms)

    @property
    def predicate(self):
        return self.terms[0]

    def solve(self, kb, binding):
        if next(Is(*self.terms).solve(kb, binding), None) is None:
            yield binding


@dataclass(frozen=True)
class Compare(Literal):
    """A built-in test on bound values: Compare("?n", ">", "?max")."""
    left: object
    op: str
    right: object

    OPERATORS = {">": operator.gt, ">=": operator.ge, "<": operator.lt, "<=": operator.le, "==": operator.eq}

    def solve(self, kb, binding):
        if self.OPERATORS[self.op](resolve(self.left, binding), resolve(self.right, binding)):
            yield binding


@dataclass(frozen=True)
class Rule:
    head: tuple
    body: tuple

    @property
    def predicate(self):
        return self.head[0]


def rule(head: tuple, *body: Literal) -> Rule:
    return Rule(head, body)


class KnowledgeBase:
    def __init__(self, rules=(), facts=()):
        self.rules = list(rules)
        self.facts = set(facts)
        self._inferred = False

    def tell(self, *facts) -> "KnowledgeBase":
        self.facts.update(facts)
        self._inferred = False
        return self

    def _solve(self, body: tuple, binding: dict) -> Iterator[dict]:
        if not body:
            yield binding
            return
        for found in body[0].solve(self, binding):
            yield from self._solve(body[1:], found)

    def strata(self) -> dict:
        """Layer number of each derived fact name. A rule's head sits in a layer at or above everything
        it uses, and strictly above anything it uses with "not", so "not X" is only asked once X is complete."""
        layer = {r.predicate: 0 for r in self.rules}
        for _ in range(len(self.rules) + 1):
            changed = False
            for r in self.rules:
                for literal in r.body:
                    if literal.predicate is None:
                        continue
                    needed = layer.get(literal.predicate, 0) + (1 if literal.negated else 0)
                    if layer[r.predicate] < needed:
                        layer[r.predicate] = needed
                        changed = True
            if not changed:
                return layer
        raise ValueError("The rules use 'not' in a loop, so they can't be layered.")

    def infer(self) -> "KnowledgeBase":
        """Forward chaining, one layer at a time, until no new fact appears."""
        if self._inferred:
            return self
        layer = self.strata()
        for stratum in sorted(set(layer.values())):
            rules = [r for r in self.rules if layer[r.predicate] == stratum]
            changed = True
            while changed:
                changed = False
                for r in rules:
                    for binding in list(self._solve(r.body, {})):
                        fact = tuple(resolve(term, binding) for term in r.head)
                        if fact not in self.facts:
                            self.facts.add(fact)
                            changed = True
        self._inferred = True
        return self

    def ask(self, *pattern) -> bool:
        """Is there a fact matching the pattern?"""
        return bool(self.query(*pattern))

    def query(self, *pattern) -> list:
        """Every binding for the variables in the pattern."""
        self.infer()
        return list(Is(*pattern).solve(self, {}))


# ---- Policies: each one is a set of rules plus the facts they always need ----

class Policy(ABC):
    """A group of rules about one topic. Subclasses list their rules and base facts."""
    rules: tuple = ()

    def base_facts(self) -> list:
        return []

    def knowledge_base(self) -> KnowledgeBase:
        return KnowledgeBase(self.rules, self.base_facts())


class AccessPolicy(Policy):
    """Only the owner can view or edit a project and its matches."""
    rules = (
        rule(("owns", "?u", "?p"), Is("project", "?p", "?u")),
        rule(("can", "?u", "view", "?p"), Is("owns", "?u", "?p")),
        rule(("can", "?u", "edit", "?p"), Is("owns", "?u", "?p")),
        rule(("denied", "?u", "?a", "?p"), Is("request", "?u", "?a", "?p"), Not("can", "?u", "?a", "?p")),
    )

    def allows(self, user_id: str, action: str, project) -> bool:
        kb = self.knowledge_base().tell(
            ("project", project.id, project.user_id),
            ("request", user_id, action, project.id),
        )
        return not kb.ask("denied", user_id, action, project.id)

    def check(self, user_id: str, action: str, project) -> None:
        if not self.allows(user_id, action, project):
            raise RuleViolation("You don't have access to this project.")


class LabelPolicy(Policy):
    """Which relevance labels and notes are valid, and when to warn the student."""
    rules = (
        rule(("noted", "?m"), Is("note_length", "?m", "?n"), Compare("?n", ">", 0)),
        rule(("note_too_long", "?m"),
             Is("note_length", "?m", "?n"), Is("max_note_length", "?max"), Compare("?n", ">", "?max")),
        rule(("needs_note", "?m"), Is("labelled", "?m", "Duplicate")),
        rule(("needs_note", "?m"), Is("labelled", "?m", "Similar")),
        rule(("invalid_label", "?m"), Is("labelled", "?m", "?l"), Not("relation", "?l")),
        rule(("missing_note", "?m"), Is("needs_note", "?m"), Not("noted", "?m")),
        rule(("error", "?m", "relation"), Is("invalid_label", "?m")),
        rule(("error", "?m", "difference"), Is("note_too_long", "?m")),
        rule(("warning", "?m", "missing_note"), Is("missing_note", "?m")),
        rule(("warning", "?m", "duplicate_low_score"),
             Is("labelled", "?m", "Duplicate"), Is("band", "?m", "Low similarity")),
    )

    ERRORS = {
        "relation": f"Choose one of: {', '.join(RELATIONS)}.",
        "difference": f"Keep this note to {MAX_NOTE_LENGTH} characters or fewer.",
    }
    WARNINGS = {
        "missing_note": "Explain how your work differs from this study.",
        "duplicate_low_score": "This study has low similarity. Check that it is really a duplicate.",
    }

    def base_facts(self) -> list:
        return [("relation", r) for r in RELATIONS] + [("max_note_length", MAX_NOTE_LENGTH)]

    def check(self, match_id: str, relation: Optional[str], difference: str, similarity: str) -> list:
        """Raises RuleViolation for errors. Returns the warning messages."""
        kb = self.knowledge_base().tell(
            ("note_length", match_id, len(difference)),
            ("band", match_id, similarity),
        )
        if relation is not None:
            kb.tell(("labelled", match_id, relation))

        errors = {b["?field"]: self.ERRORS[b["?field"]] for b in kb.query("error", match_id, "?field")}
        if errors:
            raise RuleViolation("Please fix the highlighted fields.", errors)
        return sorted(self.WARNINGS[b["?kind"]] for b in kb.query("warning", match_id, "?kind"))