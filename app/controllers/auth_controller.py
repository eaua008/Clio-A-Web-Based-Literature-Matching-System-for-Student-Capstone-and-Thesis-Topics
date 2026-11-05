"""Sign in, sign up, sign out and "who am I", handled by Flask so the session can live in cookies.

POST /api/auth/login/    { email, password }        -> { user }
POST /api/auth/signup/   { name, email, password }  -> { user } or { needsConfirmation: true }
POST /api/auth/logout/                              -> { ok: true }
GET  /api/auth/me/                                  -> { user } (user is null when signed out)
"""
from flask import g, jsonify

from app.controllers.base_controller import BaseController
from app.errors import FormError
from app.services.auth import AuthService, User
from app.serializers.user_view import UserView


class AuthController(BaseController):
    name = "auth"
    url_prefix = "/api/auth"

    def __init__(self, auth: AuthService):
        self.auth = auth
        self.view = UserView()
        super().__init__()

    def routes(self) -> list:
        return [
            ("/login/", self.login, ["POST"]),
            ("/signup/", self.signup, ["POST"]),
            ("/logout/", self.logout, ["POST"]),
            ("/me/", self.me, ["GET"]),
        ]

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
            self.auth.forget(access)
            self.auth.client.sign_out(access)
        response = jsonify({"ok": True})
        self.auth.cookies.clear(response)
        g.pop("clio_new_session", None)
        return response

    def me(self):
        user = self.auth.current_user(required=False)
        return jsonify({"user": self.view.render(user) if user else None})