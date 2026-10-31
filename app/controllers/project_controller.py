"""Saved projects (owner only).

GET   /api/projects/                              the user's projects, newest first
POST  /api/projects/                              match a project and save it with its matches
GET   /api/projects/<id>/                         one project with its saved matches
PATCH /api/projects/<id>/matches/<study_id>/      save the relevance label and "how my work differs" note
"""
from flask import jsonify

from app.config import get_settings
from app.controllers.base_controller import BaseController
from app.errors import NotFoundError
from app.models.project_model import ProjectMatch, SupabaseProjectRepository
from app.models.study_model import Study
from app.services.auth import AuthService
from app.services.matcher import find_matches
from app.services.rules import AccessPolicy, LabelPolicy
from app.services.validation import validate_input
from app.views.match_view import ProjectSummaryView, ProjectView, SavedMatchView, StudyMatchView


class ProjectController(BaseController):
    name = "projects"
    url_prefix = "/api/projects"

    def __init__(self, auth: AuthService, repository_class=SupabaseProjectRepository,
                 match_finder=find_matches, access: AccessPolicy = None, labels: LabelPolicy = None):
        self.auth = auth
        self.repository_class = repository_class
        self.find_matches = match_finder
        self.access = access or AccessPolicy()
        self.labels = labels or LabelPolicy()
        super().__init__()

    def routes(self) -> list:
        return [
            ("/", self.index, ["GET"]),
            ("/", self.create, ["POST"]),
            ("/<project_id>/", self.show, ["GET"]),
            ("/<project_id>/matches/<study_id>/", self.label, ["PATCH"]),
        ]

    # ---- helpers ----

    def _session(self):
        """The signed-in user and a repository that acts as them."""
        user = self.auth.current_user(required=True)
        return user, self.repository_class(get_settings(), user.token)

    def _owned_project(self, repository, user, project_id: str, action: str):
        project = repository.get_project(project_id)
        if project is None:
            raise NotFoundError("Project not found.")
        self.access.check(user.id, action, project)
        return project

    # ---- routes ----

    def index(self):
        user, repository = self._session()
        projects = [p for p in repository.list_projects() if self.access.allows(user.id, "view", p)]
        return jsonify({"projects": ProjectSummaryView().render_all(projects)})

    def create(self):
        user, repository = self._session()
        body = self.json_body()
        data = validate_input(body.get("title"), body.get("abstract"), body.get("keywords"))
        results = self.find_matches(data["title"], data["abstract"], data["keywords"], body.get("limit"))
        matches = [ProjectMatch.from_result(r, Study(id=r["study_id"], title=r["title"])) for r in results]
        project = repository.create_project(data["title"], data["abstract"], data["keywords"], matches)
        return jsonify(ProjectView(StudyMatchView()).render(project, matches=results)), 201

    def show(self, project_id):
        user, repository = self._session()
        project = self._owned_project(repository, user, project_id, "view")
        return jsonify(ProjectView(SavedMatchView(project.keywords, get_settings())).render(project))

    def label(self, project_id, study_id):
        user, repository = self._session()
        project = self._owned_project(repository, user, project_id, "edit")
        match = project.find_match(study_id)

        body = self.json_body()
        warnings = match.relabel(body.get("relation", match.relation),
                                 body.get("difference", match.difference),
                                 self.labels, get_settings())
        repository.save_label(project, match)
        return jsonify({"relation": match.relation, "difference": match.difference, "warnings": warnings})