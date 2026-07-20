from typing import Any, Literal

from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMResponse(BaseModel):
    content: str

    provider: str
    model: str

    input_tokens: int | None = None
    output_tokens: int | None = None

    metadata: dict[str, Any] = Field(default_factory=dict)