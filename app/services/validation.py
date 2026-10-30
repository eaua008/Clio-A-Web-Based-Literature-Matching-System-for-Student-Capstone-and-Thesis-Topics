"""Input rules. Each check returns an error message, or None if the value is fine."""

MIN_WORDS = 50
MAX_TITLE = 200
MAX_ABSTRACT = 10000
MAX_KEYWORDS = 30
MAX_KEYWORD_LENGTH = 50


class ValidationError(ValueError):
    """Bad input. `errors` maps a field name to its message."""

    def __init__(self, errors: dict):
        super().__init__("Please fix the highlighted fields.")
        self.message = "Please fix the highlighted fields."
        self.errors = errors


def count_words(text: str) -> int:
    return len(text.split())


def clean_keywords(keywords) -> list:
    if isinstance(keywords, str):
        keywords = keywords.split(",")
    seen, result = set(), []
    for item in keywords or []:
        word = str(item).strip()
        if word and word.lower() not in seen:
            seen.add(word.lower())
            result.append(word)
    return result


def check_title(title: str):
    if not title:
        return "Please enter a project / capstone title."
    if len(title) > MAX_TITLE:
        return f"Title must be {MAX_TITLE} characters or fewer."
    return None


def check_abstract(abstract: str):
    words = count_words(abstract)
    if not abstract:
        return "Please enter a detailed abstract / technical summary."
    if words < MIN_WORDS:
        return f"Abstract must be at least {MIN_WORDS} words (currently {words})."
    if len(abstract) > MAX_ABSTRACT:
        return f"Abstract must be {MAX_ABSTRACT} characters or fewer."
    return None


def check_keywords(keywords: list):
    if not keywords:
        return "Please enter at least one key domain term or keyword."
    if len(keywords) > MAX_KEYWORDS:
        return f"Use at most {MAX_KEYWORDS} keywords."
    if any(len(word) > MAX_KEYWORD_LENGTH for word in keywords):
        return f"Each keyword must be {MAX_KEYWORD_LENGTH} characters or fewer."
    return None


def validate_input(title, abstract, keywords) -> dict:
    data = {
        "title": (title or "").strip(),
        "abstract": (abstract or "").strip(),
        "keywords": clean_keywords(keywords),
    }
    checks = {
        "title": check_title(data["title"]),
        "abstract": check_abstract(data["abstract"]),
        "keywords": check_keywords(data["keywords"]),
    }
    errors = {field: message for field, message in checks.items() if message}
    if errors:
        raise ValidationError(errors)
    return data