import logging
from collections.abc import Sequence

from app.config import settings
from app.services.llm.factory import LLMProviderFactory
from app.services.llm.schemas import LLMMessage, LLMResponse

logger = logging.getLogger(__name__)


class LLMService:
    async def generate(
        self,
        messages: Sequence[LLMMessage],
        provider: str | None = None,
    ) -> LLMResponse:
        selected_provider = (
            provider or settings.llm_provider
        ).lower()

        try:
            llm = LLMProviderFactory.create(selected_provider)

            return await llm.generate(
                messages=messages,
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens,
            )

        except Exception:
            logger.exception(
                "Error utilizando %s",
                selected_provider,
            )

            fallback = self._fallback(selected_provider)

            if fallback is None:
                raise

            logger.warning(
                "Intentando con proveedor alternativo: %s",
                fallback,
            )

            llm = LLMProviderFactory.create(fallback)

            return await llm.generate(
                messages=messages,
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens,
            )

    @staticmethod
    def _fallback(provider: str) -> str | None:
        if provider == "groq":
            return "gemini"

        if provider in {"gemini", "google"}:
            return "groq"

        return None