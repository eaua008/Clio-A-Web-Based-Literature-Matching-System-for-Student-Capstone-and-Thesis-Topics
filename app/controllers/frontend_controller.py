"""Serves the frontend from Flask, so the page and the API share one origin (no CORS, CSP stays 'self')."""
from pathlib import Path

from flask import redirect, send_from_directory

from app.controllers.base_controller import BaseController
from app.errors import NotFoundError

VIEWS_DIR = Path(__file__).resolve().parents[1] / "views"


class FrontendController(BaseController):
    name = "frontend"
    FILE_TYPES = {".html", ".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff2"}

    def routes(self) -> list:
        return [
            ("/app/", self.open_app, ["GET"]),
            ("/<path:filename>", self.static_file, ["GET"]),
        ]

    def open_app(self):
        return redirect("/index.html")

    def is_public(self, filename: str) -> bool:
        return Path(filename).suffix.lower() in self.FILE_TYPES

    def static_file(self, filename):
        if not self.is_public(filename):
            raise NotFoundError()
        return send_from_directory(VIEWS_DIR, filename)
