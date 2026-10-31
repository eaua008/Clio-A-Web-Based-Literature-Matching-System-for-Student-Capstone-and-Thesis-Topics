"""Base class for every controller: builds a Flask blueprint from the routes a subclass lists."""
from abc import ABC, abstractmethod

from flask import Blueprint, request


class BaseController(ABC):
    name = ""
    url_prefix = None

    def __init__(self):
        self.blueprint = Blueprint(self.name, __name__, url_prefix=self.url_prefix)
        for rule, view, methods in self.routes():
            self.blueprint.add_url_rule(rule, endpoint=view.__name__, view_func=view, methods=methods)

    @abstractmethod
    def routes(self) -> list:
        """[(url rule, bound method, [HTTP methods]), ...]"""

    @staticmethod
    def json_body() -> dict:
        body = request.get_json(silent=True)
        return body if isinstance(body, dict) else {}