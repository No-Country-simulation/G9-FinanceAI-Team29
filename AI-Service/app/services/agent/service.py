import re
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from app import profile as profile_data
from app.profile import analizar_usuario
from app.prediction import diagnosticar_descripcion
from app.services.agent.calculator import FinancialCalculator
from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.deterministic_responder import DeterministicFinancialResponder
from app.services.agent.easter_eggs import EasterEggResponder
from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.goal_responder import DeterministicGoalResponder
from app.services.agent.goal_advisor import GoalAdvisor
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
        assistant_mode: str | None = None,
    ) -> LLMResponse:
        # El selector de "modelo" del composer puede forzar el flujo de
        # soporte directamente, sin pasar por la detección de intención
        # financiera. Los easter eggs, el filtro de seguridad y las
        # respuestas sociales rápidas siguen teniendo prioridad.
        if self._is_support_mode(assistant_mode):
            security_refusal = self._security_refusal_response(question)
            if security_refusal is not None:
                return LLMResponse(
                    content=security_refusal,
                    provider="internal",
                    model="security-rules",
                    metadata={
                        "intent": "security_refusal",
                        "route": "security_account_access_refusal",
                        "used_financial_context": False,
                        "save_history": True,
                        "update_context": False,
                    },
                )

            easter_egg = EasterEggResponder.match(question)
            if easter_egg is not None:
                return LLMResponse(
                    content=easter_egg.response,
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

            query = self._prepare_query(question)

            # Si el usuario eligió explícitamente "Soporte técnico", las consultas
            # financieras no deben caer en un "no entendí" del agente de soporte.
            # Se reconocen y se deriva al selector correcto sin consultar datos
            # financieros ni llamar innecesariamente al LLM de soporte.
            support_mode_intent = self.intent_detector.detect_result(query.corrected)
            financial_mode_intents = {
                Intent.INCOME,
                Intent.EXPENSES,
                Intent.DEBT,
                Intent.SAVINGS,
                Intent.SCORE,
                Intent.PROFILE,
                Intent.RECOMMENDATIONS,
                Intent.FULL_ANALYSIS,
                Intent.BUDGET,
                Intent.SUMMARY,
                Intent.RECENT_EXPENSES,
                Intent.GOALS,
                Intent.FINANCIAL_EDUCATION,
            }
            is_financial_in_support_mode = (
                support_mode_intent.intent in financial_mode_intents
                or self._is_direct_goal_query(query.corrected)
                or TransactionQueryEngine.is_financial_query_candidate(
                    query.corrected,
                    previous_answer,
                )
            )

            if is_financial_in_support_mode:
                return LLMResponse(
                    content=(
                        "Para preguntas financieras, en el selector de abajo selecciona "
                        "**FinSightAI Advisor**."
                    ),
                    provider="internal",
                    model="assistant-mode-router",
                    metadata={
                        "intent": support_mode_intent.intent.value,
                        "route": "support_mode_financial_redirect",
                        "used_financial_context": False,
                        "save_history": True,
                        "update_context": False,
                    },
                )

            return await self.support_agent.answer(
                usuario_id=usuario_id,
                question=query.original,
                provider=provider,
                previous_answer=previous_answer,
            )

        security_refusal = self._security_refusal_response(question)
        if security_refusal is not None:
            return LLMResponse(
                content=security_refusal,
                provider="internal",
                model="security-rules",
                metadata={
                    "intent": "security_refusal",
                    "route": "security_account_access_refusal",
                    "used_financial_context": False,
                    "save_history": True,
                    "update_context": False,
                },
            )

        quick_social = self._quick_social_response(question)
        if quick_social is not None:
            return LLMResponse(
                content=quick_social,
                provider="internal",
                model="conversation-rules",
                metadata={
                    "intent": "conversation",
                    "route": "conversation_quick_response",
                    "used_financial_context": False,
                    "save_history": True,
                    "update_context": False,
                },
            )

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

        # "Explícame más" debe ampliar SIEMPRE la respuesta anterior antes de
        # pasar por el router Advisor/Soporte. De lo contrario, los detectores
        # amplios de soporte pueden interpretar el follow-up como una consulta
        # técnica y derivarlo al agente equivocado.
        normalized_follow_up = QueryNormalizer.normalize(query.corrected).strip()
        explicit_expand_follow_ups = {
            "explicame mas",
            "explica mas",
            "amplia",
            "amplia eso",
            "ampliame",
            "ampliame eso",
            "dame mas detalles",
            "mas detalles",
            "profundiza",
            "profundiza mas",
            "quiero saber mas",
            "contame mas",
            "cuentame mas",
        }
        if previous_answer and normalized_follow_up in explicit_expand_follow_ups:
            messages = PromptBuilder.build_follow_up(
                question=query.original,
                previous_answer=previous_answer,
            )
            response = await self.llm.generate(messages=messages, provider=provider)
            response.metadata.update(
                {
                    "intent": "follow_up",
                    "route": "llm_follow_up_expand",
                    "used_financial_context": True,
                    "corrections_count": len(query.corrections),
                }
            )
            return response

        # Si ya estamos dentro del flujo de creación de una meta, continuarlo
        # antes del aislamiento Advisor/Soporte. Respuestas cortas como "sí",
        # un monto o una fecha dependen de la respuesta anterior y no deben
        # reclasificarse como una consulta nueva.
        previous_goal_context = QueryNormalizer.normalize(previous_answer or "")
        has_goal_creation_context = (
            "finsi-goal-draft" in (previous_answer or "").lower()
            or "que quieres conseguir con esta meta" in previous_goal_context
            or "cuanto dinero necesitas para alcanzarla" in previous_goal_context
            or "para que fecha te gustaria alcanzar esta meta" in previous_goal_context
            or (
                "antes de crearla revisa los datos" in previous_goal_context
                and "quieres que cree esta meta" in previous_goal_context
            )
        )
        if has_goal_creation_context:
            goal_creation_response = self._goal_creation_conversation(
                usuario_id=usuario_id,
                question=query.original,
                previous_answer=previous_answer,
            )
            if goal_creation_response is not None:
                response = self._internal_response(
                    goal_creation_response,
                    Intent.GOALS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "goal_creation_conversation"
                return response

        # Aislamiento bidireccional de agentes.
        # En FinSightAI Advisor, una intención financiera válida SIEMPRE tiene
        # prioridad sobre los detectores amplios de soporte. Esto evita falsos
        # positivos como "¿Cuánto gasté este mes?".
        advisor_intent_result = self.intent_detector.detect_result(query.corrected)
        advisor_financial_intents = {
            Intent.INCOME,
            Intent.EXPENSES,
            Intent.DEBT,
            Intent.SAVINGS,
            Intent.SCORE,
            Intent.PROFILE,
            Intent.RECOMMENDATIONS,
            Intent.FULL_ANALYSIS,
            Intent.BUDGET,
            Intent.SUMMARY,
            Intent.RECENT_EXPENSES,
            Intent.GOALS,
            Intent.FINANCIAL_EDUCATION,
        }
        is_financial_in_advisor = (
            advisor_intent_result.intent in advisor_financial_intents
            or self._is_direct_goal_query(query.corrected)
            or TransactionQueryEngine.is_financial_query_candidate(
                query.corrected,
                previous_answer,
            )
        )

        advisor_support_query = (
            not is_financial_in_advisor
            and (
                SupportIntentDetector.is_critical_support_query(query.original)
                or SupportIntentDetector.is_information_query(query.original)
                or SupportIntentDetector.is_support_query(query.original)
                or SupportIntentDetector.is_support_follow_up(
                    query.original,
                    previous_answer,
                )
            )
        )

        if advisor_support_query:
            return LLMResponse(
                content=(
                    "Para preguntas de soporte, en el selector de abajo elige "
                    "**Soporte técnico**."
                ),
                provider="internal",
                model="assistant-mode-router",
                metadata={
                    "intent": "support_redirect",
                    "route": "advisor_mode_support_redirect",
                    "used_financial_context": False,
                    "save_history": True,
                    "update_context": False,
                },
            )

        # Flujo conversacional para explicar y crear metas directamente desde Finsi.
        # Se evalúa antes de la consulta general de metas para que preguntas como
        # "¿para qué sirven las metas?" no terminen mostrando solamente el listado.
        goal_creation_response = self._goal_creation_conversation(
            usuario_id=usuario_id,
            question=query.original,
            previous_answer=previous_answer,
        )
        if goal_creation_response is not None:
            response = self._internal_response(
                goal_creation_response,
                Intent.GOALS,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "goal_creation_conversation"
            return response

        # Si el usuario rechaza el plan ofrecido justo después de crear una meta,
        # cerrar el flujo de manera natural en lugar de caer al fallback general.
        previous_normalized = QueryNormalizer.normalize(previous_answer or "")
        if (
            "quieres que analice tus finanzas y te prepare un plan" in previous_normalized
            and self._negative_answer(query.original)
        ):
            return self._internal_response(
                "De acuerdo. La meta ya quedó creada. Si necesitas algo más, aquí estoy para ayudarte.",
                Intent.GOALS,
                query,
                used_financial_context=True,
            )

        # Goal Advisor: mantiene el contexto de la meta entre preguntas como
        # "¿voy a llegar a tiempo?", "armame un plan" o "¿qué fecha sería realista?".
        if self._is_goal_advisor_query(query.original, previous_answer):
            content = self._goal_advisor_response(
                usuario_id=usuario_id,
                question=query.original,
                previous_answer=previous_answer,
                today=self._today_for_time_zone(time_zone),
            )
            response = self._internal_response(
                content,
                Intent.GOALS,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "goal_advisor"
            return response

        # Consultas hipotéticas de clasificación (p. ej. "¿en qué categoría y
        # subcategoría debería estar un pasaje de avión?") se resuelven con el
        # mismo clasificador determinístico usado por las transacciones reales.
        classification_response = self._transaction_classification_response(query.original)
        if classification_response is not None:
            return LLMResponse(
                content=classification_response,
                provider="internal",
                model="transaction-classifier",
                metadata={
                    "intent": "transaction_classification",
                    "route": "transaction_classification_direct",
                    "used_financial_context": False,
                },
            )

        if self._is_goal_delete_support_follow_up(
            query.original,
            previous_answer,
        ):
            return await self.support_agent.answer(
                usuario_id=usuario_id,
                question=query.original,
                provider=provider,
                previous_answer=previous_answer,
            )

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

        # Separa preguntas informativas de descripciones de fallos. Una consulta
        # como "¿dónde cambio mi contraseña?" debe responder con navegación,
        # mientras que "no puedo cambiarla" debe iniciar diagnóstico.
        information_query = SupportIntentDetector.is_information_query(
            query.original
        )
        explicit_support_query = (
            SupportIntentDetector.is_support_query(query.original)
            and self._is_explicit_technical_problem(query.original)
        )

        # Detecta primero la intención para impedir que Product Knowledge
        # intercepte consultas válidas de educación financiera.
        early_intent = self.intent_detector.detect_result(query.corrected)

        # Product Knowledge sigue resolviendo consultas informativas sobre
        # FinSightAI y TwentyNineDevs, excepto cuando la intención ya fue
        # reconocida como educación financiera.
        product_knowledge = (
    ProductKnowledgeResponder.answer(query.original)
    if (
        not explicit_support_query
        and early_intent.intent not in {
            Intent.FINANCIAL_EDUCATION,
            Intent.GREETING,
            Intent.THANKS,
            Intent.FAREWELL,
            Intent.CAPABILITIES,
            Intent.CREATOR_INFO,
        }
    )
    else None
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
        is_recent_expenses_query = self._is_recent_expenses_query(
            query.corrected
        )

        # Las intenciones conversacionales globales tienen prioridad sobre el
        # soporte. Esto evita que preguntas como "¿qué puedes hacer?" sean
        # interpretadas como continuación de un diagnóstico técnico solo porque
        # la respuesta anterior mencionó que el asistente puede ayudar.
        if early_intent.intent in {
            Intent.GREETING,
            Intent.THANKS,
            Intent.FAREWELL,
            Intent.CAPABILITIES,
            Intent.CREATOR_INFO,
            Intent.NON_FINANCIAL_CALCULATION,
            Intent.OUT_OF_SCOPE,
        }:
            return self._internal_response(
                self._simple_response(early_intent.intent),
                early_intent.intent,
                query,
            )

        # El soporte se evalúa antes de las políticas financieras para que las
        # consultas sobre el uso de FinSightAI no sean tratadas como fuera de alcance.
        # El flujo financiero existente permanece intacto para el resto.
        support_follow_up = (
            SupportIntentDetector.is_support_follow_up(
                query.original,
                previous_answer,
            )
            and self._can_continue_support_diagnosis(
                query.original
            )
        )
        protected_financial_intents = {
            Intent.INCOME,
            Intent.EXPENSES,
            Intent.DEBT,
            Intent.SAVINGS,
            Intent.SCORE,
            Intent.PROFILE,
            Intent.RECOMMENDATIONS,
            Intent.FULL_ANALYSIS,
            Intent.BUDGET,
            Intent.SUMMARY,
            Intent.FINANCIAL_EDUCATION,
        }

        if explicit_support_query or (
            support_follow_up
            and early_intent.intent not in protected_financial_intents
            and not (
                is_contextual_financial_follow_up
                or is_financial_query
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

        # Los pedidos explícitos de gastos recientes no deben caer en el
        # follow-up genérico ni depender del intent detector.
        if is_recent_expenses_query:
            limit = self._extract_recent_expenses_limit(query.corrected)
            content = self._recent_expenses_response(
                usuario_id=usuario_id,
                limit=limit,
                today=local_today,
            )
            response = self._internal_response(
                content,
                Intent.RECENT_EXPENSES,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "recent_expenses_direct"
            return response

        # Las consultas sobre metas deben usar siempre las metas reales del backend.
        # Se resuelven antes del follow-up genérico para evitar que el LLM responda
        # con consejos hipotéticos cuando FinSightAI ya tiene esos datos.
        if self._is_direct_goal_query(query.corrected):
            content = self._direct_goal_response(
                usuario_id=usuario_id,
                question=query.corrected,
            )
            response = self._internal_response(
                content,
                Intent.GOALS,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "goals_direct"
            return response

        if (
            previous_answer
            and early_intent.intent == Intent.UNKNOWN
            and self._is_follow_up(query.corrected)
        ):
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
                today=local_today,
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
    def _transaction_classification_response(question: str) -> str | None:
        normalized = QueryNormalizer.normalize(question)
        asks_classification = (
            ("categoria" in normalized or "subcategoria" in normalized)
            and any(
                marker in normalized
                for marker in (
                    "deberia estar", "deberia ir", "corresponde",
                    "como lo clasificarias", "como clasificarias",
                    "en que categoria",
                )
            )
            and any(
                marker in normalized
                for marker in (
                    "compre", "pague", "gaste", "pasaje", "compra",
                    "transaccion", "movimiento",
                )
            )
        )
        if not asks_classification:
            return None

        diagnostic = diagnosticar_descripcion(question)
        categoria = diagnostic.get("categoria")
        subcategoria = diagnostic.get("subcategoria")
        if not categoria or not subcategoria:
            return None

        return (
            f"La clasificaría como **{categoria} → {subcategoria}**. "
            "Esa clasificación se basa en la descripción de la transacción."
        )

    @staticmethod
    def _is_explicit_technical_problem(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question)
        problem_markers = (
            "no puedo","no me deja","no funciona","no anda","no responde",
            "no carga","no aparece","no recibo","se queda cargando",
            "se trabo","se bloqueo","error","falla","fallo",
            "rechazada","rechazado","incorrecta","incorrecto",
            "invalida","invalido","bloqueada","bloqueado",
            "vencido","vencio","desaparecio","perdi mis",
        )
        return any(marker in normalized for marker in problem_markers)

    @staticmethod
    def _is_goal_delete_support_follow_up(
        question: str,
        previous_answer: str | None,
    ) -> bool:
        if not previous_answer:
            return False

        normalized_question = QueryNormalizer.normalize(question)
        normalized_previous = QueryNormalizer.normalize(previous_answer)

        follow_up_terms = {
            "sigue igual",
            "sigue sin aparecer",
            "no aparece",
            "todavia no aparece",
            "aun no aparece",
            "no funciono",
            "sigue sin funcionar",
        }

        previous_markers = (
            "si despues de actualizar continua sin aparecer",
            "escribe sigue igual para derivar el caso",
            "la meta sigue apareciendo",
        )

        return (
            normalized_question in follow_up_terms
            and any(
                marker in normalized_previous
                for marker in previous_markers
            )
        )

    @staticmethod
    def _security_refusal_response(
        question: str,
    ) -> str | None:
        normalized = QueryNormalizer.normalize(question)

        blocked_patterns = (
            "como hackeo una cuenta",
            "hackear una cuenta",
            "como robo una cuenta",
            "robar una cuenta",
            "como entro a una cuenta ajena",
            "como entrar a una cuenta ajena",
            "como accedo a una cuenta ajena",
            "acceder a una cuenta ajena",
            "entrar a una cuenta ajena",
            "vulnerar una cuenta",
        )

        if any(
            pattern in normalized
            for pattern in blocked_patterns
        ):
            return (
                "No puedo ayudar a acceder sin autorización a una "
                "cuenta ni a vulnerar su seguridad. Si necesitas "
                "recuperar tu propia cuenta, usa **¿Olvidaste tu "
                "contraseña?** o contacta al equipo de soporte."
            )

        return None

    @staticmethod
    def _can_continue_support_diagnosis(
        question: str,
    ) -> bool:
        normalized = QueryNormalizer.normalize(question).strip()

        exact_follow_ups = {
            "1",
            "2",
            "3",
            "4",
            "si",
            "no",
            "sip",
            "nop",
            "correcto",
            "dale",
            "ok",
            "sigue igual",
            "sigue sin funcionar",
            "no funciona",
            "no funciono",
            "todavia no",
            "aun no",
            "aparece un error",
            "me da error",
            "me tira error",
            "no aparece",
            "no responde",
        }

        if normalized in exact_follow_ups:
            return True

        follow_up_prefixes = (
            "el error dice",
            "el mensaje dice",
            "aparece el mensaje",
            "me aparece",
            "cuando intento",
            "cuando presiono",
            "cuando selecciono",
        )

        return any(
            normalized.startswith(prefix)
            for prefix in follow_up_prefixes
        )

    @staticmethod
    def _quick_social_response(
        question: str,
    ) -> str | None:
        raw = (question or "").strip()

        # Elimina selectores de variante y modificadores de tono de piel.
        # Así también reconoce 👍🏻, 👍🏼, ❤️ y otras variantes visuales.
        cleaned = raw.replace("\ufe0f", "").replace("\u200d", "")
        cleaned = "".join(
            char
            for char in cleaned
            if not ("\U0001F3FB" <= char <= "\U0001F3FF")
        )

        normalized = QueryNormalizer.normalize(raw)

        if normalized in {
            "perfecto",
            "excelente",
            "ok",
            "okay",
            "oki",
            "listo",
            "dale",
            "genial",
            "muy bien",
            "joya",
        }:
            return "¡Perfecto! ¿En qué más puedo ayudarte?"

        if cleaned in {"👍", "👌", "✅", "👏", "🙌"}:
            return "¡Perfecto! 😊"

        if cleaned in {"😂", "🤣"}:
            return "😂"

        if cleaned in {"😄", "😀", "😃", "😁", "😅"}:
            return "😄"

        if cleaned in {"❤", "💙", "💚", "🩵"}:
            return "❤️"

        if cleaned == "👋":
            return "¡Hola! 😊 ¿En qué puedo ayudarte?"

        if normalized in {"no entendi", "no comprendi"}:
            return (
                "Claro. Indica qué parte deseas que explique "
                "nuevamente o escribe la pregunta con otras "
                "palabras."
            )

        return None

    @staticmethod
    def _is_goal_explanation_query(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question)
        patterns = (
            r"\bpara que sirven las metas\b",
            r"\bpara que sirve una meta\b",
            r"\bque son las metas\b",
            r"\bque es una meta financiera\b",
            r"\bcomo funcionan las metas\b",
            r"\bcomo funciona una meta\b",
        )
        return any(re.search(pattern, normalized) for pattern in patterns)

    @staticmethod
    def _affirmative_answer(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question).strip()
        return normalized in {
            "si", "sí", "dale", "ok", "okay", "bueno", "claro",
            "por favor", "si quiero", "quiero", "creala", "crealo",
            "crear", "hagamosla", "hagamoslo",
        }

    @staticmethod
    def _negative_answer(question: str) -> bool:
        normalized = QueryNormalizer.normalize(question).strip()
        return normalized in {
            "no", "no gracias", "ahora no", "por ahora no", "mejor no",
            "cancelar", "cancela",
        }

    @staticmethod
    def _extract_goal_amount(question: str) -> Decimal | None:
        raw = (question or "").strip()
        match = re.search(
            r"(?:\$|ars\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)",
            raw,
            flags=re.IGNORECASE,
        )
        if not match:
            return None

        value = match.group(1)
        if "." in value and "," in value:
            value = value.replace(".", "").replace(",", ".")
        elif value.count(".") > 1:
            value = value.replace(".", "")
        elif "." in value:
            left, right = value.rsplit(".", 1)
            if len(right) == 3:
                value = left.replace(".", "") + right
        elif "," in value:
            value = value.replace(",", ".")

        try:
            amount = Decimal(value)
        except InvalidOperation:
            return None
        return amount if amount > 0 else None

    @staticmethod
    def _extract_goal_date(question: str) -> date | None:
        normalized = QueryNormalizer.normalize(question)
        today = date.today()

        # dd/mm/yyyy o dd-mm-yyyy
        match = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", normalized)
        if match:
            try:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            except ValueError:
                return None

        # yyyy-mm-dd
        match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", normalized)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                return None

        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
            "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
            "septiembre": 9, "setiembre": 9, "octubre": 10,
            "noviembre": 11, "diciembre": 12,
        }

        # "1 de marzo de 2027", "25 enero 2027", etc.
        month_names = "|".join(months.keys())
        natural_match = re.search(
            rf"\b(\d{{1,2}})\s+(?:de\s+)?({month_names})(?:\s+de)?\s+(20\d{{2}})\b",
            normalized,
        )
        if natural_match:
            day = int(natural_match.group(1))
            month_number = months[natural_match.group(2)]
            year = int(natural_match.group(3))
            try:
                return date(year, month_number, day)
            except ValueError:
                return None
        for month_name, month_number in months.items():
            if month_name not in normalized:
                continue
            year_match = re.search(r"\b(20\d{2})\b", normalized)
            year = int(year_match.group(1)) if year_match else today.year
            # Si solo dice el mes y ya pasó, interpreta el próximo año.
            if not year_match and month_number < today.month:
                year += 1
            import calendar
            last_day = calendar.monthrange(year, month_number)[1]
            return date(year, month_number, last_day)

        return None

    @staticmethod
    def _goal_draft_from_previous(previous_answer: str | None) -> dict[str, str]:
        if not previous_answer:
            return {}

        # Fuente principal: marcador interno completo.
        match = re.search(
            r"\\?<!--\s*finsi-goal-draft\s+name=(.*?)\s+\|\s+amount=(.*?)\s+\|\s+date=(.*?)\s*-->",
            previous_answer,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if match:
            return {
                "name": match.group(1).strip(),
                "amount": match.group(2).strip(),
                "date": match.group(3).strip(),
            }

        # Fallback defensivo: si por alguna capa del streaming/frontend el
        # marcador no vuelve en previous_answer, reconstruye el draft desde
        # la confirmación visible que Finsi acaba de mostrar.
        name_match = re.search(
            r"(?:Meta|Objetivo)\s*:\s*\*\*(.+?)\*\*",
            previous_answer,
            flags=re.IGNORECASE,
        )
        amount_match = re.search(
            r"Objetivo\s*:\s*\*\*\$?([\d.]+(?:,\d{1,2})?)\*\*",
            previous_answer,
            flags=re.IGNORECASE,
        )
        date_match = re.search(
            r"Fecha\s*:\s*\*\*(\d{1,2}/\d{1,2}/\d{4})\*\*",
            previous_answer,
            flags=re.IGNORECASE,
        )

        draft: dict[str, str] = {}
        if name_match:
            draft["name"] = name_match.group(1).strip()
        if amount_match:
            raw_amount = amount_match.group(1).replace(".", "").replace(",", ".")
            draft["amount"] = raw_amount
        if date_match:
            try:
                parsed = datetime.strptime(date_match.group(1), "%d/%m/%Y").date()
                draft["date"] = parsed.isoformat()
            except ValueError:
                pass
        return draft

    @staticmethod
    def _goal_draft_marker(
        name: str = "",
        amount: str = "",
        target_date: str = "",
    ) -> str:
        safe_name = re.sub(r"[\r\n|<>]", " ", name).strip()
        safe_amount = re.sub(r"[\r\n|<>]", "", amount).strip()
        safe_date = re.sub(r"[\r\n|<>]", "", target_date).strip()
        return (
            f"<!-- finsi-goal-draft name={safe_name} | "
            f"amount={safe_amount} | date={safe_date} -->"
        )

    def _goal_creation_conversation(
        self,
        usuario_id: str,
        question: str,
        previous_answer: str | None,
    ) -> str | None:
        normalized = QueryNormalizer.normalize(question)
        previous_normalized = QueryNormalizer.normalize(previous_answer or "")
        draft = self._goal_draft_from_previous(previous_answer)

        # Inicio explícito del flujo de creación. Debe resolverse aquí antes de
        # que "meta" sea interpretado como una consulta sobre metas existentes.
        direct_creation_patterns = (
            r"\bquiero crear (?:una )?meta\b",
            r"\bquiero agregar (?:una )?meta\b",
            r"\bquiero hacer (?:una )?meta\b",
            r"\bcrear (?:una )?meta\b",
            r"\bagregar (?:una )?meta\b",
            r"\bnueva meta\b",
            r"\bcreame (?:una )?meta\b",
            r"\bcrea (?:una )?meta\b",
            r"\bme (?:puedes|podes) crear (?:una )?meta\b",
        )
        if any(re.search(pattern, normalized) for pattern in direct_creation_patterns):
            return (
                "¡Perfecto! ¿Qué quieres conseguir con esta meta? "
                "Por ejemplo: **comprar una PC**, **pagar una deuda** o "
                "**crear un fondo de emergencia**."
            )

        # Pregunta educativa: explicar primero, no listar metas.
        if self._is_goal_explanation_query(question):
            return (
                "Las **metas financieras** sirven para convertir algo que quieres "
                "conseguir en un objetivo concreto. Puedes indicar cuánto necesitas "
                "ahorrar y para qué fecha, y FinSightAI irá mostrando cuánto llevas, "
                "cuánto te falta y el avance de la meta.\n\n"
                "Por ejemplo, puedes crear una meta para pagar una deuda, armar un "
                "fondo de emergencia, hacer un viaje o comprar algo importante.\n\n"
                "**¿Quieres que cree una meta por ti?**"
            )

        # Aceptación de una oferta de creación.
        offered_creation = (
            "quieres que cree una meta por ti" in previous_normalized
            or "quieres que te cree una meta" in previous_normalized
        )
        if offered_creation:
            if self._negative_answer(question):
                return "De acuerdo. Puedes crear una meta conmigo cuando quieras."
            if self._affirmative_answer(question):
                return (
                    "¡Perfecto! ¿Qué quieres conseguir con esta meta? "
                    "Por ejemplo: **comprar una PC**, **pagar una deuda** o "
                    "**crear un fondo de emergencia**."
                )

        # Nombre de la meta.
        if (
            "que quieres conseguir con esta meta" in previous_normalized
            or "que queres conseguir con esta meta" in previous_normalized
        ):
            if len(question.strip()) < 2:
                return "Cuéntame brevemente qué quieres conseguir con esta meta."
            name = question.strip().rstrip(".")
            return (
                f"Perfecto. La meta será **{name}**. "
                "¿Cuánto dinero necesitas para alcanzarla?\n\n"
                + self._goal_draft_marker(name=name)
            )

        # Monto objetivo.
        # También continúa correctamente después de un intento inválido:
        # el marcador conserva el nombre aunque la respuesta anterior ya no
        # repita literalmente la pregunta original.
        awaiting_amount = (
            "cuanto dinero necesitas para alcanzarla" in previous_normalized
            or (
                bool(draft.get("name"))
                and not draft.get("amount")
                and (
                    "no pude reconocer el monto" in previous_normalized
                    or "finsi-goal-draft" in (previous_answer or "").lower()
                )
            )
        )
        if awaiting_amount:
            name = draft.get("name", "Nueva meta")
            amount = self._extract_goal_amount(question)
            if amount is None:
                return (
                    "No pude reconocer el monto. Escríbelo, por ejemplo, como "
                    "**$500.000** o **1500000**.\n\n"
                    + self._goal_draft_marker(name=name)
                )
            amount_text = str(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            return (
                f"Objetivo: **{self._format_money(amount)}**. "
                "¿Para qué fecha te gustaría alcanzar esta meta? "
                "Puedes responder, por ejemplo, **diciembre de 2026** o **15/12/2026**.\n\n"
                + self._goal_draft_marker(name=name, amount=amount_text)
            )

        # Fecha objetivo.
        # Si el usuario escribió una fecha inválida o pasada, la respuesta
        # anterior cambia de texto pero el draft sigue indicando que ya tenemos
        # nombre + monto y todavía falta fecha.
        awaiting_date = (
            "para que fecha te gustaria alcanzar esta meta" in previous_normalized
            or (
                bool(draft.get("name"))
                and bool(draft.get("amount"))
                and not draft.get("date")
                and (
                    "no pude reconocer la fecha" in previous_normalized
                    or "la fecha objetivo debe ser futura" in previous_normalized
                    or "finsi-goal-draft" in (previous_answer or "").lower()
                )
            )
        )
        if awaiting_date:
            name = draft.get("name", "Nueva meta")
            amount_raw = draft.get("amount", "")
            target_date = self._extract_goal_date(question)
            if target_date is None:
                return (
                    "No pude reconocer la fecha. Puedes escribirla como "
                    "**diciembre de 2026** o **15/12/2026**.\n\n"
                    + self._goal_draft_marker(name=name, amount=amount_raw)
                )
            if target_date < date.today():
                return (
                    "La fecha objetivo debe ser futura. Indícame una fecha posterior a hoy.\n\n"
                    + self._goal_draft_marker(name=name, amount=amount_raw)
                )
            try:
                amount = Decimal(amount_raw)
            except InvalidOperation:
                return "Perdí el monto de la meta. Indícame nuevamente cuánto necesitas ahorrar."

            return (
                "Antes de crearla, revisa los datos:\n\n"
                f"• **Meta:** {name}\n"
                f"• **Objetivo:** {self._format_money(amount)}\n"
                f"• **Fecha:** {target_date.strftime('%d/%m/%Y')}\n\n"
                "**¿Quieres que cree esta meta?**\n\n"
                + self._goal_draft_marker(
                    name=name,
                    amount=str(amount),
                    target_date=target_date.isoformat(),
                )
            )

        # Confirmación final: recién aquí persiste la meta en Spring.
        confirmation_prompt = (
            (
                "antes de crearla revisa los datos" in previous_normalized
                and "quieres que cree esta meta" in previous_normalized
            )
            or (
                bool(draft.get("name"))
                and bool(draft.get("amount"))
                and bool(draft.get("date"))
                and (
                    self._affirmative_answer(question)
                    or self._negative_answer(question)
                )
            )
        )
        if confirmation_prompt:
            if self._negative_answer(question):
                return "De acuerdo, no creé la meta. Si quieres, podemos empezar nuevamente."
            if not self._affirmative_answer(question):
                return "Responde **Sí** para crear la meta o **No** para cancelarla."

            name = draft.get("name", "").strip()
            amount_raw = draft.get("amount", "").strip()
            date_raw = draft.get("date", "").strip()
            try:
                amount = Decimal(amount_raw)
                target_date = date.fromisoformat(date_raw)
            except (InvalidOperation, ValueError):
                return (
                    "No pude recuperar todos los datos de la meta. "
                    "Empecemos nuevamente: ¿qué quieres conseguir con esta meta?"
                )

            category = "OTRO"
            normalized_name = QueryNormalizer.normalize(name)
            if any(term in normalized_name for term in ("deuda", "credito", "tarjeta", "prestamo")):
                category = "DEUDA"
            elif any(term in normalized_name for term in ("emergencia", "fondo de emergencia")):
                category = "EMERGENCIA"
            elif any(term in normalized_name for term in ("viaje", "vacaciones")):
                category = "VIAJE"
            elif any(term in normalized_name for term in ("comprar", "compra", "pc", "auto", "casa", "celular")):
                category = "COMPRA"
            elif any(term in normalized_name for term in ("ahorrar", "ahorro")):
                category = "AHORRO"

            try:
                created = self.goal_repository.create(
                    {
                        "usuario_id": usuario_id,
                        "nombre": name,
                        "descripcion": "Meta creada por Finsi desde el chat.",
                        "categoria": category,
                        "monto_objetivo": float(amount),
                        "fecha_objetivo": target_date.isoformat(),
                    }
                )
            except (ValueError, BackendDataError) as error:
                return (
                    "No pude crear la meta en este momento. "
                    f"El backend respondió: {str(error)}"
                )

            created_name = str(created.get("nombre") or name)
            return (
                f"¡Listo! Creé la meta **{created_name}** por "
                f"{self._format_money(amount)}, con fecha objetivo "
                f"**{target_date.strftime('%d/%m/%Y')}**. 🎯\n\n"
                "**¿Quieres que analice tus finanzas y te prepare un plan para alcanzarla?**"
            )

        return None

    @staticmethod
    def _is_goal_advisor_query(
        question: str,
        previous_answer: str | None,
    ) -> bool:
        normalized = QueryNormalizer.normalize(question)

        patterns = (
            r"\bvoy a llegar a tiempo\b",
            r"\bllego a tiempo\b",
            r"\bdeberia cambiar para cumplir",
            r"\bque deberia cambiar para cumplir",
            r"\barmame un plan",
            r"\bpreparame un plan",
            r"\bplan para (?:alcanzar|cumplir)",
            r"\bcomo puedo ahorrar para",
            r"\bcomo ahorro para",
            r"\bque gastos deberia reducir",
            r"\bque gastos puedo reducir",
            r"\bconseguir el dinero que me falta",
            r"\bconseguir lo que me falta",
            r"\bgenerar ingresos extra\b",
            r"\bnecesito ingresos extra\b",
            r"\balcanzarla antes\b",
            r"\bcumplirla antes\b",
            r"\bllegar antes\b",
            r"\bfecha seria mas realista\b",
            r"\bfecha mas realista\b",
        )
        if any(re.search(pattern, normalized) for pattern in patterns):
            return True

        # Acepta respuestas inmediatamente posteriores a la oferta de plan.
        previous_normalized = QueryNormalizer.normalize(previous_answer or "")
        if "quieres que analice tus finanzas y te prepare un plan" in previous_normalized:
            if FinSightAgentService._affirmative_answer(question):
                return True
            if FinSightAgentService._negative_answer(question):
                return False

        return False

    def _goal_advisor_response(
        self,
        usuario_id: str,
        question: str,
        previous_answer: str | None,
        today: date,
    ) -> str:
        try:
            goals = self.goal_repository.list_by_user(usuario_id)
        except (ValueError, BackendDataError):
            return (
                "No pude consultar tus metas en este momento. "
                "Intenta nuevamente cuando el servicio esté disponible."
            )

        active = [
            goal for goal in goals
            if str(goal.get("estado", "")).upper() == "ACTIVA"
        ]
        if not active:
            return (
                "No tienes metas activas para analizar. "
                "Si quieres, puedo ayudarte a crear una."
            )

        goal = self._select_goal_for_advice(
            active,
            question=question,
            previous_answer=previous_answer,
        )

        try:
            analysis = fetch_live_analysis(usuario_id)
        except (BackendDataError, ValueError):
            analysis = None

        normalized = QueryNormalizer.normalize(question)
        base_plan = GoalAdvisor.build_plan(
            goal=goal,
            analysis=analysis,
            today=today,
        )

        if any(
            marker in normalized
            for marker in (
                "fecha seria mas realista",
                "fecha mas realista",
            )
        ):
            return self._realistic_goal_date_response(
                goal=goal,
                analysis=analysis,
                today=today,
            )

        if any(
            marker in normalized
            for marker in (
                "que gastos deberia reducir",
                "que gastos puedo reducir",
            )
        ):
            expense_hint = self._goal_expense_reduction_hint(usuario_id)
            if expense_hint:
                return f"{base_plan}\n\n{expense_hint}"
            return base_plan

        if any(
            marker in normalized
            for marker in (
                "generar ingresos extra",
                "necesito ingresos extra",
                "conseguir el dinero que me falta",
                "conseguir lo que me falta",
            )
        ):
            gap = self._goal_monthly_gap(goal, analysis, today)
            return GoalAdvisor.income_ideas(gap)

        if any(
            marker in normalized
            for marker in (
                "como puedo ahorrar",
                "como ahorro",
            )
        ):
            required = self._goal_monthly_required(goal, today)
            saving = self._analysis_monthly_saving(analysis)
            return GoalAdvisor.savings_method(required, saving)

        return base_plan

    @classmethod
    def _select_goal_for_advice(
        cls,
        goals: list[dict[str, Any]],
        question: str,
        previous_answer: str | None,
    ) -> dict[str, Any]:
        normalized_question = QueryNormalizer.normalize(question)
        normalized_previous = QueryNormalizer.normalize(previous_answer or "")

        # 1. Meta nombrada en la pregunta.
        for goal in goals:
            name = QueryNormalizer.normalize(str(goal.get("nombre") or ""))
            if name and name in normalized_question:
                return goal

        # 2. Meta mencionada en la respuesta anterior.
        for goal in goals:
            name = QueryNormalizer.normalize(str(goal.get("nombre") or ""))
            if name and name in normalized_previous:
                return goal

        # 3. Meta activa más cercana por fecha; sin fecha, menor faltante.
        def parsed_date(item: dict[str, Any]) -> date | None:
            raw = item.get("fecha_objetivo")
            if not raw:
                return None
            try:
                return date.fromisoformat(str(raw)[:10])
            except ValueError:
                return None

        dated = [goal for goal in goals if parsed_date(goal) is not None]
        if dated:
            return min(dated, key=lambda item: parsed_date(item) or date.max)

        def remaining(item: dict[str, Any]) -> Decimal:
            target = cls._decimal_for_goal(item.get("monto_objetivo"))
            reserved = cls._decimal_for_goal(item.get("monto_reservado"))
            return max(target - reserved, Decimal("0"))

        return min(goals, key=remaining)

    @classmethod
    def _goal_monthly_required(
        cls,
        goal: dict[str, Any],
        today: date,
    ) -> Decimal:
        target = cls._decimal_for_goal(goal.get("monto_objetivo"))
        reserved = cls._decimal_for_goal(goal.get("monto_reservado"))
        remaining = max(target - reserved, Decimal("0"))

        raw_date = goal.get("fecha_objetivo")
        if not raw_date or remaining <= 0:
            return Decimal("0")

        try:
            target_date = date.fromisoformat(str(raw_date)[:10])
        except ValueError:
            return Decimal("0")

        if target_date <= today:
            return Decimal("0")

        months = (
            (target_date.year - today.year) * 12
            + target_date.month
            - today.month
        )
        if target_date.day > today.day:
            months += 1
        months = max(months, 1)

        return (remaining / Decimal(months)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    @classmethod
    def _goal_monthly_gap(
        cls,
        goal: dict[str, Any],
        analysis: dict[str, Any] | None,
        today: date,
    ) -> Decimal:
        required = cls._goal_monthly_required(goal, today)
        saving = cls._analysis_monthly_saving(analysis)
        return max(required - saving, Decimal("0"))

    @staticmethod
    def _analysis_monthly_saving(
        analysis: dict[str, Any] | None,
    ) -> Decimal:
        if not analysis:
            return Decimal("0")
        metrics = analysis.get("metricas", {})
        return FinSightAgentService._decimal_for_goal(
            metrics.get("ahorro_mensual_estimado")
        )

    @staticmethod
    def _decimal_for_goal(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal("0")

    @classmethod
    def _realistic_goal_date_response(
        cls,
        goal: dict[str, Any],
        analysis: dict[str, Any] | None,
        today: date,
    ) -> str:
        name = str(goal.get("nombre") or "Meta financiera")
        target = cls._decimal_for_goal(goal.get("monto_objetivo"))
        reserved = cls._decimal_for_goal(goal.get("monto_reservado"))
        remaining = max(target - reserved, Decimal("0"))
        saving = cls._analysis_monthly_saving(analysis)

        if remaining <= 0:
            return f"La meta **{name}** ya está completada."

        if saving <= 0:
            return (
                f"Con tu capacidad de ahorro actual no puedo calcular una fecha "
                f"realista para **{name}**. Primero habría que recuperar un margen "
                "mensual positivo."
            )

        months = int(
            (remaining / saving).to_integral_value(
                rounding="ROUND_CEILING"
            )
        )
        months = max(months, 1)
        realistic = cls._add_months(today, months)

        return (
            f"Con tu capacidad de ahorro actual de {cls._format_money(saving)}, "
            f"una fecha más realista para **{name}** sería aproximadamente "
            f"**{realistic.strftime('%d/%m/%Y')}**."
        )

    @staticmethod
    def _add_months(value: date, months: int) -> date:
        import calendar

        month_index = value.month - 1 + months
        year = value.year + month_index // 12
        month = month_index % 12 + 1
        day = min(value.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    @classmethod
    def _goal_expense_reduction_hint(
        cls,
        usuario_id: str,
    ) -> str | None:
        try:
            transactions = fetch_user_transactions(usuario_id)
        except (BackendDataError, ValueError):
            return None

        totals: dict[str, Decimal] = {}
        for transaction in transactions:
            if str(transaction.get("tipo") or "").strip().upper() != "GASTO":
                continue
            category = str(
                transaction.get("categoria") or "Sin categoría"
            ).strip()
            amount = cls._decimal_for_goal(transaction.get("monto"))
            totals[category] = totals.get(category, Decimal("0")) + amount

        if not totals:
            return None

        top = sorted(
            totals.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:2]

        categories = " y ".join(
            f"**{category}** ({cls._format_money(amount)})"
            for category, amount in top
        )
        return (
            f"En tus datos, las categorías con más gasto son {categories}. "
            "Revisaría primero los consumos ajustables dentro de esas categorías, "
            "sin recortar necesidades básicas."
        )

    @staticmethod
    def _is_direct_goal_query(question: str) -> bool:
        """Detecta preguntas que requieren consultar las metas reales del usuario."""
        normalized = QueryNormalizer.normalize(question)

        goal_terms = (
            "meta", "metas", "objetivo de ahorro", "objetivos de ahorro",
            "objetivo financiero", "objetivos financieros",
        )
        if any(term in normalized for term in goal_terms):
            return True

        # Variantes naturales que pueden no contener literalmente "meta".
        patterns = (
    r"\bcomo vienen mis objetivos\b",
    r"\bcuanto me falta para (?:llegar|alcanzar|completar)(?:la|lo)?\b",
    r"\ben cual estoy mas avanzado\b",
    r"\bcual tengo mas cerca\b",

    # Follow-ups naturales sobre una meta ya mencionada.
    r"\bque deberia cambiar para (?:llegar|alcanzar|cumplir)(?:la|lo)? antes\b",
    r"\bque puedo cambiar para (?:llegar|alcanzar|cumplir)(?:la|lo)? antes\b",
    r"\bcomo (?:puedo )?(?:llegar|alcanzar|cumplir)(?:la|lo)? antes\b",
)
        return any(re.search(pattern, normalized) for pattern in patterns)

    def _direct_goal_response(
        self,
        usuario_id: str,
        question: str,
    ) -> str:
        """Responde sobre metas usando exclusivamente datos persistidos en Spring."""
        try:
            goals = self.goal_repository.list_by_user(usuario_id)
        except (ValueError, BackendDataError):
            return (
                "No pude consultar tus metas en este momento. "
                "Intenta nuevamente cuando el servicio esté disponible."
            )

        if not goals:
            return (
                "Todavía no tienes metas financieras registradas. "
                "Una meta te permite definir un objetivo, un monto y una fecha para "
                "seguir tu progreso de forma más clara.\n\n"
                "**¿Quieres que cree una meta por ti?**"
            )

        normalized = QueryNormalizer.normalize(question)
        active = [
            goal for goal in goals
            if str(goal.get("estado", "")).upper() == "ACTIVA"
        ]
        completed = [
            goal for goal in goals
            if str(goal.get("estado", "")).upper() == "COMPLETADA"
        ]
        relevant = active or completed or goals

        def number(goal: dict[str, Any], key: str) -> float:
            try:
                return float(goal.get(key) or 0)
            except (TypeError, ValueError):
                return 0.0

        def progress(goal: dict[str, Any]) -> float:
            target = number(goal, "monto_objetivo")
            reserved = number(goal, "monto_reservado")
            return min((reserved / target * 100), 100.0) if target > 0 else 0.0

        def remaining(goal: dict[str, Any]) -> float:
            return max(
                number(goal, "monto_objetivo") - number(goal, "monto_reservado"),
                0.0,
            )

        def name(goal: dict[str, Any]) -> str:
            return str(goal.get("nombre") or "Meta").strip()

        # Meta más cercana: primero por fecha objetivo; si no hay fechas,
        # por menor monto restante.
        def target_date(goal: dict[str, Any]) -> date | None:
            raw = goal.get("fecha_objetivo")
            if not raw:
                return None
            try:
                return date.fromisoformat(str(raw)[:10])
            except ValueError:
                return None

        dated_active = [goal for goal in active if target_date(goal) is not None]
        if dated_active:
            nearest = min(dated_active, key=lambda goal: target_date(goal))
        elif active:
            nearest = min(active, key=remaining)
        else:
            nearest = max(relevant, key=progress)

        # "¿Cuánto me falta...?" debe responder el faltante, aunque también
        # contenga la frase "meta más cercana".
        if any(
            marker in normalized
            for marker in (
                "cuanto me falta", "cuanto falta", "monto restante",
            )
        ):
            selected = nearest
            for goal in relevant:
                goal_name = QueryNormalizer.normalize(name(goal))
                if goal_name and goal_name in normalized:
                    selected = goal
                    break
            return (
                f"Para **{name(selected)}** te faltan "
                f"{self._format_money(remaining(selected))}. "
                f"Llevas {progress(selected):.1f}% de la meta "
                f"({self._format_money(number(selected, 'monto_reservado'))} de "
                f"{self._format_money(number(selected, 'monto_objetivo'))})."
            )

        # Preguntas sobre cómo acelerar la meta más cercana.
        if any(
            marker in normalized
            for marker in (
                "que deberia cambiar", "que puedo cambiar", "alcanzar antes",
                "llegar antes", "cumplir antes", "como alcanzo antes",
            )
        ):
            if not active:
                return "No tienes metas activas pendientes en este momento."

            monthly = nearest.get("reserva_mensual_sugerida")
            result = (
                f"Tu meta más cercana es **{name(nearest)}**. "
                f"Llevas {progress(nearest):.1f}% y te faltan "
                f"{self._format_money(remaining(nearest))}."
            )
            try:
                monthly_value = float(monthly) if monthly is not None else None
            except (TypeError, ValueError):
                monthly_value = None

            # Usa el análisis financiero real para convertir la respuesta en una
            # recomendación concreta, sin inventar capacidad de ahorro.
            current_saving = None
            try:
                analysis = fetch_live_analysis(usuario_id)
                metrics = analysis.get("metricas", {})
                current_saving = float(metrics.get("ahorro_mensual_estimado") or 0)
            except (BackendDataError, ValueError, TypeError):
                current_saving = None

            if monthly_value and monthly_value > 0:
                result += (
                    f" Para llegar en la fecha prevista necesitas reservar "
                    f"aproximadamente {self._format_money(monthly_value)} por mes."
                )
                if current_saving is not None:
                    if current_saving >= monthly_value:
                        result += (
                            f" Tu capacidad de ahorro mensual estimada es "
                            f"{self._format_money(current_saving)}, así que podrías cubrir "
                            f"esa reserva si priorizas esta meta."
                        )
                    else:
                        gap = monthly_value - current_saving
                        result += (
                            f" Tu capacidad de ahorro mensual estimada es "
                            f"{self._format_money(current_saving)}, por lo que te faltarían "
                            f"aproximadamente {self._format_money(gap)} por mes. "
                            f"Para acelerar la meta tendrías que liberar ese monto reduciendo "
                            f"gastos o aumentando ingresos."
                        )
            else:
                result += (
                    " Como no hay una reserva mensual calculada, puedes acelerarla "
                    "destinando parte de tu ahorro disponible a esta meta."
                )
            return result

        if any(
            marker in normalized
            for marker in (
                "mas avanzado", "mayor avance", "mas progreso",
            )
        ):
            best = max(relevant, key=progress)
            return (
                f"La meta en la que más avanzaste es **{name(best)}**, "
                f"con {progress(best):.1f}% completado "
                f"({self._format_money(number(best, 'monto_reservado'))} de "
                f"{self._format_money(number(best, 'monto_objetivo'))})."
            )

        # Resumen general de metas.
        lines = [
            f"Tienes {len(active)} meta{'s' if len(active) != 1 else ''} activa"
            f"{'s' if len(active) != 1 else ''}"
            + (
                f" y {len(completed)} completada"
                f"{'s' if len(completed) != 1 else ''}."
                if completed
                else "."
            )
        ]

        for goal in active[:5]:
            line = (
                f"• **{name(goal)}**: {progress(goal):.1f}% completado — "
                f"{self._format_money(number(goal, 'monto_reservado'))} de "
                f"{self._format_money(number(goal, 'monto_objetivo'))}; "
                f"faltan {self._format_money(remaining(goal))}"
            )
            goal_date = target_date(goal)
            if goal_date:
                line += f" — objetivo {goal_date.strftime('%d/%m/%Y')}"
            line += "."
            lines.append(line)

        if active:
            lines.append(
                f"Tu meta más cercana es **{name(nearest)}**, "
                f"con {progress(nearest):.1f}% de avance."
            )

        return "\n".join(lines)

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
        content = RecommendationAdvisor.build(fields).rstrip()
        if "meta" not in QueryNormalizer.normalize(content[-120:]):
            content += "\n\n**¿Quieres que cree una meta por ti?**"
        elif "quieres que cree" not in QueryNormalizer.normalize(content):
            content += "\n\n**¿Quieres que cree una meta por ti?**"
        return content

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
    def _is_recent_expenses_query(question: str) -> bool:
        """Detecta pedidos explícitos de una lista de gastos recientes.

        Importante: no captura "último gasto" en singular, porque esa consulta
        pertenece al motor transaccional y puede incluir un período como agosto.
        """
        normalized = QueryNormalizer.normalize(question)

        return bool(
            re.search(
                r"\b(?:mostrame|muestrame|mostrar|ver)\s+(?:mis\s+)?"
                r"ultimos(?:\s+\d{1,2})?\s+gastos\b",
                normalized,
            )
            or re.search(
                r"\b(?:mis\s+)?ultimos(?:\s+\d{1,2})?\s+gastos\b",
                normalized,
            )
        )

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
        today: date,
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

            # No mostrar movimientos fechados después de hoy.
            user_transactions = user_transactions[
                user_transactions["_fecha_orden"].isna()
                | user_transactions["_fecha_orden"].dt.date.le(today)
            ].copy()

            user_transactions = user_transactions.sort_values(
                by="_fecha_orden",
                ascending=False,
                na_position="last",
            )

        if user_transactions.empty:
            return "No encontré gastos registrados hasta hoy para tu cuenta."

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
            r"\bultimo\s+gasto\b",
            r"\bultima\s+compra\b",
            r"\bgasto\s+mas\s+reciente\b",
            r"\bgaste\s+mas\b",
            r"\bgasto\s+mas\s+en\b",
            r"\bcompar(?:ar|e|acion).*\bgastos?\b",
        )
        income_patterns = (
            r"\bcuanto\s+(?:ingrese|cobre|gane)\b",
            r"\bque\s+(?:ingrese|cobre)\b",
            r"\btotal\s+de\s+ingresos\b",
            r"\bingresos?\s+(?:de|del|en|este|esta)\b",
            r"\bultimo\s+ingreso\b",
            r"\bingreso\s+mas\s+reciente\b",
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
        if raw in {"v", "mmm", "mm", "eh"}:
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
            "explicame mas",
            "explica mas",
            "amplia",
            "amplia eso",
            "ampliame",
            "ampliame eso",
            "dame mas detalles",
            "mas detalles",
            "profundiza",
            "profundiza mas",
            "quiero saber mas",
            "contame mas",
            "cuentame mas",
            "mas sencillo",
            "mas simple",
            "en palabras sencillas",
            "en palabras simples",
            "no entendi",
            "que significa eso",
            "resumilo",
            "resumimelo",
            "por que",
            "que te parece",
            "y que te parece",
        )
        return any(term in normalized for term in follow_up_terms)

    @staticmethod
    def _is_support_mode(assistant_mode: str | None) -> bool:
        if not assistant_mode:
            return False
        normalized = QueryNormalizer.normalize(assistant_mode)
        return normalized in {"soporte", "soporte tecnico", "support"}

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
            Intent.GREETING: "¡Hola! 😊 Todo bien por acá. ¿Cómo estás? ¿En qué puedo ayudarte?",
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