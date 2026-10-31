"""Serves the frontend from Flask, so the page and the API share one origin (no CORS, CSP stays 'self')."""
from pathlib import PurePosixPath

from flask import current_app, redirect, send_from_directory

from app.controllers.base_controller import BaseController
from app.errors import NotFoundError


class FrontendController(BaseController):
    name = "frontend"
    FOLDERS = {"ui", "core", "controllers", "services"}
    FILE_TYPES = {".html", ".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff2"}

    def routes(self) -> list:
        return [
            ("/app/", self.open_app, ["GET"]),
            ("/<path:filename>", self.static_file, ["GET"]),
        ]

    def open_app(self):
        return redirect("/ui/views/index.html")

    def is_public(self, filename: str) -> bool:
        """Only frontend files in the frontend folders. Never .py files or .env."""
        path = PurePosixPath(filename)
        return path.parts[0] in self.FOLDERS and path.suffix.lower() in self.FILE_TYPES

    def static_file(self, filename):
        if not self.is_public(filename):
            raise NotFoundError()
        return send_from_directory(current_app.root_path, filename)