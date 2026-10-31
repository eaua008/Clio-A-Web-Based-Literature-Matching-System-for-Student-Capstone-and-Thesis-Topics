"""Sign in, sign up, sign out and "who am I", handled by Flask so the session can live in cookies.

POST /api/auth/login/    { email, password }        -> { user }
POST /api/auth/signup/   { name, email, password }  -> { user } or { needsConfirmation: true }
POST /api/auth/logout/                              -> { ok: true }
GET  /api/auth/me/                                  -> { user } (user is null when signed out)
"""
from flask import g, jsonify, request

from app.controllers.base_controller import BaseController
from app.errors import ForbiddenError, FormError
from app.services.auth import AuthService, User
from app.views.match_view import UserView

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
REQUEST_HEADER = "X-Clio-Request"


class AuthController(BaseController):
    name = "auth"
    url_prefix = "/api/auth"

    def __init__(self, auth: AuthService):
        self.auth = auth
        self.view = UserView()
        super().__init__()
        self.blueprint.before_app_request(self.block_cross_site_writes)
        self.blueprint.after_app_request(self.update_cookies)

    def routes(self) -> list:
        return [
            ("/login/", self.login, ["POST"]),
            ("/signup/", self.signup, ["POST"]),
            ("/logout/", self.logout, ["POST"]),
            ("/me/", self.me, ["GET"]),
        ]

    # ---- run around every request ----

    @staticmethod
    def block_cross_site_writes():
        """Cookies are sent automatically, so a write to the API must also carry a header that
        only this site's own scripts can add. Another website's form can't add it."""
        if request.path.startswith("/api/") and request.method not in SAFE_METHODS \
                and request.headers.get(REQUEST_HEADER) != "1":
            raise ForbiddenError()

    def update_cookies(self, response):
        """Saves a refreshed session, or clears a dead one, after any request."""
        if "clio_new_session" in g:
            self.auth.cookies.write(response, g.clio_new_session)
        elif g.get("clio_clear_session"):
            self.auth.cookies.clear(response)
        return response

    # ---- routes ----

    @staticmethod
    def _required(body: dict, *fields) -> dict:
        values = {f: str(body.get(f) or "").strip() if f != "password" else str(body.get(f) or "") for f in fields}
        errors = {f: "This field is required." for f, v in values.items() if not v}
        if errors:
            raise FormError(errors=errors)
        return values

    def _signed_in(self, session):
        user = User.from_supabase(session.user, session.access_token)
        response = jsonify({"user": self.view.render(user)})
        self.auth.cookies.write(response, session)
        return response

    def login(self):
        data = self._required(self.json_body(), "email", "password")
        return self._signed_in(self.auth.client.sign_in(data["email"], data["password"]))

    def signup(self):
        data = self._required(self.json_body(), "name", "email", "password")
        session = self.auth.client.sign_up(data["name"], data["email"], data["password"])
        if session is None:
            return jsonify({"user": None, "needsConfirmation": True})
        return self._signed_in(session)

    def logout(self):
        access, _ = self.auth.cookies.read()
        if access:
            self.auth.client.sign_out(access)
        response = jsonify({"ok": True})
        self.auth.cookies.clear(response)
        g.pop("clio_new_session", None)
        return response

    def me(self):
        user = self.auth.current_user(required=False)
        return jsonify({"user": self.view.render(user) if user else None})