"""Checks the Supabase access token the browser sends as "Authorization: Bearer <token>"."""
from dataclasses import dataclass
from typing import Optional

import requests
from flask import request

from app.config import Settings, get_settings
from app.errors import AuthError


@dataclass(frozen=True)
class User:
    id: str
    email: str
    token: str


class AuthService:
    """Finds out who is signed in. Tests replace it with a subclass that skips Supabase."""

    def __init__(self, settings: Optional[Settings] = None, session: Optional[requests.Session] = None):
        self._settings = settings
        self._session = session or requests.Session()

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    @staticmethod
    def bearer_token() -> Optional[str]:
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        return token.strip() if scheme.lower() == "bearer" and token.strip() else None

    def verify_token(self, token: str) -> User:
        """Asks Supabase who the token belongs to. Raises AuthError if it is not valid."""
        settings = self.settings
        settings.require_supabase()
        try:
            response = self._session.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={"apikey": settings.supabase_key, "Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except requests.RequestException as error:
            raise AuthError("Could not check your sign-in. Please try again.") from error
        if response.status_code != 200:
            raise AuthError("Your session has expired. Please sign in again.")
        data = response.json()
        return User(id=str(data["id"]), email=data.get("email") or "", token=token)

    def current_user(self, required: bool = True) -> Optional[User]:
        """The signed-in user for this request. Raises AuthError if required and nobody is signed in."""
        token = self.bearer_token()
        if not token:
            if required:
                raise AuthError()
            return None
        return self.verify_token(token)