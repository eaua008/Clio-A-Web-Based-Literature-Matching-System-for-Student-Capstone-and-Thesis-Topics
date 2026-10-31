"""Keeps the signed-in session in HttpOnly cookies, so it survives a page refresh.

HttpOnly: page scripts can't read the tokens. SameSite=Lax: other websites can't send them
along with a form post. Path=/api/: the cookies only go to the backend, not with every file.
Secure: only over HTTPS (switched on automatically when the site is served over HTTPS).
"""
from flask import request

from app.services.supabase_auth import AuthSession


class SessionCookies:
    ACCESS = "clio_access"
    REFRESH = "clio_refresh"
    PATH = "/api/"
    REMEMBER_FOR = 30 * 24 * 60 * 60  # seconds; how long a refresh keeps you signed in

    def read(self) -> tuple:
        """(access token, refresh token); either can be None."""
        return request.cookies.get(self.ACCESS), request.cookies.get(self.REFRESH)

    def _set(self, response, name: str, value: str, max_age: int) -> None:
        response.set_cookie(name, value, max_age=max_age, path=self.PATH, httponly=True,
                            samesite="Lax", secure=request.is_secure)

    def write(self, response, session: AuthSession) -> None:
        self._set(response, self.ACCESS, session.access_token, session.expires_in)
        self._set(response, self.REFRESH, session.refresh_token, self.REMEMBER_FOR)

    def clear(self, response) -> None:
        for name in (self.ACCESS, self.REFRESH):
            response.delete_cookie(name, path=self.PATH, httponly=True, samesite="Lax", secure=request.is_secure)