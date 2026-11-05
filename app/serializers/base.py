from abc import ABC, abstractmethod


class JsonView(ABC):
    @abstractmethod
    def render(self, item) -> dict:
        """One item as JSON-ready data."""

    def render_all(self, items) -> list:
        return [self.render(item) for item in items]
