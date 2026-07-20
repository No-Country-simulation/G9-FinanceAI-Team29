from app.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.groq_provider import GroqProvider


class LLMProviderFactory:
    @staticmethod
    def create(provider: str | None = None) -> LLMProvider:
        selected_provider = (
            provider or settings.llm_provider
        ).lower()

        if selected_provider == "groq":
            if not settings.groq_api_key:
                raise ValueError("GROQ_API_KEY no está configurada.")

            return GroqProvider(
                api_key=settings.groq_api_key,
                model=settings.groq_model,
            )

        if selected_provider in {"gemini", "google"}:
            if not settings.gemini_api_key:
                raise ValueError("GEMINI_API_KEY no está configurada.")

            return GeminiProvider(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
            )

        raise ValueError(
            f"Proveedor LLM no soportado: {selected_provider}"
        )