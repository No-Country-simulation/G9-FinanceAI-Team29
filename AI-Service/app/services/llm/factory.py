from app.config import settings
from app.services.llm.base import LLMProvider


class LLMProviderFactory:
    @staticmethod
    def create(provider: str | None = None) -> LLMProvider:
        selected_provider = (
            provider or settings.llm_provider
        ).lower()

        if selected_provider == "groq":
            if not settings.groq_api_keys:
                raise ValueError(
                    "No hay GROQ_API_KEY configuradas."
                )

            from app.services.llm.groq_provider import (
                GroqProvider,
            )

            return GroqProvider(
                api_keys=settings.groq_api_keys,
                model=settings.groq_model,
            )

        if selected_provider == "openrouter":
            if not settings.openrouter_api_key:
                raise ValueError(
                    "OPENROUTER_API_KEY no está configurada."
                )

            from app.services.llm.openrouter_provider import (
                OpenRouterProvider,
            )

            return OpenRouterProvider(
                api_key=settings.openrouter_api_key,
                model=settings.openrouter_model,
                base_url=settings.openrouter_base_url,
            )

        if selected_provider in {"gemini", "google"}:
            if not settings.gemini_api_key:
                raise ValueError(
                    "GEMINI_API_KEY no está configurada."
                )

            from app.services.llm.gemini_provider import (
                GeminiProvider,
            )

            return GeminiProvider(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
            )

        raise ValueError(
            f"Proveedor LLM no soportado: {selected_provider}"
        )
