from abc import ABC, abstractmethod
from collections.abc import Sequence

from app.services.llm.schemas import LLMMessage, LLMResponse


class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> LLMResponse:
        """
        Genera una respuesta utilizando un proveedor LLM.
        """
        raise NotImplementedError