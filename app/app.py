"""Flask app for the Clio backend."""

import logging

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.config import ConfigError, get_settings
from app.controllers.auth_controller import AuthController
from app.controllers.frontend_controller import FrontendController
from app.controllers.match_controller import MatchController
from app.controllers.project_controller import ProjectController
from app.errors import AppError
from app.models.project_model import SupabaseProjectRepository
from app.models.study_model import StudyDataError
from app.services.auth import AuthService
from app.services.validation import ValidationError

log = logging.getLogger(__name__)


def create_app(auth: AuthService = None, repository_class=SupabaseProjectRepository) -> Flask:
    """Tests pass a fake auth service and repository; the real app uses the defaults."""
    app = Flask(__name__)
    app.config["SETTINGS"] = get_settings()

    @app.get("/")
    def index():
        return jsonify({
            "name": "Clio API",
            "status": "running",
            "message": "Welcome to the Clio backend."
        })

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    auth = auth or AuthService()
    controllers = (
        AuthController(auth),
        MatchController(auth),
        ProjectController(auth, repository_class),
        FrontendController(),
    )
    for controller in controllers:
        app.register_blueprint(controller.blueprint)

    register_error_handlers(app)
    return app


def register_error_handlers(app: Flask) -> None:
    """Every failure is non-2xx JSON shaped as {message, errors?}."""

    @app.errorhandler(ValidationError)
    def handle_validation(err: ValidationError):
        return jsonify({
            "message": "Please fix the highlighted fields.",
            "errors": err.errors,  
        }), 400

    @app.errorhandler(StudyDataError)
    def handle_study_data(err: StudyDataError):
        log.error("Study data unavailable: %s", err)
        return jsonify({
            "message": "The study database is unavailable right now. Please try again shortly."
        }), 503

    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        if err.status >= 500:
            log.error("%s: %s", type(err).__name__, err)
        return jsonify(err.to_json()), err.status

    @app.errorhandler(ConfigError)
    def handle_config(err: ConfigError):
        log.error("Configuration error: %s", err)
        return jsonify({"message": "The server is not set up correctly."}), 500

    @app.errorhandler(HTTPException)
    def handle_http(err: HTTPException):
        return jsonify({"message": err.description or err.name}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected(err: Exception):
        log.exception("Unhandled error")
        return jsonify({"message": "Something went wrong on our side."}), 500


app = create_app() if __name__ != "__main__" else None

if __name__ == "__main__":
    create_app().run(debug=True, port=5000)