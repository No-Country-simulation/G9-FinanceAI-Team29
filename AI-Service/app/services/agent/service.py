from app.profile import analizar_usuario
from app.services.llm.prompt_builder import PromptBuilder
from app.services.llm.schemas import LLMResponse
from app.services.llm.service import LLMService


class FinSightAgentService:
    def __init__(self) -> None:
        self.llm = LLMService()

    async def chat(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
    ) -> LLMResponse:
        """
        Obtiene el análisis financiero del usuario y lo utiliza
        como contexto para generar una respuesta con el LLM.
        """

        analisis = analizar_usuario(usuario_id)

        messages = PromptBuilder.build(
            question=question,
            context=analisis,
        )

        return await self.llm.generate(
            messages=messages,
            provider=provider,
        )