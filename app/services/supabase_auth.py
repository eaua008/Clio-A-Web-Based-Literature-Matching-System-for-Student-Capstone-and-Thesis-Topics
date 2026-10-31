"""Talks to Supabase Auth (sign in, sign up, refresh, sign out) from the server.

The browser never sees the tokens: Flask keeps them in HttpOnly cookies (see session_cookies.py).
"""
from dataclasses import dataclass
from typing import Optional

import requests

from app.config import Settings, get_settings
from app.errors import AuthError, AuthServiceError, FormError


@dataclass(frozen=True)
class AuthSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user: dict


class SupabaseAuthClient:
    timeout = 10

    def __init__(self, settings: Optional[Settings] = None, session: Optional[requests.Session] = None):
        self._settings = settings
        self._session = session or requests.Session()

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    def _call(self, method: str, path: str, body: Optional[dict] = None, token: Optional[str] = None):
        settings = self.settings
        settings.require_supabase()
        headers = {"apikey": settings.supabase_key, "Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            return self._session.request(method, f"{settings.supabase_url}/auth/v1{path}",
                                         json=body, headers=headers, timeout=self.timeout)
        except requests.RequestException as error:
            raise AuthServiceError() from error

    @staticmethod
    def _data(response) -> dict:
        try:
            data = response.json()
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}

    @classmethod
    def _session_from(cls, data: dict) -> AuthSession:
        return AuthSession(data["access_token"], data["refresh_token"],
                           int(data.get("expires_in") or 3600), data.get("user") or {})

    def _fail(self, response, view: str) -> FormError:
        """A failed sign-in or sign-up, reworded so it never reveals whether an email has an account."""
        data = self._data(response)
        code = str(data.get("error_code") or data.get("error") or "")
        if response.status_code == 429 or "rate_limit" in code:
            return FormError("Too many attempts. Please wait a minute and try again.", status=429)
        if code == "email_not_confirmed":
            return FormError("Confirm your email first. We sent you a link when you signed up.")
        if code == "weak_password":
            return FormError("That password is too weak.",
                             {"password": "Choose a stronger password: at least 8 characters, not only numbers."})
        if code == "signup_disabled":
            return FormError("New sign-ups are turned off right now.", status=403)
        if response.status_code >= 500:
            return FormError("The sign-in service couldn't complete the request.", status=502)
        if view == "login":
            return FormError("Incorrect email or password.", status=401)
        return FormError("We couldn't create an account with those details. "
                         "If you already have one, sign in instead.")

    def sign_in(self, email: str, password: str) -> AuthSession:
        response = self._call("POST", "/token?grant_type=password", {"email": email, "password": password})
        if response.status_code != 200:
            raise self._fail(response, "login")
        return self._session_from(self._data(response))

    def sign_up(self, name: str, email: str, password: str) -> Optional[AuthSession]:
        """The new session, or None when Supabase first wants the email confirmed."""
        response = self._call("POST", "/signup",
                              {"email": email, "password": password, "data": {"full_name": name}})
        if response.status_code not in (200, 201):
            raise self._fail(response, "signup")
        data = self._data(response)
        return self._session_from(data) if data.get("access_token") else None

    def refresh(self, refresh_token: str) -> AuthSession:
        response = self._call("POST", "/token?grant_type=refresh_token", {"refresh_token": refresh_token})
        if response.status_code != 200:
            raise AuthError("Your session has expired. Please sign in again.")
        return self._session_from(self._data(response))

    def get_user(self, access_token: str) -> dict:
        response = self._call("GET", "/user", token=access_token)
        if response.status_code != 200:
            raise AuthError("Your session has expired. Please sign in again.")
        return self._data(response)

    def sign_out(self, access_token: str) -> None:
        try:
            self._call("POST", "/logout?scope=local", token=access_token)
        except AuthServiceError:
            pass  # the cookies are cleared either way