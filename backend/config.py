"""Clio backend settings, read from environment variables (or a .env file)."""
import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError: 
    pass


class ConfigError(RuntimeError):
    """A required setting is missing or unsafe."""


@dataclass(frozen=True)
class Settings:
    supabase_url: str = ""
    supabase_key: str = ""
    cache_ttl: int = 600     
    default_limit: int = 5   
    max_limit: int = 20         
    min_score: float = 1.0        
    high_score: float = 50.0     
    medium_score: float = 20.0    
    keyword_boost: int = 2        

    def require_supabase(self) -> None:
        if not self.supabase_url or not self.supabase_key:
            raise ConfigError("Set SUPABASE_URL and SUPABASE_KEY (see .env.example).")
        if self.supabase_key.startswith("sb_secret_"):
            raise ConfigError("SUPABASE_KEY is a secret key. Use the public anon/publishable key instead.")


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def load_settings() -> Settings:
    return Settings(
        supabase_url=_env("SUPABASE_URL").strip().rstrip("/"),
        supabase_key=_env("SUPABASE_KEY").strip(),
        cache_ttl=int(_env("CLIO_CACHE_TTL", "600")),
        default_limit=int(_env("CLIO_DEFAULT_LIMIT", "5")),
        min_score=float(_env("CLIO_MIN_SCORE", "1.0")),
        high_score=float(_env("CLIO_HIGH_SCORE", "50")),
        medium_score=float(_env("CLIO_MEDIUM_SCORE", "20")),
        keyword_boost=int(_env("CLIO_KEYWORD_BOOST", "2")),
    )