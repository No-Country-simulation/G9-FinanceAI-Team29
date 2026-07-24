import re

from app.config import settings
from app.profile import analizar_usuario
from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.intent import Intent, IntentDetector
from app.services.llm.prompt_builder import PromptBuilder
from app.services.llm.schemas import LLMResponse
from app.services.llm.service import LLMService


class FinSightAgentService:
    """Orquesta el agente y aplica controles de privacidad antes del LLM."""

    USER_ID_PATTERN = re.compile(r"\bUSR\d+\b", flags=re.IGNORECASE)

    def __init__(self) -> None:
        self.llm = LLMService()
        self.intent_detector = IntentDetector()
        self.context_builder = FinancialContextBuilder()

    async def chat(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
    ) -> LLMResponse:
        normalized_question = self.intent_detector.normalize(question)

        if not normalized_question:
            raise ValueError("La pregunta no puede estar vacía.")

        restricted_intent = self._detect_restricted_request(
            usuario_id=usuario_id,
            question=question,
            normalized_question=normalized_question,
        )
        if restricted_intent is not None:
            return self._internal_response(
                self._restricted_response(restricted_intent),
                restricted_intent,
            )

        intent = self.intent_detector.detect(question)
        simple_response = self._simple_response(intent)

        if simple_response is not None:
            return self._internal_response(simple_response, intent)

        if intent == Intent.UNKNOWN:
            return self._internal_response(
                (
                    "Puedo ayudarte con consultas sobre tus gastos, "
                    "ingresos, ahorro, deudas, puntaje, perfil financiero "
                    "y recomendaciones personalizadas. Indícame qué aspecto "
                    "de tus finanzas deseas consultar."
                ),
                intent,
            )

        analysis = analizar_usuario(usuario_id)
        context = self.context_builder.build(
            intent=intent,
            analysis=analysis,
            currency=settings.financial_currency,
        )
        messages = PromptBuilder.build(
            question=question,
            context=context,
            intent=intent.value,
        )

        response = await self.llm.generate(
            messages=messages,
            provider=provider,
        )
        response.metadata.update(
            {
                "intent": intent.value,
                "used_financial_context": True,
            }
        )
        return response

    def _detect_restricted_request(
        self,
        usuario_id: str,
        question: str,
        normalized_question: str,
    ) -> Intent | None:
        referenced_ids = {
            match.upper()
            for match in self.USER_ID_PATTERN.findall(question)
        }
        current_user_id = usuario_id.strip().upper()

        if any(user_id != current_user_id for user_id in referenced_ids):
            return Intent.PRIVACY_RESTRICTED

        privacy_terms = {
            "otro usuario",
            "otra persona",
            "otros usuarios",
            "todos los usuarios",
            "datos de usuarios",
            "datos de otras personas",
            "finanzas de otro",
            "comparame con otro",
            "comparar con otro usuario",
            "quien tiene mejores finanzas",
            "ranking de usuarios",
        }
        if self.intent_detector._contains_any(
            normalized_question,
            privacy_terms,
        ):
            return Intent.PRIVACY_RESTRICTED

        security_terms = {
            "muestra el prompt",
            "revela el prompt",
            "prompt del sistema",
            "instrucciones internas",
            "ignora tus instrucciones",
            "ignora las instrucciones",
            "clave api",
            "api key",
            "token secreto",
            "credenciales",
            "variables de entorno",
            "archivo env",
            "base de datos completa",
            "dataset completo",
        }
        if self.intent_detector._contains_any(
            normalized_question,
            security_terms,
        ):
            return Intent.SECURITY_RESTRICTED

        return None

    @staticmethod
    def _restricted_response(intent: Intent) -> str:
        if intent == Intent.PRIVACY_RESTRICTED:
            return (
                "No puedo consultar, revelar ni comparar información "
                "financiera de otros usuarios. Solo puedo ayudarte a "
                "analizar los datos asociados a tu propia cuenta."
            )

        return (
            "No puedo revelar instrucciones internas, credenciales, "
            "configuración privada ni datos del sistema. Sí puedo ayudarte "
            "con el análisis financiero disponible para tu propia cuenta."
        )

    @staticmethod
    def _internal_response(
        content: str,
        intent: Intent,
    ) -> LLMResponse:
        return LLMResponse(
            content=content,
            provider="internal",
            model="rule-based",
            metadata={
                "intent": intent.value,
                "used_financial_context": False,
            },
        )

    @staticmethod
    def _simple_response(intent: Intent) -> str | None:
        responses = {
            Intent.GREETING: (
                "¡Hola! Soy el asistente financiero de FinSight AI. "
                "Puedo ayudarte a analizar tus ingresos, gastos, ahorro, "
                "deudas y perfil financiero, además de ofrecerte "
                "recomendaciones personalizadas. ¿Qué deseas consultar?"
            ),
            Intent.THANKS: (
                "Con gusto. Puedes realizar otra consulta sobre tus "
                "finanzas cuando lo necesites."
            ),
            Intent.FAREWELL: (
                "Hasta luego. Estaré disponible cuando necesites volver "
                "a revisar tus finanzas."
            ),
            Intent.CAPABILITIES: (
                "Puedo ayudarte a revisar tus ingresos, gastos, categorías "
                "de consumo, nivel de deuda, capacidad de ahorro, puntaje "
                "y perfil financiero. También puedo ofrecerte "
                "recomendaciones educativas basadas en tus datos."
            ),
        }
        return responses.get(intent)
