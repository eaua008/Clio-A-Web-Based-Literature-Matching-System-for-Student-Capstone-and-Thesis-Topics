"""Base class for every class that talks to Supabase's REST API (PostgREST)."""
from typing import Optional

import requests

from app.config import Settings
from app.errors import ProjectDataError


class SupabaseClient:
    """Holds the connection details and sends requests. Subclasses add table-specific methods.

    With a user token, the database's row level security sees the request as that user.
    Without one, it is an anonymous (public) request.
    """
    timeout = 15

    def __init__(self, settings: Settings, token: Optional[str] = None,
                 session: Optional[requests.Session] = None):
        settings.require_supabase()
        self._base = f"{settings.supabase_url}/rest/v1"
        self._session = session or requests.Session()
        self._session.headers.update({
            "apikey": settings.supabase_key,
            "Authorization": f"Bearer {token or settings.supabase_key}",
            "Content-Type": "application/json",
        })

    def _request(self, method: str, table: str, params=None, body=None, returning: bool = True) -> list:
        headers = {"Prefer": "return=representation"} if returning else {}
        try:
            response = self._session.request(method, f"{self._base}/{table}", params=params,
                                             json=body, headers=headers, timeout=self.timeout)
        except requests.RequestException as error:
            raise self.error_for(None) from error
        if response.status_code >= 400:
            raise self.error_for(response)
        return response.json() if response.content else []

    def error_for(self, response: Optional[requests.Response]) -> Exception:
        """Turns a failed response (None = no connection) into an exception. Subclasses can override this."""
        if response is None:
            return ProjectDataError()
        try:
            code = response.json().get("code")
        except ValueError:
            code = None
        if code == "54000":
            return ProjectDataError("You've reached the limit for saved projects.", 409)
        if response.status_code in (401, 403):
            return ProjectDataError("You don't have access to this project.", 403)
        return ProjectDataError()