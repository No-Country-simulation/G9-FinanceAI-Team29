import re
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
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
from app.services.support import SupportAgent, SupportIntentDetector
from app.services.agent.transaction_queries import TransactionQueryEngine
from app.services.backend_financial_data import (
    BackendDataError,
    fetch_live_analysis,
    fetch_user_transactions,
    fetch_user_profile,
)


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
        self.support_agent = SupportAgent(llm=self.llm)

    async def chat(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
        previous_answer: str | None = None,
        time_zone: str | None = None,
    ) -> LLMResponse:
        query = self._prepare_query(question)
        local_today = self._today_for_time_zone(time_zone)
        is_contextual_date_follow_up = TransactionQueryEngine.is_contextual_date_follow_up(
            query.corrected, previous_answer
        )
        is_contextual_month_follow_up = TransactionQueryEngine.is_contextual_month_follow_up(
            query.corrected, previous_answer
        )
        is_contextual_financial_follow_up = (
            is_contextual_date_follow_up or is_contextual_month_follow_up
        )
        is_financial_query = TransactionQueryEngine.is_financial_query_candidate(
            query.corrected,
            previous_answer,
        )
        is_general_financial_knowledge = self._is_general_financial_knowledge_query(
            query.corrected
        )

        # Las intenciones conversacionales globales tienen prioridad sobre el
        # soporte. Esto evita que preguntas como "¿qué podés hacer?" sean
        # interpretadas como continuación de un diagnóstico técnico solo porque
        # la respuesta anterior mencionó que el asistente puede ayudar.
        early_intent = self.intent_detector.detect_result(query.corrected)
        if early_intent.intent in {
            Intent.GREETING,
            Intent.THANKS,
            Intent.FAREWELL,
            Intent.CAPABILITIES,
            Intent.CREATOR_INFO,
        }:
            return self._internal_response(
                self._simple_response(early_intent.intent),
                early_intent.intent,
                query,
            )

        # El soporte se evalúa antes de las políticas financieras para que las
        # consultas sobre el uso de FinSightAI no sean tratadas como fuera de alcance.
        # El flujo financiero existente permanece intacto para el resto.
        if not (
            is_contextual_financial_follow_up
            or is_financial_query
            or is_general_financial_knowledge
        ) and (
            SupportIntentDetector.is_support_query(query.original)
            or SupportIntentDetector.is_support_follow_up(
                query.original, previous_answer
            )
        ):
            return await self.support_agent.answer(
               usuario_id=usuario_id,
               question=query.original,
               provider=provider,
               previous_answer=previous_answer,
        )

        policy = self.policies.evaluate(usuario_id=usuario_id, query=query)
        if not policy.allowed:
            assert policy.intent is not None
            return self._internal_response(
                self._restricted_response(policy.intent),
                policy.intent,
                query,
            )

        # Las preguntas educativas sobre conceptos financieros no son incidentes
        # técnicos. Se responden con el LLM sin cargar datos personales.
        if is_general_financial_knowledge:
            messages = PromptBuilder.build(
                original_question=query.original,
                processed_question=query.corrected,
                corrections=query.corrections,
                context={},
                intent="financial_education",
            )
            response = await self.llm.generate(messages=messages, provider=provider)
            response.metadata.update(
                {
                    "intent": "financial_education",
                    "route": "llm_without_context",
                    "used_financial_context": False,
                    "corrections_count": len(query.corrections),
                }
            )
            return response

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

        # Consultas transaccionales específicas: totales por período, máximos,
        # categorías, comparaciones, insights, predicciones y acciones. Se
        # resuelven antes del intent genérico para no devolver siempre promedios.
        try:
            transactions = fetch_user_transactions(usuario_id)
            try:
                analysis_for_query = fetch_live_analysis(usuario_id)
            except (BackendDataError, ValueError):
                analysis_for_query = None
            try:
                profile = fetch_user_profile(usuario_id)
                user_name = str(profile.get("nombre") or "").strip() or None
            except (BackendDataError, ValueError):
                user_name = None
            transaction_answer = TransactionQueryEngine.answer(
                query.corrected,
                transactions,
                user_name=user_name,
                analysis=analysis_for_query,
                previous_answer=previous_answer,
                today=local_today,
            )
            if transaction_answer is not None:
                response = self._internal_response(
                    transaction_answer.content,
                    intent_result.intent,
                    query,
                    used_financial_context=True,
                )
                response.metadata["transaction_action"] = transaction_answer.action
                return response
        except (BackendDataError, ValueError):
            # Conserva el flujo anterior y el respaldo CSV si Spring no responde.
            pass

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
                analysis = self._get_analysis(usuario_id)
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
            analysis = self._get_analysis(usuario_id)
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
    def _is_general_financial_knowledge_query(question: str) -> bool:
        """Detecta definiciones financieras que deben ir al LLM, no a soporte."""
        normalized = QueryNormalizer.normalize(question)
        if not normalized:
            return False

        definition_patterns = (
            r"^(?:que|cual)\s+(?:es|son|significa|significan)\b",
            r"^(?:como funciona|como funcionan|como se usa|como se usan)\b",
            r"^(?:para que sirve|para que sirven|como se calcula|como se calculan)\b",
            r"^(?:en que consiste|en que consisten)\b",
            r"^(?:explicame|explica|definime|defini|dame una definicion de)\b",
        )
        if not any(re.search(pattern, normalized) for pattern in definition_patterns):
            return False

        financial_concepts = (
            "pib",
            "producto interno bruto",
            "pbi",
            "producto bruto interno",
            "inflacion",
            "deflacion",
            "ipc",
            "indice de precios al consumidor",
            "tasa de interes",
            "interes simple",
            "interes compuesto",
            "credito",
            "tarjeta de credito",
            "prestamo",
            "hipoteca",
            "presupuesto",
            "ahorro",
            "inversion",
            "accion",
            "acciones",
            "bono",
            "bonos",
            "etf",
            "fondo de inversion",
            "fondo comun",
            "riesgo financiero",
            "diversificacion",
            "deuda",
            "score crediticio",
            "tipo de cambio",
            "recesion",
            "liquidez",
            "rentabilidad",
            "patrimonio",
            "capital",
            "impuesto",
            "iva",
            "ganancias",
            "mercado financiero",
            "mercado de capitales",
            "dividendo",
            "dividendos",
            "interes",
            "moneda",
            "tipo de interes",
            "tasa nominal",
            "tasa efectiva",
            "costo financiero total",
            "cft",
            "plazo fijo",
            "cuenta corriente",
            "caja de ahorro",
        )
        return any(concept in normalized for concept in financial_concepts)

    @staticmethod
    def _today_for_time_zone(time_zone: str | None) -> date:
        """Devuelve la fecha local del navegador; usa UTC si la zona es inválida."""
        try:
            zone = ZoneInfo(time_zone or "UTC")
        except (ZoneInfoNotFoundError, ValueError, TypeError):
            zone = ZoneInfo("UTC")
        return datetime.now(zone).date()

    @staticmethod
    def _get_analysis(usuario_id: str) -> dict:
        """Usa Spring para usuarios reales y CSV sólo como respaldo demo."""
        try:
            return fetch_live_analysis(usuario_id)
        except BackendDataError:
            return analizar_usuario(usuario_id)

    @classmethod
    def _recent_expenses_response(
        cls,
        usuario_id: str,
        limit: int,
    ) -> str:
        """Devuelve los gastos más recientes del usuario, ordenados por fecha."""
        try:
            live_transactions = fetch_user_transactions(usuario_id)
            user_transactions = profile_data.pd.DataFrame(live_transactions)
        except BackendDataError:
            # Respaldo para las cuentas demo cuando Spring no está levantado.
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