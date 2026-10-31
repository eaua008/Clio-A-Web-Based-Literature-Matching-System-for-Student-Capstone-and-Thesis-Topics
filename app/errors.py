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


class RuleViolation(AppError):
    """A Logic rule rejected the request. With field errors it is bad input (400), otherwise forbidden (403)."""
    message = "You don't have access to this project."

    def __init__(self, message: Optional[str] = None, errors: Optional[dict] = None):
        super().__init__(message)
        self.errors = errors or {}

    @property
    def status(self) -> int:
        return 400 if self.errors else 403

    def to_json(self) -> dict:
        body = super().to_json()
        if self.errors:
            body["errors"] = self.errors
        return body