import logging
from collections.abc import Sequence

from openai import AsyncOpenAI

from app.services.llm.base import LLMProvider
from app.services.llm.schemas import LLMMessage, LLMResponse

logger = logging.getLogger(__name__)


class OpenRouterProvider(LLMProvider):
    # Modelos de chat concretos.
    # Evitamos openrouter/free porque puede elegir modelos de clasificación/safety.
    FALLBACK_MODELS = (
    "openrouter/free",
)

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
    ) -> None:
        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY no está configurada."
            )

        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def generate(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResponse:
        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

        # Si en .env ya hay un modelo concreto, probarlo primero.
        models: list[str] = []

        if self.model and self.model != "openrouter/free":
            models.append(self.model)

        for fallback_model in self.FALLBACK_MODELS:
            if fallback_model not in models:
                models.append(fallback_model)

        last_error: Exception | None = None

        for model in models:
            for attempt in range(1, 3):
                try:
                    logger.info(
                        "Intentando OpenRouter con modelo: %s (intento #%s)",
                        model,
                        attempt,
                    )

                    response = await client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                                "role": message.role,
                                "content": message.content,
                            }
                            for message in messages
                        ],
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )

                    usage = response.usage

                    actual_model = getattr(
                        response,
                        "model",
                        None,
                    )

                    content = (
                        response.choices[0].message.content or ""
                    ).strip()

                    finish_reason = getattr(
                        response.choices[0],
                        "finish_reason",
                        None,
                    )

                    logger.info(
                        "OpenRouter respondió con modelo real: %s",
                        actual_model or "desconocido",
                    )

                    logger.info(
                        "OpenRouter finish_reason: %s",
                        finish_reason or "desconocido",
                    )

                    invalid_response = (
                        self._is_invalid_response(content)
                        or finish_reason == "length"
                    )

                    if invalid_response:
                        logger.warning(
                            "Respuesta inválida de OpenRouter. "
                            "Modelo solicitado: %s | Modelo real: %s | "
                            "intento #%s | finish_reason: %s | contenido: %r",
                            model,
                            actual_model or "desconocido",
                            attempt,
                            finish_reason or "desconocido",
                            content,
                        )

                        raise RuntimeError(
                            "OpenRouter devolvió una respuesta inválida "
                            "o incompleta."
                        )

                    return LLMResponse(
                        content=content,
                        provider="openrouter",
                        model=actual_model or model,
                        input_tokens=getattr(
                            usage,
                            "prompt_tokens",
                            None,
                        ),
                        output_tokens=getattr(
                            usage,
                            "completion_tokens",
                            None,
                        ),
                        metadata={
                            "openrouter": True,
                            "requested_model": model,
                            "actual_model": actual_model,
                            "attempt": attempt,
                            "finish_reason": finish_reason,
                        },
                    )

                except Exception as exc:
                    last_error = exc

                    logger.warning(
                        "OpenRouter modelo %s intento #%s falló: %s",
                        model,
                        attempt,
                        type(exc).__name__,
                    )

                    # Reintenta una vez el mismo modelo.
                    if attempt < 2:
                        continue

                    # Después pasa al siguiente modelo.
                    logger.warning(
                        "OpenRouter cambia al siguiente modelo después "
                        "de fallar %s.",
                        model,
                    )

        if last_error is not None:
            logger.error(
                "OpenRouter falló con todos los modelos configurados."
            )
            raise last_error

        raise RuntimeError(
            "OpenRouter no pudo generar una respuesta."
        )

    @staticmethod
    def _is_invalid_response(content: str) -> bool:
        normalized = content.strip().casefold()

        invalid_responses = {
            "user safety: safe",
            "safety: safe",
            "safe",
            "user safety: unsafe",
            "safety: unsafe",
        }

        if normalized in invalid_responses:
            return True

        # Defensa adicional ante modelos de clasificación/safety.
        if len(normalized) < 40 and (
            "user safety:" in normalized
            or normalized.startswith("safety:")
        ):
            return True

        return False