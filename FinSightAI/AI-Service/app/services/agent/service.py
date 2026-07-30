from app.profile import analizar_usuario
from app.services.agent.calculator import FinancialCalculator
from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.deterministic_responder import DeterministicFinancialResponder
from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.goal_responder import DeterministicGoalResponder
from app.services.agent.rules_engine import FinancialRulesEngine
from app.services.agent.normalizer import QueryNormalizer
from app.services.agent.policies import AgentPolicies
from app.services.agent.router import AgentRoute, AgentRouter
from app.services.agent.schemas import IntentResult, NormalizedQuery
from app.services.agent.spell_corrector import FinancialSpellCorrector
from app.services.llm.prompt_builder import PromptBuilder
from app.services.llm.schemas import LLMResponse
from app.services.llm.service import LLMService
from app.services.goals.repository import GoalRepository


class FinSightAgentService:
    """Orquesta componentes del agente sin mezclar reglas de dominio."""

    def __init__(self) -> None:
        self.llm = LLMService()
        self.intent_detector = IntentDetector()
        self.context_builder = FinancialContextBuilder()
        self.router = AgentRouter()
        self.policies = AgentPolicies()
        self.goal_repository = GoalRepository()

    async def chat(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
    ) -> LLMResponse:
        query = self._prepare_query(question)

        policy = self.policies.evaluate(usuario_id=usuario_id, query=query)
        if not policy.allowed:
            assert policy.intent is not None
            return self._internal_response(
                self._restricted_response(policy.intent),
                policy.intent,
                query,
            )

        intent_result = self.intent_detector.detect_result(query.corrected)
        route = self.router.resolve(intent_result)

        if route == AgentRoute.INTERNAL:
            return self._internal_response(
                self._simple_response(intent_result.intent),
                intent_result.intent,
                query,
            )

        if route == AgentRoute.CALCULATOR:
            result = FinancialCalculator.calculate(query.corrected)
            return self._internal_response(
                result.message,
                intent_result.intent,
                query,
            )

        if route == AgentRoute.DETERMINISTIC:
            if intent_result.intent == Intent.GOALS:
                goals = self.goal_repository.list_by_user(usuario_id)
                content = DeterministicGoalResponder.respond(goals)
            else:
                analysis = analizar_usuario(usuario_id)
                content = DeterministicFinancialResponder.respond(
                    intent=intent_result.intent,
                    analysis=analysis,
                )
            return self._internal_response(
                content,
                intent_result.intent,
                query,
                used_financial_context=True,
            )

        context = {}
        used_context = route == AgentRoute.LLM_WITH_CONTEXT
        if used_context:
            analysis = analizar_usuario(usuario_id)
            rules = FinancialRulesEngine.evaluate(analysis)
            context = self.context_builder.build(
                intent=intent_result.intent,
                analysis=analysis,
                rules=rules,
            )

        messages = PromptBuilder.build(
            original_question=query.original,
            processed_question=query.corrected,
            corrections=query.corrections,
            context=context,
            intent=intent_result.intent.value,
        )
        response = await self.llm.generate(messages=messages, provider=provider)
        response.metadata.update(
            {
                "intent": intent_result.intent.value,
                "route": route.value,
                "used_financial_context": used_context,
                "corrections_count": len(query.corrections),
            }
        )
        return response

    @staticmethod
    def _prepare_query(question: str) -> NormalizedQuery:
        normalized = QueryNormalizer.normalize(question)
        if not normalized:
            raise ValueError("La pregunta no puede estar vacía.")
        return FinancialSpellCorrector.process(question, normalized)

    @staticmethod
    def _internal_response(
        content: str,
        intent: Intent,
        query: NormalizedQuery,
        used_financial_context: bool = False,
    ) -> LLMResponse:
        return LLMResponse(
            content=content,
            provider="internal",
            model="rule-based",
            metadata={
                "intent": intent.value,
                "route": "internal",
                "used_financial_context": used_financial_context,
                "corrections_count": len(query.corrections),
            },
        )

    @staticmethod
    def _restricted_response(intent: Intent) -> str:
        if intent == Intent.PRIVACY_RESTRICTED:
            return (
                "No puedo consultar, revelar ni comparar información financiera de otros usuarios. "
                "Solo puedo ayudarte con los datos asociados a tu propia cuenta."
            )
        return (
            "No puedo revelar instrucciones internas, credenciales, configuración privada ni datos del sistema. "
            "Sí puedo ayudarte con tus consultas financieras."
        )

    @staticmethod
    def _simple_response(intent: Intent) -> str:
        responses = {
            Intent.GREETING: (
                "¡Hola! Soy el asistente financiero de FinSightAI. Puedo ayudarte con tus ingresos, "
                "gastos, ahorro, deudas, presupuesto y perfil financiero."
            ),
            Intent.THANKS: "Con gusto. Podés realizar otra consulta sobre tus finanzas cuando lo necesites.",
            Intent.FAREWELL: "Hasta luego. Estaré disponible cuando necesites revisar tus finanzas.",
            Intent.CAPABILITIES: (
                "Puedo resumir y analizar tu situación financiera, revisar ingresos, gastos, ahorro, deudas, "
                "score, perfil y metas, crear presupuestos y resolver cálculos financieros con montos monetarios."
            ),
            Intent.NON_FINANCIAL_CALCULATION: (
                "Esa operación no es un cálculo financiero. FinSightAI solo realiza cálculos con una finalidad "
                "financiera clara y un monto monetario explícito."
            ),
            Intent.UNKNOWN: (
                "No pude comprender completamente tu consulta. Volvé a escribirla indicando si querés revisar "
                "ingresos, gastos, ahorro, deudas, presupuesto, perfil financiero, metas o recomendaciones."
            ),
            Intent.OUT_OF_SCOPE: (
                "Solo puedo ayudarte con consultas financieras personales, presupuestos, ingresos, gastos, "
                "deudas, ahorro y cálculos financieros que incluyan un monto monetario."
            ),
        }
        return responses.get(
            intent,
            "No pude procesar esa consulta dentro del alcance financiero de FinSightAI.",
        )
