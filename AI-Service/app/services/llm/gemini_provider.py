from collections.abc import Sequence

from google import genai
from google.genai import types

from app.services.llm.base import LLMProvider
from app.services.llm.schemas import LLMMessage, LLMResponse


class GeminiProvider(LLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
    ) -> None:
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def generate(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResponse:
        system_instruction = None
        contents = []

        for message in messages:
            if message.role == "system":
                system_instruction = message.content
                continue

            role = "user" if message.role == "user" else "model"

            contents.append(
                types.Content(
                    role=role,
                    parts=[
                        types.Part.from_text(text=message.content)
                    ],
                )
            )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )

        usage = response.usage_metadata

        return LLMResponse(
            content=response.text or "",
            provider="gemini",
            model=self.model,
            input_tokens=getattr(
                usage,
                "prompt_token_count",
                None,
            ),
            output_tokens=getattr(
                usage,
                "candidates_token_count",
                None,
            ),
        )