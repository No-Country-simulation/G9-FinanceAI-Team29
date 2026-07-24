from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    app_name: str = "FinSightAI AI Service"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True

    api_prefix: str = "/api/v1"

    # LLM
    llm_provider: str = "groq"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 1200

    # Groq
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"

    # Gemini
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"

    allowed_origins: str = (
        "http://localhost:3000,"
        "http://localhost:5173,"
        "http://localhost:8081"
    )

    knowledge_dir: Path = BASE_DIR / "knowledge"
    vector_store_dir: Path = PROJECT_DIR / "storage" / "faiss_index"
    models_dir: Path = PROJECT_DIR / "models"
    goals_storage_path: Path = PROJECT_DIR / "storage" / "goals.json"

    model_config = SettingsConfigDict(
        env_file=PROJECT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

processed_data_dir: Path = PROJECT_DIR / "data" / "processed"

metadata_path: Path = (
    PROJECT_DIR
    / "models"
    / "metadata_modelos.json"
)

metrics_path: Path = (
    PROJECT_DIR
    / "models"
    / "metricas_modelos.csv"
)