from typing import Optional


class AppError(Exception):
    status = 500
    message = "Something went wrong on our side."

    def __init__(self, message: Optional[str] = None):
        super().__init__(message or self.message)
        if message:
            self.message = message

    def to_json(self) -> dict:
        return {"message": self.message}


class AuthError(AppError):
    """Missing, expired or invalid sign-in token."""
    status = 401
    message = "Please sign in first."


class NotFoundError(AppError):
    status = 404
    message = "Not found."


class ProjectDataError(AppError):
    """Projects could not be read or saved."""
    status = 503
    message = "The database is unavailable right now. Please try again shortly."

    def __init__(self, message: Optional[str] = None, status: Optional[int] = None):
        super().__init__(message)
        if status:
            self.status = status


class FieldError(AppError):
    status = 400
    message = "Please fix the highlighted fields."

    def __init__(self, message: Optional[str] = None, errors: Optional[dict] = None, status: Optional[int] = None):
        super().__init__(message)
        self.errors = errors or {}
        if status:
            self.status = status

    def to_json(self) -> dict:
        body = super().to_json()
        if self.errors:
            body["errors"] = self.errors
        return body


class ValidationError(FieldError, ValueError):
    """Bad input. `errors` maps a field name to its message."""

    def __init__(self, errors: dict):
        super().__init__(errors=errors)


class FormError(FieldError):
    """Bad sign-in or sign-up details. `errors` maps a form field to its message."""


class RuleViolation(FieldError):
    """A Logic rule rejected the request. With field errors it is bad input (400), otherwise forbidden (403)."""
    message = "You don't have access to this project."

    @property
    def status(self) -> int:
        return 400 if self.errors else 403


class ForbiddenError(AppError):
    status = 403
    message = "This request was blocked."


class AuthServiceError(AppError):
    """Supabase Auth could not be reached."""
    status = 503
    message = "Couldn't reach the sign-in service. Please try again shortly."


class StudyDataError(AppError):
    """The studies could not be read from the database."""
    status = 503
    message = "The study database is unavailable right now. Please try again shortly."

    def __init__(self, detail: Optional[str] = None):
        super().__init__()
        if detail:
            self.args = (detail,)
