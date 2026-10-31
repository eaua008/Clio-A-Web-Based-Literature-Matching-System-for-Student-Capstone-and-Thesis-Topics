"""Views: turn backend objects into the JSON the frontend draws (camelCase, with a details object).

Every view has the same render() method, so a controller can use any of them the same way.
"""
from abc import ABC, abstractmethod

from app.config import Settings


class JsonView(ABC):
    @abstractmethod
    def render(self, item) -> dict:
        """One item as JSON-ready data."""

    def render_all(self, items) -> list:
        return [self.render(item) for item in items]


class StudyMatchView(JsonView):
    """A result from find_matches() (a snake_case dict)."""

    def render(self, match: dict) -> dict:
        return {
            "studyId": match["study_id"],
            "title": match["title"],
            "score": match["score"],
            "similarity": match["similarity"],
            "source": match["source"],
            "kind": match["kind"],
            "year": match["year"],
            "authors": match["authors"],
            "abstract": match["abstract"],
            "sharedTerms": match["shared_terms"],
            "missingTerms": match.get("missing_terms", []),
            "url": match["url"],
            "relation": match.get("relation"),
            "difference": match.get("difference") or "",
            "isSample": match["is_sample"],
            "details": {
                "studyType": match["study_type"],
                "citedBy": match["cited_by"],
                "access": match["access"],
                "setting": match["setting"],
            },
        }


class SavedMatchView(StudyMatchView):
    """A saved ProjectMatch, drawn exactly like a fresh result plus its label and note."""

    def __init__(self, keywords: list, settings: Settings):
        self.keywords = keywords
        self.settings = settings

    def render(self, match) -> dict:
        study = match.study
        return super().render({
            "study_id": study.id, "title": study.title, "score": match.score,
            "similarity": match.similarity(self.settings),
            "source": study.source_name, "kind": study.source_type, "year": study.year,
            "authors": ", ".join(study.authors), "abstract": study.abstract,
            "shared_terms": match.shared_terms, "missing_terms": match.missing_terms(self.keywords),
            "url": study.url, "study_type": study.study_type, "cited_by": study.cited_by,
            "access": study.access, "setting": study.setting, "is_sample": study.is_sample,
            "relation": match.relation, "difference": match.difference,
        })


class ProjectSummaryView(JsonView):
    """A project in the sidebar list."""

    def render(self, project) -> dict:
        return {"id": project.id, "title": project.title, "createdAt": project.created_at}


class ProjectView(JsonView):
    """A project with its matches. The match view decides how each match is drawn."""

    def __init__(self, match_view: JsonView):
        self.match_view = match_view

    def render(self, project, matches=None) -> dict:
        return {
            "project": {
                "id": project.id,
                "title": project.title,
                "abstract": project.abstract,
                "keywords": project.keywords,
                "createdAt": project.created_at,
            },
            "studies": self.match_view.render_all(project.matches if matches is None else matches),
        }