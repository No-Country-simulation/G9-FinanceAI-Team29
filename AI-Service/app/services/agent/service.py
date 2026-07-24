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
        Obtiene el análisis financiero del usuario y utiliza
        únicamente la información relevante como contexto del LLM.
        """

        analisis = analizar_usuario(usuario_id)

        context = {
            "financial_score": analisis["financial_score"],
            "score_status": analisis["score_status"],
            "nivel_riesgo": analisis["nivel_riesgo"],
            "perfil_financiero": analisis["perfil_financiero"],
            "confianza_perfil": analisis["confianza_perfil"],
            "metricas": analisis["metricas"],
            "categorias_principales": analisis["categorias_principales"],
        }

        messages = PromptBuilder.build(
            question=question,
            context=context,
        )

        return await self.llm.generate(
            messages=messages,
            provider=provider,
        )