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

    # LangSmith
    langchain_tracing_v2: str = "false"
    langchain_api_key: str = ""
    langchain_project: str = "mindful-ai"
    langchain_endpoint: str = "https://api.smith.langchain.com"

    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()