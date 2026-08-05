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
from app.services.agent.easter_eggs import EasterEggResponder
from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.goal_responder import DeterministicGoalResponder
from app.services.agent.rules_engine import FinancialRulesEngine
from app.services.agent.normalizer import QueryNormalizer
from app.services.agent.recommendation_advisor import RecommendationAdvisor
from app.services.agent.policies import AgentPolicies
from app.services.agent.router import AgentRoute, AgentRouter
from app.services.agent.schemas import IntentResult, NormalizedQuery
from app.services.agent.spell_corrector import FinancialSpellCorrector
from app.services.llm.prompt_builder import PromptBuilder
from app.services.llm.schemas import LLMResponse
from app.services.llm.service import LLMService
from app.services.goals.repository import GoalRepository
from app.services.support import SupportAgent, SupportIntentDetector
from app.services.support.product_knowledge import ProductKnowledgeResponder
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
        easter_egg = EasterEggResponder.match(question)
        if easter_egg is not None:
            # Respuesta temprana: no pasa por intents, soporte, consultas,
            # políticas ni LLM. Si había contexto financiero, conserva solo
            # su marcador oculto para no alterar un seguimiento posterior.
            preserved_context = self._financial_context_marker(previous_answer)
            content = easter_egg.response
            if preserved_context:
                content = f"{content}\n\n{preserved_context}"
            return LLMResponse(
                content=content,
                provider="internal",
                model="easter-egg",
                metadata={
                    "intent": "easter_egg",
                    "route": f"easter_egg_{easter_egg.key}",
                    "easter_egg": easter_egg.key,
                    "used_financial_context": False,
                    "save_history": False,
                    "update_context": False,
                },
            )

        preserved_context = self._financial_context_marker(previous_answer)
        if preserved_context and self._is_context_noise(question):
            return LLMResponse(
                content=(
                    "No pude interpretar ese mensaje. Puedes continuar con la consulta financiera anterior "
                    "o escribir una nueva pregunta.\n\n"
                    + preserved_context
                ),
                provider="internal",
                model="financial-context-guard",
                metadata={
                    "intent": "context_noise",
                    "route": "financial_context_preserved",
                    "used_financial_context": True,
                },
            )

        query = self._prepare_query(question)

        # Los mensajes originados en una tarjeta de recomendación ya incluyen
        # diagnóstico, acción y objetivo verificados. Deben continuar por el
        # flujo de asesoramiento, sin pasar por el clasificador transaccional
        # general (que podría confundir palabras como "movimientos" o "gastos"
        # con una solicitud de resumen).
        if self._is_recommendation_context(question):
            content = self._recommendation_context_response(question)
            response = self._internal_response(
                content,
                Intent.RECOMMENDATIONS,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "recommendation_context"
            response.metadata["recommendation_origin"] = True
            return response

        # Los reportes de seguridad, datos ajenos o errores técnicos críticos
        # deben ir a soporte antes de cualquier interpretación financiera.
        if SupportIntentDetector.is_critical_support_query(query.original):
            return await self.support_agent.answer(
                usuario_id=usuario_id,
                question=query.original,
                provider=provider,
                previous_answer=previous_answer,
            )

        # Una frase que describe un fallo debe ir al diagnóstico guiado.
        # Product Knowledge queda reservado para preguntas informativas.
        explicit_support_query = SupportIntentDetector.is_support_query(query.original)

        # Las consultas informativas sobre funciones reales de FinSightAI se
        # resuelven antes de los intents financieros y antes de UNKNOWN.
        product_knowledge = (
            None
            if explicit_support_query
            else ProductKnowledgeResponder.answer(query.original)
        )
        if product_knowledge is not None:
            return LLMResponse(
                content=product_knowledge.content,
                provider="internal",
                model="support-product-knowledge",
                metadata={
                    "intent": "product_knowledge",
                    "route": product_knowledge.route,
                    "topic": product_knowledge.topic,
                    "used_financial_context": False,
                    "corrections_count": len(query.corrections),
                },
            )

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

        # Las intenciones conversacionales globales tienen prioridad sobre el
        # soporte. Esto evita que preguntas como "¿qué puedes hacer?" sean
        # interpretadas como continuación de un diagnóstico técnico solo porque
        # la respuesta anterior mencionó que el asistente puede ayudar.
        early_intent = self.intent_detector.detect_result(query.corrected)
        if early_intent.intent in {
            Intent.GREETING,
            Intent.THANKS,
            Intent.FAREWELL,
            Intent.CAPABILITIES,
            Intent.CREATOR_INFO,
            Intent.NON_FINANCIAL_CALCULATION,
        }:
            return self._internal_response(
                self._simple_response(early_intent.intent),
                early_intent.intent,
                query,
            )

        # El soporte se evalúa antes de las políticas financieras para que las
        # consultas sobre el uso de FinSightAI no sean tratadas como fuera de alcance.
        # El flujo financiero existente permanece intacto para el resto.
        support_follow_up = SupportIntentDetector.is_support_follow_up(
            query.original, previous_answer
        )
        if explicit_support_query or (
            support_follow_up
            and early_intent.intent != Intent.FINANCIAL_EDUCATION
            and not (is_contextual_financial_follow_up or is_financial_query)
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
            # Evita que el contexto de una recomendación previa altere
            # consultas transaccionales explícitas.
            # Una consulta explícita contiene su propia intención ("cuánto gasté",
            # "cuánto ingresé", "qué compré", etc.) y no debe heredar el contexto
            # anterior, aunque también mencione un mes. En cambio, una consulta
            # elíptica como "¿y el mes anterior?" sí necesita previous_answer.
            explicit_transaction_query = self._is_explicit_transaction_query(
                query.corrected
            )

            transaction_previous_answer = (
                None
                if explicit_transaction_query
                else previous_answer
                if is_contextual_financial_follow_up
                else previous_answer
            )

            transaction_answer = TransactionQueryEngine.answer(
                query.corrected,
                transactions,
                user_name=user_name,
                analysis=analysis_for_query,
                previous_answer=transaction_previous_answer,
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
    def _is_recommendation_context(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question)
        markers = (
            "continua desde esta recomendacion",
            "vengo de esta recomendacion",
            "perfil financiero",
            "diagnostico",
            "accion sugerida",
            "objetivo",
        )
        strong_marker = any(
            marker in normalized
            for marker in (
                "continua desde esta recomendacion",
                "vengo de esta recomendacion",
            )
        )
        structured_fields = sum(marker in normalized for marker in markers[2:])
        return strong_marker or structured_fields >= 3

    @classmethod
    def _recommendation_context_response(cls, question: str) -> str:
        fields = cls._extract_recommendation_fields(question)
        return RecommendationAdvisor.build(fields)

    @staticmethod
    def _extract_recommendation_fields(question: str) -> dict[str, str]:
        labels = {
            "perfil financiero": "perfil financiero",
            "diagnostico": "diagnostico",
            "acción sugerida": "accion sugerida",
            "accion sugerida": "accion sugerida",
            "objetivo": "objetivo",
        }
        result: dict[str, str] = {}
        for raw_line in question.splitlines():
            line = raw_line.strip()
            if not line or ":" not in line:
                continue
            raw_label, value = line.split(":", 1)
            normalized_label = QueryNormalizer.normalize(raw_label)
            canonical = labels.get(normalized_label)
            if canonical and value.strip():
                result[canonical] = value.strip()
        return result

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
    def _is_explicit_transaction_query(question: str) -> bool:
        """Detecta consultas que expresan por sí solas gasto o ingreso.

        No considera explícitas expresiones elípticas como "¿y el mes anterior?",
        porque esas sí necesitan la respuesta previa para conservar el tipo de
        movimiento consultado.
        """
        normalized = QueryNormalizer.normalize(question)

        expense_patterns = (
            r"\bcuanto\s+(?:gaste|gasto|pague)\b",
            r"\bque\s+(?:gaste|compre|pague)\b",
            r"\ben\s+que\s+gaste\b",
            r"\btotal\s+de\s+gastos\b",
            r"\bgastos?\s+(?:de|del|en|este|esta)\b",
        )
        income_patterns = (
            r"\bcuanto\s+(?:ingrese|cobre|gane)\b",
            r"\bque\s+(?:ingrese|cobre)\b",
            r"\btotal\s+de\s+ingresos\b",
            r"\bingresos?\s+(?:de|del|en|este|esta)\b",
        )

        return any(
            re.search(pattern, normalized)
            for pattern in expense_patterns + income_patterns
        )

    @staticmethod
    def _financial_context_marker(previous_answer: str | None) -> str | None:
        if not previous_answer:
            return None
        match = re.search(
            r"<!--\s*finsi-financial-context\s+metric=(?:income|expense|unknown)\s+"
            r"granularity=(?:year|month|rank|other)\s+year=(?:\d{4}|none)\s+"
            r"month=(?:\d{1,2}|none)\s+position=(?:\d+|none)\s*-->",
            previous_answer,
            flags=re.IGNORECASE,
        )
        return match.group(0) if match else None

    @staticmethod
    def _is_context_noise(question: str) -> bool:
        raw = (question or "").strip().casefold()
        if raw in {"v", "ok", "oki", "okay", "dale", "mmm", "mm", "eh", "👍", "👎", "👌"}:
            return True
        if raw and all(char in ".,!?¿¡…-_~" for char in raw):
            return True
        return False

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
            Intent.THANKS: "Con gusto. Puedes realizar otra consulta sobre tus finanzas cuando lo necesites.",
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
                "No pude comprender completamente tu consulta. Vuelve a escribirla indicando si quieres revisar "
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