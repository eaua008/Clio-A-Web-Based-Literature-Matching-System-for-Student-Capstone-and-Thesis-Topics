from flask import Flask, g, request

from app.errors import ForbiddenError
from app.services.auth import AuthService

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
REQUEST_HEADER = "X-Clio-Request"


def block_cross_site_writes():
    """Cookies are sent automatically, so a write to the API must also carry a header that
    only this site's own scripts can add. Another website's form can't add it."""
    if request.path.startswith("/api/") and request.method not in SAFE_METHODS \
            and request.headers.get(REQUEST_HEADER) != "1":
        raise ForbiddenError()


def register_request_hooks(app: Flask, auth: AuthService) -> None:
    def update_cookies(response):
        """Saves a refreshed session, or clears a dead one, after any request."""
        if "clio_new_session" in g:
            auth.cookies.write(response, g.clio_new_session)
        elif g.get("clio_clear_session"):
            auth.cookies.clear(response)
        return response

    app.before_request(block_cross_site_writes)
    app.after_request(update_cookies)
