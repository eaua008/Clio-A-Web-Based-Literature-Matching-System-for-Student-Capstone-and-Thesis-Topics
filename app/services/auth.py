"""Finds out who is signed in, from the session cookies (or an "Authorization: Bearer" header)."""
from dataclasses import dataclass
from typing import Optional

from flask import g, request

from app.errors import AuthError
from app.services.session_cookies import SessionCookies
from app.services.supabase_auth import SupabaseAuthClient


@dataclass(frozen=True)
class User:
    id: str
    email: str
    name: str
    token: str

    @classmethod
    def from_supabase(cls, data: dict, token: str) -> "User":
        meta = data.get("user_metadata") or {}
        return cls(id=str(data["id"]), email=data.get("email") or "",
                   name=str(meta.get("full_name") or "").strip(), token=token)


class AuthService:
    """Works out the current user. If the access token has expired it uses the refresh token,
    and leaves the new session in flask.g so the response can update the cookies."""

    def __init__(self, client: Optional[SupabaseAuthClient] = None, cookies: Optional[SessionCookies] = None):
        self.client = client or SupabaseAuthClient()
        self.cookies = cookies or SessionCookies()

    @staticmethod
    def bearer_token() -> Optional[str]:
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        return token.strip() if scheme.lower() == "bearer" and token.strip() else None

    def verify_token(self, token: str) -> User:
        """Asks Supabase who the token belongs to. Raises AuthError if it is not valid."""
        return User.from_supabase(self.client.get_user(token), token)

    def _from_cookies(self) -> Optional[User]:
        """The user from the cookies, refreshing an expired session. None if there is no valid session;
        a dead session is marked so the response clears its cookies."""
        access, refresh = self.cookies.read()
        if not access and not refresh:
            return None
        try:
            if access:
                try:
                    return self.verify_token(access)
                except AuthError:
                    if not refresh:
                        raise
            session = self.client.refresh(refresh)
            g.clio_new_session = session
            return User.from_supabase(session.user, session.access_token)
        except AuthError:
            g.clio_clear_session = True
            return None

    def current_user(self, required: bool = True) -> Optional[User]:
        """The signed-in user for this request. Raises AuthError if required and nobody is signed in."""
        if "clio_user" in g:
            user = g.clio_user
        else:
            token = self.bearer_token()
            user = self.verify_token(token) if token else self._from_cookies()
            g.clio_user = user
        if user is None and required:
            raise AuthError()
        return user