from collections.abc import Sequence

from groq import AsyncGroq

from app.services.llm.base import LLMProvider
from app.services.llm.schemas import LLMMessage, LLMResponse


class GroqProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
    ) -> None:
        self.client = AsyncGroq(api_key=api_key)
        self.model = model

    async def generate(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResponse:
        response = await self.client.chat.completions.create(
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

        return LLMResponse(
            content=response.choices[0].message.content or "",
            provider="groq",
            model=self.model,
            input_tokens=getattr(usage, "prompt_tokens", None),
            output_tokens=getattr(usage, "completion_tokens", None),
        )