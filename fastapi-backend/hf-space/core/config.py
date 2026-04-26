# app/core/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    ai_provider: str = "gemini"
    database_url: str = ""
    next_public_supabase_url: str = ""
    supabase_service_role_key: str = ""
    clerk_secret_key: str = ""
    environment: str = "development"
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()