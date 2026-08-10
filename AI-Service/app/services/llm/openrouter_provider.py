import logging
from collections.abc import Sequence

from openai import AsyncOpenAI

from app.services.llm.base import LLMProvider
from app.services.llm.schemas import LLMMessage, LLMResponse


logger = logging.getLogger(__name__)


class OpenRouterProvider(LLMProvider):
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

        last_error: Exception | None = None

        for attempt in range(1, 3):
            try:
                response = await client.chat.completions.create(
                    model=self.model,
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
                        "OpenRouter devolvió una respuesta inválida "
                        "o incompleta en intento #%s. "
                        "Modelo: %s | finish_reason: %s | contenido: %r",
                        attempt,
                        actual_model or "desconocido",
                        finish_reason or "desconocido",
                        content,
                    )

                    if attempt < 2:
                        continue

                    raise RuntimeError(
                        "OpenRouter devolvió una respuesta inválida "
                        "o incompleta."
                    )

                return LLMResponse(
                    content=content,
                    provider="openrouter",
                    model=self.model,
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
                        "actual_model": actual_model,
                        "attempt": attempt,
                        "finish_reason": finish_reason,
                    },
                )

            except Exception as exc:
                last_error = exc

                logger.warning(
                    "OpenRouter intento #%s falló: %s",
                    attempt,
                    type(exc).__name__,
                )

                if attempt < 2:
                    continue

        if last_error is not None:
            logger.error(
                "OpenRouter falló después de los reintentos."
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
        }

        return normalized in invalid_responses