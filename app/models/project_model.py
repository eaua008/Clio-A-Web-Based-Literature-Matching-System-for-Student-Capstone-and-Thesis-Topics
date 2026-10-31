"""Saved projects and their matches.

Project and ProjectMatch are the domain classes. ProjectRepository is the abstract interface
for storing them. SupabaseProjectRepository is the real one; the tests use a fake subclass.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from app.config import Settings
from app.errors import NotFoundError
from app.models.study_model import COLUMNS as STUDY_COLUMNS, Study
from app.services.matcher import missing_terms, similarity_label
from app.services.supabase_client import SupabaseClient

PROJECT_COLUMNS = "id,user_id,title,abstract,keywords,created_at"
MATCH_COLUMNS = f"study_id,score,shared_terms,relation,difference,studies({STUDY_COLUMNS})"


@dataclass
class ProjectMatch:
    """One study matched to a project, with the student's label and note."""
    study: Study
    score: float
    shared_terms: list = field(default_factory=list)
    relation: Optional[str] = None
    difference: str = ""

    @classmethod
    def from_row(cls, row: dict) -> "ProjectMatch":
        return cls(
            study=Study.from_row(row.get("studies") or {"id": row.get("study_id")}),
            score=float(row.get("score") or 0),
            shared_terms=list(row.get("shared_terms") or []),
            relation=row.get("relation"),
            difference=row.get("difference") or "",
        )

    @classmethod
    def from_result(cls, result: dict, study: Study) -> "ProjectMatch":
        """Built from one find_matches() result."""
        return cls(study=study, score=result["score"], shared_terms=list(result["shared_terms"]))

    def to_row(self, project_id: str) -> dict:
        return {"project_id": project_id, "study_id": self.study.id,
                "score": self.score, "shared_terms": self.shared_terms}

    def similarity(self, settings: Settings) -> str:
        return similarity_label(self.score, settings)

    def missing_terms(self, keywords: list) -> list:
        return missing_terms(self.study, keywords)

    def relabel(self, relation: Optional[str], difference: str, policy, settings: Settings) -> list:
        """Asks the LabelPolicy (Logic rules) first; changes the label only if the rules allow it.
        Returns the rules' warnings."""
        difference = (difference or "").strip()
        warnings = policy.check(self.study.id, relation, difference, self.similarity(settings))
        self.relation, self.difference = relation, difference
        return warnings


@dataclass
class Project:
    id: str
    user_id: str
    title: str
    abstract: str
    keywords: list
    created_at: str = ""
    matches: list = field(default_factory=list)

    @classmethod
    def from_row(cls, row: dict) -> "Project":
        return cls(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            title=row.get("title") or "",
            abstract=row.get("abstract") or "",
            keywords=list(row.get("keywords") or []),
            created_at=row.get("created_at") or "",
        )

    def find_match(self, study_id: str) -> ProjectMatch:
        for match in self.matches:
            if match.study.id == study_id:
                return match
        raise NotFoundError("This study is not in the project's matches.")


class ProjectRepository(ABC):
    """Where projects are stored. Every method acts as the signed-in user."""

    @abstractmethod
    def list_projects(self) -> list:
        """The user's projects, newest first (without their matches)."""

    @abstractmethod
    def get_project(self, project_id: str) -> Optional[Project]:
        """One project with its matches, or None."""

    @abstractmethod
    def create_project(self, title: str, abstract: str, keywords: list, matches: list) -> Project:
        """Saves a project and its matches."""

    @abstractmethod
    def save_label(self, project: Project, match: ProjectMatch) -> None:
        """Saves a match's relation and difference note."""


class SupabaseProjectRepository(SupabaseClient, ProjectRepository):
    """Projects in Supabase. The user's token is sent, so row level security allows only their rows."""

    def __init__(self, settings: Settings, token: str, session=None):
        super().__init__(settings, token, session)

    def list_projects(self) -> list:
        rows = self._request("GET", "projects", {"select": PROJECT_COLUMNS, "order": "created_at.desc"})
        return [Project.from_row(r) for r in rows]

    def get_project(self, project_id: str) -> Optional[Project]:
        rows = self._request("GET", "projects", {"select": PROJECT_COLUMNS, "id": f"eq.{project_id}", "limit": 1})
        if not rows:
            return None
        project = Project.from_row(rows[0])
        matches = self._request("GET", "project_matches", {
            "select": MATCH_COLUMNS, "project_id": f"eq.{project_id}", "order": "score.desc",
        })
        project.matches = [ProjectMatch.from_row(r) for r in matches]
        return project

    def create_project(self, title: str, abstract: str, keywords: list, matches: list) -> Project:
        rows = self._request("POST", "projects", body={"title": title, "abstract": abstract, "keywords": keywords})
        project = Project.from_row(rows[0])
        if matches:
            try:
                self._request("POST", "project_matches", body=[m.to_row(project.id) for m in matches],
                              returning=False)
            except Exception:
                self._request("DELETE", "projects", {"id": f"eq.{project.id}"}, returning=False)
                raise
        project.matches = list(matches)
        return project

    def save_label(self, project: Project, match: ProjectMatch) -> None:
        self._request("PATCH", "project_matches",
                      {"project_id": f"eq.{project.id}", "study_id": f"eq.{match.study.id}"},
                      body={"relation": match.relation, "difference": match.difference or None},
                      returning=False)