"""POST /api/matches/: score a project against the studies without saving it."""
from flask import jsonify

from app.controllers.base_controller import BaseController
from app.services.auth import AuthService
from app.services.matcher import find_matches
from app.views.match_view import StudyMatchView


class MatchController(BaseController):
    name = "matches"
    url_prefix = "/api/matches"

    def __init__(self, auth: AuthService, match_finder=find_matches):
        self.auth = auth
        self.find_matches = match_finder
        self.view = StudyMatchView()
        super().__init__()

    def routes(self) -> list:
        return [("/", self.create, ["POST"])]

    def create(self):
        self.auth.current_user(required=False)  # a token, if sent, must be valid; guests may still match
        body = self.json_body()
        results = self.find_matches(body.get("title"), body.get("abstract"), body.get("keywords"), body.get("limit"))
        return jsonify({"studies": self.view.render_all(results)})