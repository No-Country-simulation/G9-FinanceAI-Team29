import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from app import profile as profile_data
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

    _RECENT_EXPENSES_DEFAULT_LIMIT = 5
    _RECENT_EXPENSES_MAX_LIMIT = 10

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
        previous_answer: str | None = None,
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

        if previous_answer and self._is_follow_up(query.corrected):
            messages = PromptBuilder.build_follow_up(
                question=query.original,
                previous_answer=previous_answer,
            )
            response = await self.llm.generate(messages=messages, provider=provider)
            response.metadata.update(
                {
                    "intent": "follow_up",
                    "route": "llm_follow_up",
                    "used_financial_context": True,
                    "corrections_count": len(query.corrections),
                }
            )
            return response

        intent_result = self.intent_detector.detect_result(query.corrected)

        print("PREGUNTA ORIGINAL:", query.original)
        print("PREGUNTA CORREGIDA:", query.corrected)
        print("CORRECCIONES:", query.corrections)
        print("INTENT DETECTADO:", intent_result.intent)
        print("MODO DETECTADO:", intent_result.mode)

        # Se resuelve antes del router porque RECENT_EXPENSES necesita acceder
        # a las transacciones y el router original todavía no conoce este intent.
        if intent_result.intent == Intent.RECENT_EXPENSES:
            limit = self._extract_recent_expenses_limit(query.corrected)
            content = self._recent_expenses_response(
                usuario_id=usuario_id,
                limit=limit,
            )
            return self._internal_response(
                content,
                intent_result.intent,
                query,
                used_financial_context=True,
            )

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

    @classmethod
    def _recent_expenses_response(
        cls,
        usuario_id: str,
        limit: int,
    ) -> str:
        """Devuelve los gastos más recientes del usuario, ordenados por fecha."""
        profile_data._ensure_resources_loaded()
        transactions = profile_data.transacciones

        if transactions is None:
            return "No pude acceder a tus transacciones en este momento."

        user_transactions = transactions[
            transactions["usuario_id"].astype(str) == str(usuario_id)
        ].copy()

        if "tipo" in user_transactions.columns:
            user_transactions = user_transactions[
                user_transactions["tipo"]
                .astype(str)
                .str.strip()
                .str.upper()
                .eq("GASTO")
            ]

        if user_transactions.empty:
            return "No encontré gastos registrados para tu cuenta."

        if "fecha" in user_transactions.columns:
            # errors="coerce" evita que una fecha inválida rompa la consulta.
            user_transactions["_fecha_orden"] = profile_data.pd.to_datetime(
                user_transactions["fecha"],
                errors="coerce",
            )
            user_transactions = user_transactions.sort_values(
                by="_fecha_orden",
                ascending=False,
                na_position="last",
            )

        recent = user_transactions.head(limit)
        actual_count = len(recent)
        title = (
            f"Tus últimos {actual_count} gastos registrados fueron:"
            if actual_count != 1
            else "Tu último gasto registrado fue:"
        )
        lines = [title]

        for position, (_, expense) in enumerate(recent.iterrows(), start=1):
            description = cls._first_available_text(
                expense,
                "descripcion",
                "categoria",
                default="Gasto",
            )
            category = cls._first_available_text(
                expense,
                "categoria",
                default="",
            )
            amount = cls._format_money(expense.get("monto", 0))
            date = cls._format_date(expense.get("fecha"))

            details = description
            if category and category.casefold() != description.casefold():
                details = f"{description} ({category})"

            date_suffix = f" — {date}" if date else ""
            lines.append(
                f"{position}. {details} — {amount}{date_suffix}"
            )

        return "\n".join(lines)

    @classmethod
    def _extract_recent_expenses_limit(cls, question: str) -> int:
        """Extrae 5 o 10 de la consulta; usa 5 cuando no se especifica."""
        normalized = QueryNormalizer.normalize(question)
        match = re.search(r"(?<!\d)(\d{1,2})(?!\d)", normalized)

        if not match:
            return cls._RECENT_EXPENSES_DEFAULT_LIMIT

        requested = int(match.group(1))
        return max(1, min(requested, cls._RECENT_EXPENSES_MAX_LIMIT))

    @staticmethod
    def _first_available_text(
        row: Any,
        *keys: str,
        default: str,
    ) -> str:
        for key in keys:
            value = row.get(key)
            if value is not None:
                text = str(value).strip()
                if text and text.casefold() != "nan":
                    return text
        return default

    @staticmethod
    def _format_date(value: Any) -> str:
        if value is None:
            return ""

        try:
            parsed = profile_data.pd.to_datetime(value, errors="coerce")
        except (TypeError, ValueError):
            return ""

        if profile_data.pd.isna(parsed):
            return ""

        return parsed.strftime("%d/%m/%Y")

    @classmethod
    def _format_money(cls, value: Any) -> str:
        """Formatea importes con símbolo $ y convención es-AR."""
        try:
            rounded = Decimal(str(value)).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
        except (InvalidOperation, ValueError, TypeError):
            rounded = Decimal("0.00")

        english = f"{rounded:,.2f}"
        localized = (
            english.replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )
        return f"${localized}"

    @classmethod
    def _localize_currency(cls, content: str) -> str:
        """Convierte respuestas internas como 'USD 2790.94' a '$2.790,94'."""
        pattern = re.compile(
            r"\b(?:USD|US\$)\s*(-?\d+(?:[.,]\d{1,2})?)\b",
            re.IGNORECASE,
        )

        def replace(match: re.Match[str]) -> str:
            raw_value = match.group(1)
            # Las respuestas determinísticas actuales usan punto decimal.
            normalized = raw_value.replace(",", ".")
            return cls._format_money(normalized)

        return pattern.sub(replace, content)

    @staticmethod
    def _is_follow_up(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question)
        follow_up_terms = (
            "explicamelo",
            "explicalo",
            "explicame eso",
            "mas sencillo",
            "mas simple",
            "en palabras sencillas",
            "en palabras simples",
            "no entendi",
            "que significa eso",
            "resumilo",
            "resumimelo",
            "por que",
        )
        return any(term in normalized for term in follow_up_terms)

    @staticmethod
    def _prepare_query(question: str) -> NormalizedQuery:
        normalized = QueryNormalizer.normalize(question)
        if not normalized:
            raise ValueError("La pregunta no puede estar vacía.")
        return FinancialSpellCorrector.process(question, normalized)

    @classmethod
    def _internal_response(
        cls,
        content: str,
        intent: Intent,
        query: NormalizedQuery,
        used_financial_context: bool = False,
    ) -> LLMResponse:
        return LLMResponse(
            content=cls._localize_currency(content),
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
            Intent.CREATOR_INFO: (
                "Fui creado por TwentyNineDevs, el equipo que desarrolló FinSightAI "
                "para ayudar a las personas a comprender y gestionar mejor sus finanzas."
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