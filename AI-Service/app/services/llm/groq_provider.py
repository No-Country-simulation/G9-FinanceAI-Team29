import logging
from collections.abc import Sequence

from groq import AsyncGroq

from app.services.llm.base import LLMProvider
from app.services.llm.schemas import LLMMessage, LLMResponse


logger = logging.getLogger(__name__)


class GroqProvider(LLMProvider):
    def __init__(
        self,
        api_keys: list[str],
        model: str,
    ) -> None:
        if not api_keys:
            raise ValueError("No hay API Keys de Groq configuradas.")

        self.api_keys = api_keys
        self.model = model

    async def generate(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResponse:
        last_error: Exception | None = None

        for index, api_key in enumerate(self.api_keys, start=1):
            try:
                logger.info(
                    "Intentando Groq con Key #%s",
                    index,
                )

                # No hacemos retries internos del SDK.
                # Si Groq devuelve 429, timeout u otro error,
                # probamos inmediatamente la siguiente key.
                # Si fallan todas, LLMService activa OpenRouter.
                client = AsyncGroq(
                    api_key=api_key,
                    max_retries=0,
                    timeout=10.0,
                )

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

                logger.info(
                    "Groq respondió correctamente con Key #%s",
                    index,
                )

                return LLMResponse(
                    content=response.choices[0].message.content or "",
                    provider="groq",
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
                        "groq_key": index,
                    },
                )

            except Exception as exc:
                last_error = exc

                logger.warning(
                    "Groq Key #%s falló: %s",
                    index,
                    type(exc).__name__,
                )

                continue

        if last_error is not None:
            raise last_error

        raise RuntimeError(
            "Groq no pudo generar una respuesta."
        )