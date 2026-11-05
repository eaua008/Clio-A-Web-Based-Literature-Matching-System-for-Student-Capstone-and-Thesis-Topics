"""Study model: reads studies from Supabase (public read, so the anon key is enough)."""
from dataclasses import dataclass, field
from typing import Optional

import requests

from app.config import Settings
from app.errors import StudyDataError
from app.models.supabase_client import SupabaseClient

COLUMNS = ("id,title,abstract,keywords,authors,year,source_type,source_name,url,"
           "study_type,cited_by,access,setting,is_sample")
PAGE_SIZE = 1000


@dataclass
class Study:
    id: str
    title: str
    abstract: str = ""
    keywords: list = field(default_factory=list)
    authors: list = field(default_factory=list)
    year: Optional[int] = None
    source_type: str = ""
    source_name: str = ""
    url: Optional[str] = None
    study_type: Optional[str] = None
    cited_by: Optional[int] = None
    access: Optional[str] = None
    setting: Optional[str] = None
    is_sample: bool = False

    @classmethod
    def from_row(cls, row: dict) -> "Study":
        return cls(
            id=str(row.get("id") or ""),
            title=row.get("title") or "",
            abstract=row.get("abstract") or "",
            keywords=list(row.get("keywords") or []),
            authors=list(row.get("authors") or []),
            year=row.get("year"),
            source_type=row.get("source_type") or "",
            source_name=row.get("source_name") or "",
            url=row.get("url"),
            study_type=row.get("study_type"),
            cited_by=row.get("cited_by"),
            access=row.get("access"),
            setting=row.get("setting"),
            is_sample=bool(row.get("is_sample")),
        )


class StudyModel(SupabaseClient):
    def __init__(self, settings: Settings, session: Optional[requests.Session] = None):
        super().__init__(settings, None, session)

    def error_for(self, response: Optional[requests.Response]) -> Exception:
        if response is None:
            return StudyDataError("Could not read studies: no connection")
        return StudyDataError(f"Could not read studies: HTTP {response.status_code}")

    def _get(self, params: dict) -> list:
        try:
            return self._request("GET", "studies", params, returning=False)
        except ValueError as error:
            raise StudyDataError(f"Could not read studies: {error}") from error

    def get_all_studies(self) -> list:
        """Every study, fetched page by page."""
        studies, offset = [], 0
        while True:
            rows = self._get({"select": COLUMNS, "order": "id", "limit": PAGE_SIZE, "offset": offset})
            studies.extend(Study.from_row(r) for r in rows)
            if len(rows) < PAGE_SIZE:
                return studies
            offset += PAGE_SIZE
