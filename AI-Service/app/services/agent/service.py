
import re
import random
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
        # Primera consulta crypto por usuario: muestra siempre el Rey Crypto.
        # Consultas posteriores: aparece aleatoriamente para no saturar.
        self._crypto_king_seen_users: set[str] = set()

    async def chat(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
        previous_answer: str | None = None,
        time_zone: str | None = None,
        assistant_mode: str | None = None,
        education_topic: str | None = None,
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
        crypto_king_query = EasterEggResponder.is_crypto_king_query(question)
        if easter_egg is not None and easter_egg.key != "finsi_crypto":
            # Los easter eggs tradicionales siguen siendo respuestas tempranas.
            # Crypto es la excepción: debe conservar el visual/audio/logro, pero
            # la pregunta real continúa por el flujo financiero/educativo.
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

        # Fecha actual local del usuario. Se resuelve de forma determinística para
        # no depender del conocimiento temporal del LLM ni mezclarla con finanzas.
        normalized_date_query = QueryNormalizer.normalize(query.corrected).strip()
        date_query_markers = {
            "que dia es hoy",
            "cual es la fecha de hoy",
            "que fecha es hoy",
            "fecha de hoy",
        }
        if normalized_date_query in date_query_markers:
            local_today = self._today_for_time_zone(time_zone)
            weekday_names = (
                "lunes", "martes", "miércoles", "jueves",
                "viernes", "sábado", "domingo",
            )
            month_names = (
                "enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
            )
            content = (
                f"Hoy es {weekday_names[local_today.weekday()]} "
                f"{local_today.day} de {month_names[local_today.month - 1]} de {local_today.year}."
            )
            response = self._internal_response(
                content,
                Intent.UNKNOWN,
                query,
                used_financial_context=False,
            )
            response.metadata["route"] = "local_date_deterministic"
            return response

        # Las tarjetas de Educación Financiera envían un identificador explícito.
        # Si la misma pregunta se escribe manualmente en el chat, inferimos únicamente
        # los cinco prompts canónicos para reutilizar exactamente la misma respuesta
        # contextual, sin ampliar la detección a consultas financieras ambiguas.
        if not education_topic:
            normalized_education_query = QueryNormalizer.normalize(query.corrected).strip()
            manual_education_topics = {
                "quiero entender mejor mi capacidad de ahorro. explicame que significa, como se calcula y como se relaciona con mis finanzas actuales.": "capacidad-ahorro",
                "quiero entender mejor mi relacion deuda/ingreso. explicame que significa y como influye en mi situacion financiera actual.": "deuda-ingreso",
                "quiero entender la diferencia entre gastos fijos y variables y como se refleja en mis gastos actuales.": "gastos-fijos-variables",
                "quiero aprender sobre fondos de emergencia. explicame para que sirven y como podria pensar uno segun mi situacion financiera actual.": "fondo-emergencia",
                "quiero entender mejor como planificar una meta financiera y como relacionarla con mi capacidad de ahorro actual.": "metas-planificacion",
            }
            education_topic = manual_education_topics.get(normalized_education_query)

        if education_topic:
            education_topic_answer = self._education_topic_response(
                usuario_id=usuario_id,
                topic=education_topic,
                question=query.corrected,
            )
            if education_topic_answer is not None:
                response = self._internal_response(
                    education_topic_answer,
                    Intent.FINANCIAL_EDUCATION,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "education_topic_contextual"
                response.metadata["education_topic"] = education_topic
                return response

        # Detectamos la intención lo antes posible para que Educación Financiera
        # no sea interceptada por responders determinísticos de ahorro, gastos,
        # deuda o metas.
        early_intent = self.intent_detector.detect_result(query.corrected)

        # Recomendaciones y presupuesto CANÓNICOS: siempre locales para la demo.
        # Estas frases forman parte de la batería de validación y no deben depender
        # de Groq/OpenRouter. Las preguntas libres relacionadas siguen más abajo.
        normalized_local_advice_query = QueryNormalizer.normalize(query.corrected).strip()
        local_advice_markers = (
            "que deberia mejorar primero",
            "que gastos deberia revisar",
            "como puedo mejorar mi capacidad de ahorro",
            "que puedo hacer para reducir mis gastos",
            "que puedo hacer para mejorar mi situacion financiera",
            "como puedo ordenar mejor mis deudas",
            "armar un presupuesto mensual",
            "ayudarme a armar un presupuesto",
        )
        if any(marker in normalized_local_advice_query for marker in local_advice_markers):
            analysis = self._get_analysis(usuario_id)
            inferred_local_intent = (
                Intent.BUDGET
                if "presupuesto" in normalized_local_advice_query
                else Intent.RECOMMENDATIONS
            )
            local_advice = self._local_recommendation_or_budget_response(
                query.corrected,
                intent=inferred_local_intent,
                analysis=analysis,
            )
            if local_advice is not None:
                response = self._internal_response(
                    local_advice,
                    inferred_local_intent,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = (
                    "budget_local_priority"
                    if inferred_local_intent == Intent.BUDGET
                    else "recommendations_local_priority"
                )
                return response

        # Las definiciones educativas canónicas (preguntas 23-30) también son locales.
        # Las tarjetas de Educación Financiera ya fueron resueltas arriba mediante
        # education_topic; este bloque cubre las mismas definiciones escritas a mano.
        # Las definiciones educativas canónicas escritas como pregunta inicial son
        # locales. Un "Explícame más" NO debe entrar acá, porque podría venir de una
        # respuesta libre de Groq que sólo menciona incidentalmente un concepto como
        # "fondo de emergencia".
        normalized_local_education_query = QueryNormalizer.normalize(query.corrected).strip()
        local_education_expand_terms = {
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
        local_education = None
        if normalized_local_education_query not in local_education_expand_terms:
            local_education = self._local_financial_education_response(
                query.corrected,
                previous_answer=None,
            )

        if (
            early_intent.intent == Intent.FINANCIAL_EDUCATION
            and local_education is not None
        ):
            response = self._internal_response(
                local_education,
                Intent.FINANCIAL_EDUCATION,
                query,
                used_financial_context=False,
            )
            response.metadata["route"] = "financial_education_local"
            return response

        # Follow-up educativo determinístico para DÉFICIT.
        # Debe resolverse ANTES del flujo general de educación financiera,
        # porque "Explícame más" puede clasificarse como FINANCIAL_EDUCATION
        # y, de otro modo, llamar a Groq antes del responder determinístico.
        early_follow_up = QueryNormalizer.normalize(query.corrected).strip()
        early_previous = QueryNormalizer.normalize(previous_answer or "")
        if (
            previous_answer
            and early_follow_up in {
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
            and "deficit" in early_previous
        ):
            content = (
                "Un **déficit** ocurre cuando, durante un período, tus gastos superan tus ingresos.\n\n"
                "La diferencia entre ambos representa el monto que falta para equilibrar ese período. "
                "Por ejemplo, si ingresas **$4.000** y gastas **$4.500**, tienes un déficit de **$500**.\n\n"
                "Un déficit puntual no significa necesariamente un problema permanente. "
                "Si se repite durante varios períodos, puede reducir el ahorro disponible o hacer necesario "
                "cubrir la diferencia con ahorros, deuda u otros recursos.\n\n"
                "El déficit describe el resultado de un período concreto y no debe confundirse con la "
                "capacidad de ahorro mensual estimada, que es una métrica diferente."
            )
            response = self._internal_response(
                content,
                Intent.FINANCIAL_EDUCATION,
                query,
                used_financial_context=False,
            )
            response.metadata["route"] = "deficit_follow_up_early_deterministic"
            return response

        # Educación financiera tiene un flujo propio y prioritario. Una vez
        # reconocida esta intención, enseña primero y usa el contexto financiero
        # antes de cualquier flujo operativo de gastos, ahorro, deuda o metas.
        early_explicit_expand = (
            previous_answer
            and QueryNormalizer.normalize(query.corrected).strip()
            in {
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
        )

        if (
            early_intent.intent == Intent.FINANCIAL_EDUCATION
            and not early_explicit_expand
        ):
            analysis = self._get_analysis(usuario_id)
            rules = FinancialRulesEngine.evaluate(analysis)
            education_context = self.context_builder.build(
                intent=Intent.FINANCIAL_EDUCATION,
                analysis=analysis,
                rules=rules,
            )

            messages = PromptBuilder.build(
                original_question=query.original,
                processed_question=query.corrected,
                corrections=query.corrections,
                context=education_context,
                intent=Intent.FINANCIAL_EDUCATION.value,
            )
            response = await self.llm.generate(messages=messages, provider=provider)
            response.metadata.update(
                {
                    "intent": Intent.FINANCIAL_EDUCATION.value,
                    "route": AgentRoute.LLM_WITH_CONTEXT.value,
                    "used_financial_context": True,
                    "corrections_count": len(query.corrections),
                }
            )

            # Las preguntas educativas sobre crypto conservan el easter egg,
            # pero la explicación financiera sigue siendo la respuesta principal.
            if crypto_king_query:
                first_crypto_for_user = usuario_id not in self._crypto_king_seen_users
                show_crypto_king = first_crypto_for_user or random.random() < 0.25
                self._crypto_king_seen_users.add(usuario_id)

                if show_crypto_king:
                    response.content = (
                        "👑 Ah... veo que has venido a consultar al Rey de las Crypto.\n\n"
                        f"{response.content}\n\n"
                        "!audio[finsi-crypto](/images/task/finsi-crypto.mp3)"
                    )
                    response.metadata["easter_egg"] = "finsi_crypto"
                    response.metadata["crypto_king_decorated"] = True
                else:
                    response.metadata["crypto_king_decorated"] = False

            return response


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
            # Si la consulta educativa se escribió manualmente, el frontend no tiene
            # education_topic para reenviarlo. Recuperamos el tema únicamente a partir
            # de la firma específica de la respuesta contextual generada por Finsi.
            inferred_previous_education_topic = (
                self._infer_education_topic_from_previous_answer(previous_answer)
            )
            if inferred_previous_education_topic is not None:
                education_follow_up = self._education_topic_response(
                    usuario_id=usuario_id,
                    topic=inferred_previous_education_topic,
                    question=query.corrected,
                )
                if education_follow_up is not None:
                    response = self._internal_response(
                        education_follow_up,
                        Intent.FINANCIAL_EDUCATION,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "education_topic_follow_up_inferred"
                    response.metadata["education_topic"] = inferred_previous_education_topic
                    return response

            # Primero preservamos respuestas financieras estructuradas. Así evitamos
            # que una mención incidental a "fondo de emergencia", "déficit", etc.
            # dentro de un resumen sea interpretada como el tema principal educativo.
            normalized_previous_summary_priority = QueryNormalizer.normalize(previous_answer)

            if (
                "resumen" in normalized_previous_summary_priority
                and "ingresos mensuales" in normalized_previous_summary_priority
                and "gastos mensuales" in normalized_previous_summary_priority
                and "perfil financiero" in normalized_previous_summary_priority
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")
                deuda = metrics.get("deuda_mensual")
                ratio_deuda = metrics.get("ratio_deuda_ingreso")
                perfil = analysis.get("perfil_financiero") if isinstance(analysis, dict) else None
                riesgo = analysis.get("nivel_riesgo") if isinstance(analysis, dict) else None
                score = analysis.get("financial_score") if isinstance(analysis, dict) else None

                parts: list[str] = []
                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    if ingreso_d > 0:
                        ratio_gasto = (gasto_d / ingreso_d * Decimal("100")).quantize(
                            Decimal("0.1"), rounding=ROUND_HALF_UP
                        )
                        ratio_gasto_text = str(ratio_gasto).replace(".", ",")
                        parts.append(
                            f"Tus ingresos mensuales son **{self._format_money(ingreso_d)}** y tus gastos "
                            f"mensuales son **{self._format_money(gasto_d)}**, equivalentes aproximadamente "
                            f"al **{ratio_gasto_text}% de tus ingresos**."
                        )

                if ahorro is not None:
                    parts.append(
                        f"El margen mensual estimado es **{self._format_money(Decimal(str(ahorro)))}**."
                    )

                if deuda is not None:
                    deuda_text = (
                        f"Tu deuda mensual registrada es "
                        f"**{self._format_money(Decimal(str(deuda)))}**"
                    )
                    if ratio_deuda is not None:
                        ratio = Decimal(str(ratio_deuda))
                        if ratio <= 1:
                            ratio *= Decimal("100")
                        ratio = ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        deuda_text += (
                            f", equivalente al **{str(ratio).replace('.', ',')}% de tus ingresos**"
                        )
                    parts.append(deuda_text + ".")

                if perfil or riesgo or score is not None:
                    estado = []
                    if perfil:
                        estado.append(f"perfil **{perfil}**")
                    if riesgo:
                        estado.append(f"riesgo **{riesgo}**")
                    if score is not None:
                        estado.append(f"puntaje **{score}**")
                    parts.append(
                        "En conjunto, estos indicadores se reflejan en tu "
                        + ", ".join(estado)
                        + "."
                    )

                response = self._internal_response(
                    "\n\n".join(parts),
                    Intent.FULL_ANALYSIS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "full_analysis_follow_up_priority"
                return response

            # Si no era una respuesta financiera estructurada, recién entonces
            # intentamos reconocer un concepto educativo libre por su contenido.
            # Sólo ampliar localmente educación cuando la respuesta anterior tiene
            # una firma reconocible de una respuesta educativa local. Si una respuesta
            # libre de Groq menciona "fondo de emergencia", "ETF", etc., el follow-up
            # debe continuar por Groq con contexto y no ser secuestrado por educación.
            previous_education_signature = self._infer_education_topic_from_previous_answer(
                previous_answer
            )
            local_education_follow_up = None
            if previous_education_signature is not None:
                local_education_follow_up = self._local_financial_education_response(
                    query.corrected,
                    previous_answer=previous_answer,
                )

            if local_education_follow_up is not None:
                response = self._internal_response(
                    local_education_follow_up,
                    Intent.FINANCIAL_EDUCATION,
                    query,
                    used_financial_context=False,
                )
                response.metadata["route"] = "financial_education_follow_up_local"
                return response

            # Follow-up determinístico para la fecha actual. Evita que "Explícame más"
            # después de "¿Qué día es hoy?" caiga en el resumen financiero genérico.
            normalized_previous_date = QueryNormalizer.normalize(previous_answer).strip()
            if re.match(
                r"^hoy es (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo) "
                r"\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) "
                r"de \d{4}\.?$",
                normalized_previous_date,
            ):
                local_today = self._today_for_time_zone(time_zone)
                content = (
                    f"La fecha corresponde al día local de tu navegador: **{local_today.strftime('%d/%m/%Y')}**. "
                    "FinSightAI usa esa fecha local para interpretar consultas como **este mes**, **hoy** "
                    "o **hasta hoy**, evitando incluir movimientos de fechas futuras."
                )
                response = self._internal_response(
                    content,
                    Intent.UNKNOWN,
                    query,
                    used_financial_context=False,
                )
                response.metadata["route"] = "local_date_follow_up_deterministic"
                return response

            # Follow-up local para recomendaciones y presupuesto.
            # Evita que "Explícame más" vuelva a depender de Groq/OpenRouter.
            normalized_previous_advice = QueryNormalizer.normalize(previous_answer)
            advice_follow_up_markers = (
                "revisar el gasto de mayor peso",
                "deberias revisar principalmente",
                "revisa con mayor detalle las tres categorias",
                "para mejorar tu capacidad de ahorro",
                "para reducir tus gastos",
                "tus prioridades actuales pueden ordenarse",
                "para ordenar mejor tus deudas",
                "base para tu presupuesto mensual",
                "empieza controlando",
            )
            if any(marker in normalized_previous_advice for marker in advice_follow_up_markers):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                deuda = metrics.get("deuda_mensual")
                ahorro = metrics.get("ahorro_mensual_estimado")
                ratio_gasto = metrics.get("ratio_gasto_ingreso")
                ratio_deuda = metrics.get("ratio_deuda_ingreso")

                def local_pct(value: Any) -> str | None:
                    if value is None:
                        return None
                    try:
                        number = Decimal(str(value))
                    except (InvalidOperation, ValueError, TypeError):
                        return None
                    if abs(number) <= Decimal("1"):
                        number *= Decimal("100")
                    number = number.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                    return str(number).replace(".", ",")

                gasto_pct = local_pct(ratio_gasto)
                deuda_pct = local_pct(ratio_deuda)

                categorias = analysis.get("categorias_principales") if isinstance(analysis, dict) else []
                categorias = categorias if isinstance(categorias, list) else []
                cat_parts = []
                for item in categorias[:3]:
                    if not isinstance(item, dict):
                        continue
                    nombre = str(item.get("categoria") or "").strip()
                    monto = item.get("monto")
                    porcentaje = item.get("porcentaje")
                    if not nombre:
                        continue
                    detalle = f"**{nombre}**"
                    if monto is not None:
                        detalle += f" ({self._format_money(Decimal(str(monto)))}"
                        if porcentaje is not None:
                            try:
                                p = Decimal(str(porcentaje)).quantize(
                                    Decimal("1"), rounding=ROUND_HALF_UP
                                )
                                detalle += f", {p}% del gasto"
                            except (InvalidOperation, ValueError, TypeError):
                                pass
                        detalle += ")"
                    cat_parts.append(detalle)

                parts = []
                if cat_parts:
                    parts.append(
                        "Las áreas con mayor impacto son " + ", ".join(cat_parts) + "."
                    )

                if ingreso is not None and gasto is not None:
                    sentence = (
                        f"Tus ingresos mensuales son **{self._format_money(Decimal(str(ingreso)))}** "
                        f"y tus gastos mensuales son **{self._format_money(Decimal(str(gasto)))}**"
                    )
                    if gasto_pct:
                        sentence += f", aproximadamente el **{gasto_pct}% de tus ingresos**"
                    parts.append(sentence + ".")

                if deuda is not None:
                    sentence = (
                        f"Tu deuda mensual registrada es **{self._format_money(Decimal(str(deuda)))}**"
                    )
                    if deuda_pct:
                        sentence += f", aproximadamente el **{deuda_pct}% de tus ingresos**"
                    parts.append(sentence + ".")

                if ahorro is not None:
                    parts.append(
                        f"El margen mensual estimado es **{self._format_money(Decimal(str(ahorro)))}**. "
                        "Cualquier ajuste sostenible del gasto aumenta ese margen, siempre que los ingresos "
                        "y las demás obligaciones se mantengan."
                    )

                debt_topic_markers = (
                    "ordenar mejor tus deudas",
                    "ordenar mis deudas",
                    "saldo pendiente, tasa o costo",
                    "prioriza las obligaciones de mayor costo",
                )
                budget_topic_markers = (
                    "base para tu presupuesto mensual",
                    "armar un presupuesto mensual",
                    "empieza controlando",
                    "el objetivo del presupuesto",
                )

                if any(marker in normalized_previous_advice for marker in debt_topic_markers):
                    parts.append(
                        "Para decidir el orden exacto de pago todavía hacen falta saldo pendiente, tasa o costo "
                        "y plazo de cada deuda; sin esos datos FinSightAI no debería inventar una prioridad específica."
                    )
                elif any(marker in normalized_previous_advice for marker in budget_topic_markers):
                    parts.append(
                        "En un presupuesto, esos valores sirven como punto de partida: el objetivo es asignar límites "
                        "por categoría y mantener el total de gastos dentro del ingreso disponible."
                    )
                else:
                    parts.append(
                        "La prioridad es actuar primero sobre los rubros de mayor peso y medir el efecto de cada cambio "
                        "antes de asumir nuevos objetivos o compromisos."
                    )

                content = "\n\n".join(parts)
                response = self._internal_response(
                    content,
                    Intent.RECOMMENDATIONS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "recommendations_follow_up_local"
                return response

            # Follow-up determinístico para totales REALES del mes actual.
            # Debe ir antes de los handlers de métricas mensuales del Dashboard para
            # no convertir "gasté/ingresé este mes" en promedios del análisis general.
            current_month_follow_up = self._current_month_transaction_follow_up_response(
                usuario_id=usuario_id,
                previous_answer=previous_answer,
                today=self._today_for_time_zone(time_zone),
            )
            if current_month_follow_up is not None:
                response = self._internal_response(
                    current_month_follow_up,
                    Intent.EXPENSES
                    if "gastaste" in QueryNormalizer.normalize(previous_answer)
                    else Intent.INCOME,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "current_month_transaction_follow_up"
                return response

            # Follow-up determinístico para períodos relativos de gasto.
            # Debe evaluarse antes del handler de "último gasto", porque respuestas
            # como "No tuviste gastos ayer. Tu último gasto fue..." contienen ambas cosas.
            normalized_previous_period = QueryNormalizer.normalize(previous_answer)

            if "no tuviste gastos registrados ayer" in normalized_previous_period:
                local_today_period = self._today_for_time_zone(time_zone)
                yesterday = local_today_period.fromordinal(local_today_period.toordinal() - 1)
                content = (
                    f"Ayer, **{yesterday.strftime('%d/%m/%Y')}**, no tuviste gastos registrados.\n\n"
                    "Por eso el total de gastos de ese día fue **$0,00**. "
                    "La mención al último gasto disponible solo sirve como referencia adicional "
                    "y corresponde a una fecha anterior, no a ayer."
                )
                response = self._internal_response(
                    content,
                    Intent.EXPENSES,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "yesterday_expenses_follow_up_deterministic"
                return response

            week_total_match = re.search(
                r"Gastaste\s+(\$[\d\.]+,\d{2})\s+esta semana en\s+(\d+)\s+movimiento",
                previous_answer,
                flags=re.IGNORECASE,
            )
            if week_total_match:
                amount = week_total_match.group(1)
                count = int(week_total_match.group(2))
                local_today_period = self._today_for_time_zone(time_zone)
                week_start = local_today_period.fromordinal(
                    local_today_period.toordinal() - local_today_period.weekday()
                )
                movement_word = "movimiento" if count == 1 else "movimientos"
                content = (
                    f"Esta semana, desde el **{week_start.strftime('%d/%m/%Y')}** hasta el "
                    f"**{local_today_period.strftime('%d/%m/%Y')}**, llevas registrados "
                    f"**{amount}** en gastos, distribuidos en **{count} {movement_word}**.\n\n"
                    "El cálculo usa únicamente las transacciones registradas dentro de la semana actual "
                    "hasta hoy; no corresponde al promedio mensual del análisis general."
                )
                response = self._internal_response(
                    content,
                    Intent.EXPENSES,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "current_week_expenses_follow_up_deterministic"
                return response

            # Follow-up determinístico para ÚLTIMO GASTO / ÚLTIMO INGRESO.
            # Conserva la transacción puntual de la respuesta anterior y evita
            # caer al resumen financiero genérico.
            latest_transaction_match = re.search(
                r"Tu último (gasto|ingreso) fue\s+(\$[\d\.]+,\d{2})\s+por\s+(.+?)\s+\((.+?)\)\s+el\s+(\d{2}/\d{2}/\d{4})\.?",
                previous_answer,
                flags=re.IGNORECASE,
            )
            if latest_transaction_match:
                movement_type = latest_transaction_match.group(1).lower()
                amount = latest_transaction_match.group(2)
                description = latest_transaction_match.group(3).strip()
                category = latest_transaction_match.group(4).strip()
                movement_date = latest_transaction_match.group(5)

                if movement_type == "gasto":
                    content = (
                        f"Tu último gasto registrado hasta la fecha consultada fue **{amount}** "
                        f"por **{description}**, dentro de la categoría **{category}**, "
                        f"el **{movement_date}**.\n\n"
                        "Al decir **último gasto**, FinSightAI toma la transacción de gasto "
                        "más reciente por fecha dentro de tus movimientos registrados. "
                        "No significa que sea tu gasto de mayor monto."
                    )
                    follow_up_intent = Intent.EXPENSES
                    follow_up_route = "latest_expense_follow_up_deterministic"
                else:
                    content = (
                        f"Tu último ingreso registrado hasta la fecha consultada fue **{amount}** "
                        f"por **{description}**, dentro de la categoría **{category}**, "
                        f"el **{movement_date}**.\n\n"
                        "Al decir **último ingreso**, FinSightAI toma la transacción de ingreso "
                        "más reciente por fecha dentro de tus movimientos registrados. "
                        "Este dato corresponde a una transacción puntual y no al ingreso mensual "
                        "promedio del análisis general."
                    )
                    follow_up_intent = Intent.INCOME
                    follow_up_route = "latest_income_follow_up_deterministic"

                response = self._internal_response(
                    content,
                    follow_up_intent,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = follow_up_route
                return response

            # Follow-up determinístico para INGRESOS / GASTOS mensuales.
            normalized_previous_metric = QueryNormalizer.normalize(previous_answer)

            if "tu ingreso mensual registrado es" in normalized_previous_metric:
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}
                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")

                parts = []
                if ingreso is not None:
                    parts.append(
                        f"Tu ingreso mensual registrado es **{self._format_money(Decimal(str(ingreso)))}**."
                    )
                if gasto is not None and ingreso is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    if ingreso_d > 0:
                        pct = (gasto_d / ingreso_d * Decimal("100")).quantize(
                            Decimal("0.1"), rounding=ROUND_HALF_UP
                        )
                        parts.append(
                            f"De ese ingreso, tus gastos mensuales representan aproximadamente "
                            f"el **{str(pct).replace('.', ',')}%**."
                        )
                if ahorro is not None:
                    parts.append(
                        f"El margen mensual estimado después de gastos es "
                        f"**{self._format_money(Decimal(str(ahorro)))}**."
                    )
                response = self._internal_response(
                    "\n\n".join(parts),
                    Intent.INCOME,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "income_follow_up_deterministic"
                return response

            if "tu gasto mensual promedio es" in normalized_previous_metric:
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}
                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")

                parts = []
                if gasto is not None:
                    parts.append(
                        f"Tu gasto mensual promedio es **{self._format_money(Decimal(str(gasto)))}**."
                    )
                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    if ingreso_d > 0:
                        pct = (gasto_d / ingreso_d * Decimal("100")).quantize(
                            Decimal("0.1"), rounding=ROUND_HALF_UP
                        )
                        parts.append(
                            f"Ese gasto equivale aproximadamente al "
                            f"**{str(pct).replace('.', ',')}% de tus ingresos**."
                        )
                if ahorro is not None:
                    parts.append(
                        f"Con tus valores actuales, el margen mensual estimado es "
                        f"**{self._format_money(Decimal(str(ahorro)))}**."
                    )
                response = self._internal_response(
                    "\n\n".join(parts),
                    Intent.EXPENSES,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "expenses_follow_up_deterministic"
                return response

            # Antes de enviar "Explícame más" al LLM, intenta conservar un contexto
            # transaccional real de la respuesta anterior. Esto evita mezclar, por
            # ejemplo, el ahorro real de un mes con las métricas promedio del análisis.
            try:
                transactions = fetch_user_transactions(usuario_id)

                try:
                    analysis_for_follow_up = fetch_live_analysis(usuario_id)
                except (BackendDataError, ValueError):
                    analysis_for_follow_up = None

                try:
                    profile = fetch_user_profile(usuario_id)
                    user_name = str(profile.get("nombre") or "").strip() or None
                except (BackendDataError, ValueError):
                    user_name = None

                transaction_follow_up = TransactionQueryEngine.answer(
                    query.corrected,
                    transactions,
                    user_name=user_name,
                    analysis=analysis_for_follow_up,
                    previous_answer=previous_answer,
                    today=self._today_for_time_zone(time_zone),
                )

                if transaction_follow_up is not None:
                    response = self._internal_response(
                        transaction_follow_up.content,
                        early_intent.intent
                        if early_intent.intent != Intent.UNKNOWN
                        else Intent.SAVINGS,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "transaction_contextual_follow_up"
                    response.metadata["transaction_action"] = (
                        transaction_follow_up.action
                    )
                    return response

            except (BackendDataError, ValueError):
                pass

            largest_expense_follow_up = self._largest_expense_follow_up_response(
                usuario_id=usuario_id,
                previous_answer=previous_answer,
            )
            if largest_expense_follow_up is not None:
                response = self._internal_response(
                    largest_expense_follow_up,
                    Intent.EXPENSES,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "largest_expense_follow_up_deterministic"
                return response

            debt_follow_up = self._debt_follow_up_response(
                usuario_id=usuario_id,
                previous_answer=previous_answer,
            )
            if debt_follow_up is not None:
                response = self._internal_response(
                    debt_follow_up,
                    Intent.DEBT,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "debt_follow_up_deterministic"
                return response

            # Follow-up determinístico para educación financiera: DÉFICIT.
            # Evita depender de Groq cuando el usuario pide "Explícame más"
            # después de una definición de déficit.
            normalized_previous_education = QueryNormalizer.normalize(previous_answer)
            deficit_follow_up_markers = (
                "el deficit es la situacion",
                "un deficit ocurre",
                "saldo negativo",
                "equilibrar el presupuesto",
            )
            if (
                "deficit" in normalized_previous_education
                and any(
                    marker in normalized_previous_education
                    for marker in deficit_follow_up_markers
                )
            ):
                content = (
                    "Un **déficit** ocurre cuando, durante un período, tus gastos superan tus ingresos.\n\n"
                    "La diferencia entre ambos representa el monto que falta para equilibrar ese período. "
                    "Por ejemplo, si ingresas **$4.000** y gastas **$4.500**, tienes un déficit de **$500**.\n\n"
                    "Un déficit puntual no significa necesariamente un problema permanente. "
                    "Sin embargo, si se repite durante varios períodos, puede reducir el ahorro disponible "
                    "o hacer necesario cubrir la diferencia con ahorros, deuda u otros recursos.\n\n"
                    "El concepto de déficit describe el resultado de un período concreto y no debe confundirse "
                    "con la capacidad de ahorro mensual estimada, que es una métrica diferente."
                )
                response = self._internal_response(
                    content,
                    Intent.FINANCIAL_EDUCATION,
                    query,
                    used_financial_context=False,
                )
                response.metadata["route"] = "deficit_follow_up_deterministic"
                return response

            # Follow-up determinístico para SAVINGS. Evita depender de Groq
            # cuando el usuario pide "Explícame más" después de una respuesta
            # sobre capacidad de ahorro mensual estimada.
            normalized_previous_savings = QueryNormalizer.normalize(previous_answer)
            savings_follow_up_markers = (
                "puedes ahorrar aproximadamente",
                "capacidad de ahorro estimada",
                "capacidad de ahorro mensual",
            )
            if any(
                marker in normalized_previous_savings
                for marker in savings_follow_up_markers
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = (
                    analysis.get("metricas")
                    if isinstance(analysis, dict)
                    else {}
                )
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")
                ratio_gasto = metrics.get("ratio_gasto_ingreso")
                ratio_ahorro = metrics.get("ratio_ahorro_ingreso")

                def savings_pct(value: Any) -> str | None:
                    if value is None:
                        return None
                    try:
                        numeric = float(value)
                    except (TypeError, ValueError):
                        return None
                    if abs(numeric) <= 1:
                        numeric *= 100
                    return f"{numeric:.1f}".replace(".", ",")

                parts: list[str] = []

                ahorro_pct = savings_pct(ratio_ahorro)
                gasto_pct = savings_pct(ratio_gasto)

                if ahorro is not None and ahorro_pct is not None:
                    parts.append(
                        f"Tu capacidad de ahorro estimada es "
                        f"**{self._format_money(Decimal(str(ahorro)))} al mes**, "
                        f"equivalente aproximadamente al **{ahorro_pct}% de tus ingresos**."
                    )
                elif ahorro is not None:
                    parts.append(
                        f"Tu capacidad de ahorro estimada es "
                        f"**{self._format_money(Decimal(str(ahorro)))} al mes**."
                    )

                if ingreso is not None and gasto is not None:
                    parts.append(
                        f"Se obtiene de la diferencia entre tus ingresos mensuales de "
                        f"**{self._format_money(Decimal(str(ingreso)))}** y tus gastos mensuales de "
                        f"**{self._format_money(Decimal(str(gasto)))}**."
                    )

                if gasto_pct is not None:
                    parts.append(
                        f"Tus gastos representan aproximadamente el **{gasto_pct}% de tus ingresos**, "
                        "por lo que el margen disponible para ahorrar es reducido."
                    )

                parts.append(
                    "Este dato corresponde a la **capacidad de ahorro mensual estimada** del análisis general "
                    "de FinSightAI y no al balance real de un mes específico."
                )

                content = "\n\n".join(parts)
                response = self._internal_response(
                    content,
                    Intent.SAVINGS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "savings_follow_up_deterministic"
                return response

            # Follow-up determinístico para RESUMEN / FULL_ANALYSIS.
            # Debe evaluarse antes de PROFILE porque el resumen también contiene
            # una línea con el perfil financiero.
            normalized_previous_summary = QueryNormalizer.normalize(previous_answer)
            if (
                "resumen" in normalized_previous_summary
                and "ingresos mensuales" in normalized_previous_summary
                and "gastos mensuales" in normalized_previous_summary
                and "perfil financiero" in normalized_previous_summary
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")
                deuda = metrics.get("deuda_mensual")
                ratio_deuda = metrics.get("ratio_deuda_ingreso")
                perfil = analysis.get("perfil_financiero") if isinstance(analysis, dict) else None
                riesgo = analysis.get("nivel_riesgo") if isinstance(analysis, dict) else None
                score = analysis.get("financial_score") if isinstance(analysis, dict) else None

                parts: list[str] = []
                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    if ingreso_d > 0:
                        ratio_gasto = (gasto_d / ingreso_d * Decimal("100")).quantize(
                            Decimal("0.1"), rounding=ROUND_HALF_UP
                        )
                        ratio_gasto_text = str(ratio_gasto).replace(".", ",")
                        parts.append(
                            f"Tus ingresos mensuales son **{self._format_money(ingreso_d)}** y tus gastos "
                            f"mensuales son **{self._format_money(gasto_d)}**, equivalentes aproximadamente "
                            f"al **{ratio_gasto_text}% de tus ingresos**."
                        )

                if ahorro is not None:
                    parts.append(
                        f"El margen mensual estimado es **{self._format_money(Decimal(str(ahorro)))}**."
                    )

                if deuda is not None:
                    deuda_text = f"Tu deuda mensual registrada es **{self._format_money(Decimal(str(deuda)))}**"
                    if ratio_deuda is not None:
                        ratio = Decimal(str(ratio_deuda))
                        if ratio <= 1:
                            ratio *= Decimal("100")
                        ratio = ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        deuda_text += f", equivalente al **{str(ratio).replace('.', ',')}% de tus ingresos**"
                    parts.append(deuda_text + ".")

                if perfil or riesgo or score is not None:
                    estado = []
                    if perfil:
                        estado.append(f"perfil **{perfil}**")
                    if riesgo:
                        estado.append(f"riesgo **{riesgo}**")
                    if score is not None:
                        estado.append(f"puntaje **{score}**")
                    parts.append(
                        "En conjunto, estos indicadores se reflejan en tu "
                        + ", ".join(estado)
                        + "."
                    )

                content = "\n\n".join(parts)
                response = self._internal_response(
                    content,
                    Intent.FULL_ANALYSIS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "full_analysis_follow_up_deterministic"
                return response

            # Follow-up determinístico para PROFILE. Evita depender de Groq
            # cuando el usuario pide "Explícame más" después de consultar o
            # explicar su perfil financiero.
            normalized_previous_profile = QueryNormalizer.normalize(previous_answer)
            profile_follow_up_markers = (
                "tu perfil financiero actual es",
                "tu perfil esta clasificado como",
                "tu perfil financiero es",
                "perfil en riesgo",
                "nivel de riesgo es critico",
            )
            if any(
                marker in normalized_previous_profile
                for marker in profile_follow_up_markers
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = (
                    analysis.get("metricas")
                    if isinstance(analysis, dict)
                    else {}
                )
                metrics = metrics if isinstance(metrics, dict) else {}

                perfil = str(
                    analysis.get("perfil_financiero") or "Sin clasificar"
                )
                riesgo = str(
                    analysis.get("nivel_riesgo") or "Sin clasificar"
                )
                score = analysis.get("financial_score")
                status = analysis.get("score_status")

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                deuda = metrics.get("deuda_mensual")
                ahorro = metrics.get("ahorro_mensual_estimado")
                ratio_gasto = metrics.get("ratio_gasto_ingreso")
                ratio_deuda = metrics.get("ratio_deuda_ingreso")
                ratio_ahorro = metrics.get("ratio_ahorro_ingreso")

                def pct(value: Any) -> str | None:
                    if value is None:
                        return None
                    try:
                        numeric = float(value)
                    except (TypeError, ValueError):
                        return None
                    if abs(numeric) <= 1:
                        numeric *= 100
                    return f"{numeric:.1f}".replace(".", ",")

                parts: list[str] = [
                    f"Tu perfil financiero es **{perfil}** y tu nivel de riesgo es **{riesgo}**."
                ]

                indicadores: list[str] = []
                gasto_pct = pct(ratio_gasto)
                deuda_pct = pct(ratio_deuda)
                ahorro_pct = pct(ratio_ahorro)

                if ingreso is not None and gasto is not None and gasto_pct is not None:
                    indicadores.append(
                        f"tus gastos mensuales son {self._format_money(Decimal(str(gasto)))} "
                        f"sobre ingresos de {self._format_money(Decimal(str(ingreso)))}, "
                        f"aproximadamente el {gasto_pct}%"
                    )
                if deuda is not None and deuda_pct is not None:
                    indicadores.append(
                        f"la deuda mensual es {self._format_money(Decimal(str(deuda)))} "
                        f"y representa aproximadamente el {deuda_pct}% de tus ingresos"
                    )
                if ahorro is not None and ahorro_pct is not None:
                    indicadores.append(
                        f"tu capacidad de ahorro estimada es "
                        f"{self._format_money(Decimal(str(ahorro)))} al mes, "
                        f"aproximadamente el {ahorro_pct}% de tus ingresos"
                    )

                if indicadores:
                    parts.append(
                        "Los indicadores que más explican esa clasificación son: "
                        + "; ".join(indicadores)
                        + "."
                    )

                if score is not None:
                    score_text = f"Tu puntaje financiero es **{score}**"
                    if status:
                        score_text += f" (**{status}**)"
                    score_text += (
                        ", y resume la combinación de gasto, deuda y capacidad de ahorro "
                        "que FinSightAI observa en tu situación actual."
                    )
                    parts.append(score_text)

                categorias = (
                    analysis.get("categorias_principales", [])
                    if isinstance(analysis, dict)
                    else []
                )
                if isinstance(categorias, list) and categorias:
                    top = []
                    for item in categorias[:3]:
                        if not isinstance(item, dict):
                            continue
                        categoria = str(item.get("categoria") or "").strip()
                        porcentaje = item.get("porcentaje")
                        if not categoria or porcentaje is None:
                            continue
                        try:
                            pct_cat = round(float(porcentaje))
                        except (TypeError, ValueError):
                            continue
                        top.append(f"{categoria} ({pct_cat}% del gasto total)")
                    if top:
                        parts.append(
                            "Las categorías principales muestran dónde se concentra el gasto: "
                            + ", ".join(top)
                            + ". Sus porcentajes son sobre el gasto total, no sobre el ingreso."
                        )

                content = "\n\n".join(parts)
                response = self._internal_response(
                    content,
                    Intent.PROFILE,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "profile_follow_up_deterministic"
                return response

            # Follow-up determinístico para PRINCIPALES CATEGORÍAS.
            # Mantiene el foco en las categorías mostradas en la respuesta anterior
            # y evita caer al resumen financiero genérico.
            normalized_previous_categories = QueryNormalizer.normalize(previous_answer)
            if (
                "tus tres categorias principales son" in normalized_previous_categories
                or "tus tres categorias de gasto principales son" in normalized_previous_categories
                or "tus tres categorias de gastos principales son" in normalized_previous_categories
                or "principales categorias de gastos" in normalized_previous_categories
            ):
                analysis = self._get_analysis(usuario_id)
                categorias = (
                    analysis.get("categorias_principales", [])
                    if isinstance(analysis, dict)
                    else []
                )

                parts: list[str] = []
                if isinstance(categorias, list):
                    for item in categorias[:3]:
                        if not isinstance(item, dict):
                            continue

                        nombre = str(item.get("categoria") or "").strip()
                        monto = item.get("monto")
                        porcentaje = item.get("porcentaje")

                        if not nombre:
                            continue

                        detalle = f"**{nombre}**"
                        if monto is not None:
                            detalle += f": **{self._format_money(Decimal(str(monto)))}**"

                        if porcentaje is not None:
                            try:
                                pct_value = Decimal(str(porcentaje))
                                pct_value = pct_value.quantize(
                                    Decimal("0.1"), rounding=ROUND_HALF_UP
                                )
                                pct_text = str(pct_value).replace(".", ",")
                                if pct_text.endswith(",0"):
                                    pct_text = pct_text[:-2]
                                detalle += f", aproximadamente el **{pct_text}% del gasto total**"
                            except (InvalidOperation, ValueError, TypeError):
                                pass

                        parts.append(detalle + ".")

                if parts:
                    parts.insert(
                        0,
                        "Estas son las categorías que concentran la mayor parte de tus gastos actuales:"
                    )
                    parts.append(
                        "Los porcentajes indican qué parte de tu **gasto total** corresponde a cada categoría. "
                        "No representan el porcentaje de tus ingresos."
                    )
                    parts.append(
                        "Revisarlas por separado permite entender dónde se concentra tu gasto sin asumir "
                        "que todos los movimientos de esas categorías sean reducibles o prescindibles."
                    )

                    response = self._internal_response(
                        "\n\n".join(parts),
                        Intent.EXPENSES,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "top_categories_follow_up_deterministic"
                    return response

            # Follow-up determinístico para PORCENTAJE DE INGRESOS GASTADO.
            # Explica específicamente la relación gasto/ingreso en vez de devolver
            # el resumen financiero genérico.
            normalized_previous_spending_ratio = QueryNormalizer.normalize(previous_answer)
            spending_ratio_markers = (
                "estas gastando aproximadamente el",
                "estas gastando el",
                "estas destinando el",
                "estas destinando aproximadamente el",
                "porcentaje de mis ingresos",
                "gasto mensual promedio",
                "gasto promedio",
                "saldo despues de los gastos",
            )
            if (
                "ingreso mensual" in normalized_previous_spending_ratio
                and "gasto" in normalized_previous_spending_ratio
                and any(
                    marker in normalized_previous_spending_ratio
                    for marker in spending_ratio_markers
                )
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                ahorro = metrics.get("ahorro_mensual_estimado")

                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))

                    if ingreso_d > 0:
                        ratio = (gasto_d / ingreso_d * Decimal("100")).quantize(
                            Decimal("0.1"), rounding=ROUND_HALF_UP
                        )
                        ratio_text = str(ratio).replace(".", ",")

                        if ahorro is not None:
                            margen_d = Decimal(str(ahorro))
                        else:
                            margen_d = ingreso_d - gasto_d

                        margen_ratio = (
                            margen_d / ingreso_d * Decimal("100")
                        ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                        margen_ratio_text = str(margen_ratio).replace(".", ",")

                        content = (
                            f"Estás destinando aproximadamente el **{ratio_text}% de tus ingresos a gastos**.\n\n"
                            f"Esto surge de comparar tus gastos mensuales de "
                            f"**{self._format_money(gasto_d)}** con tus ingresos mensuales de "
                            f"**{self._format_money(ingreso_d)}**.\n\n"
                            f"Después de esos gastos queda un margen estimado de "
                            f"**{self._format_money(margen_d)}**, equivalente aproximadamente al "
                            f"**{margen_ratio_text}% de tus ingresos**.\n\n"
                            "En otras palabras, la mayor parte de tus ingresos ya está comprometida por tus "
                            "gastos actuales, aunque el balance mensual estimado todavía es positivo."
                        )

                        response = self._internal_response(
                            content,
                            Intent.EXPENSES,
                            query,
                            used_financial_context=True,
                        )
                        response.metadata["route"] = "spending_ratio_follow_up_deterministic"
                        return response

            # Follow-up determinístico prioritario para categoría de mayor gasto.
            # Conserva exactamente categoría y monto de la respuesta anterior.
            normalized_previous_top_category = QueryNormalizer.normalize(previous_answer)
            if (
                "categoria en la que mas gastaste fue" in normalized_previous_top_category
                or "categoria con mayor gasto" in normalized_previous_top_category
                or "categoria de mayor gasto" in normalized_previous_top_category
            ):
                category_match = re.search(
                    r"categor(?:ia|ía).*?(?:es|fue)\s+\*\*?([^,*\n]+?)\*\*?,?\s+con\s+\*\*?\$([\d\.]+,\d{2})",
                    previous_answer,
                    flags=re.IGNORECASE,
                )
                if category_match:
                    categoria = category_match.group(1).strip().strip("*")
                    monto = category_match.group(2).strip()
                    content = (
                        f"Tu categoría con mayor gasto es **{categoria}**, con **${monto}**. "
                        "Ese monto corresponde al mismo período y conjunto de movimientos usados en la respuesta anterior. "
                        "Representa la suma de los gastos clasificados en esa categoría, no una única compra."
                    )
                    response = self._internal_response(
                        content,
                        Intent.TOP_EXPENSE_CATEGORY,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "top_expense_category_reuse_previous"
                    return response

            # Follow-ups determinísticos adicionales para respuestas financieras
            # frecuentes. Si reconocemos el tipo de respuesta anterior, ampliamos
            # con datos reales y evitamos depender de Groq.
            normalized_previous_generic = QueryNormalizer.normalize(previous_answer)

            # Categoría de mayor gasto acumulado.
            if (
                "categoria en la que mas gastaste fue" in normalized_previous_generic
                or "categoria de mayor gasto es" in normalized_previous_generic
                or "categoria con mas gastos" in normalized_previous_generic
            ):
                analysis = self._get_analysis(usuario_id)
                categorias = (
                    analysis.get("categorias_principales", [])
                    if isinstance(analysis, dict)
                    else []
                )

                if isinstance(categorias, list) and categorias:
                    principal = next(
                        (
                            item for item in categorias
                            if isinstance(item, dict)
                            and str(item.get("categoria") or "").strip()
                        ),
                        None,
                    )
                else:
                    principal = None

                if isinstance(principal, dict):
                    nombre = str(principal.get("categoria") or "").strip()
                    monto = principal.get("monto")
                    porcentaje = principal.get("porcentaje")

                    parts = [
                        f"Tu categoría con mayor gasto acumulado es **{nombre}**"
                        + (
                            f", con **{self._format_money(Decimal(str(monto)))}**."
                            if monto is not None
                            else "."
                        )
                    ]

                    if porcentaje is not None:
                        try:
                            pct_value = float(porcentaje)
                            pct_text = (
                                f"{pct_value:.0f}"
                                if float(pct_value).is_integer()
                                else f"{pct_value:.1f}".replace(".", ",")
                            )
                            parts.append(
                                f"Esa categoría representa aproximadamente el **{pct_text}% del gasto total**."
                            )
                        except (TypeError, ValueError):
                            pass

                    parts.append(
                        "Este dato representa la suma de las transacciones clasificadas en esa categoría, "
                        "no una única compra."
                    )

                    content = "\n\n".join(parts)
                    response = self._internal_response(
                        content,
                        Intent.TOP_EXPENSE_CATEGORY,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "top_expense_category_follow_up_deterministic"
                    return response

            # Resumen general de situación financiera.
            if (
                "resumen" in normalized_previous_generic
                and (
                    "ingresos mensuales" in normalized_previous_generic
                    or "gastos mensuales" in normalized_previous_generic
                )
                and "perfil financiero" in normalized_previous_generic
            ):
                analysis = self._get_analysis(usuario_id)
                content = DeterministicFinancialResponder.full_analysis(analysis)
                response = self._internal_response(
                    content,
                    Intent.FULL_ANALYSIS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "full_analysis_follow_up_deterministic"
                return response

            # Puntaje financiero.
            if (
                "puntaje financiero actual es" in normalized_previous_generic
                or "puntaje financiero es" in normalized_previous_generic
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                score = analysis.get("financial_score") if isinstance(analysis, dict) else None
                status = analysis.get("score_status") if isinstance(analysis, dict) else None
                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")
                deuda = metrics.get("deuda_mensual")
                ahorro = metrics.get("ahorro_mensual_estimado")
                ratio_gasto = metrics.get("ratio_gasto_ingreso")
                ratio_deuda = metrics.get("ratio_deuda_ingreso")
                ratio_ahorro = metrics.get("ratio_ahorro_ingreso")

                def _pct_local(value: Any) -> str | None:
                    if value is None:
                        return None
                    try:
                        numeric = float(value)
                    except (TypeError, ValueError):
                        return None
                    if abs(numeric) <= 1:
                        numeric *= 100
                    return f"{numeric:.1f}".replace(".", ",")

                parts = []
                if score is not None:
                    score_text = f"Tu puntaje financiero es **{score}**"
                    if status:
                        score_text += f" (**{status}**)"
                    score_text += "."
                    parts.append(score_text)

                indicadores = []
                gasto_pct = _pct_local(ratio_gasto)
                deuda_pct = _pct_local(ratio_deuda)
                ahorro_pct = _pct_local(ratio_ahorro)

                if ingreso is not None and gasto is not None and gasto_pct is not None:
                    indicadores.append(
                        f"gastos de {self._format_money(Decimal(str(gasto)))} sobre ingresos de "
                        f"{self._format_money(Decimal(str(ingreso)))}, aproximadamente el {gasto_pct}%"
                    )
                if deuda is not None and deuda_pct is not None:
                    indicadores.append(
                        f"deuda mensual de {self._format_money(Decimal(str(deuda)))}, aproximadamente el "
                        f"{deuda_pct}% de tus ingresos"
                    )
                if ahorro is not None and ahorro_pct is not None:
                    indicadores.append(
                        f"capacidad de ahorro estimada de {self._format_money(Decimal(str(ahorro)))} al mes, "
                        f"aproximadamente el {ahorro_pct}% de tus ingresos"
                    )

                if indicadores:
                    parts.append(
                        "Los principales indicadores que influyen en ese puntaje son: "
                        + "; ".join(indicadores)
                        + "."
                    )

                content = "\n\n".join(parts)
                response = self._internal_response(
                    content,
                    Intent.SCORE,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "score_follow_up_deterministic"
                return response

            # Follow-up determinístico para "¿Estoy gastando más de lo que ingreso?".
            # Mantiene el foco en la comparación ingreso/gasto y evita caer al
            # fallback financiero genérico.
            overspending_follow_up_markers = (
                "tus gastos no superan tus ingresos",
                "no, tus gastos no superan tus ingresos",
                "saldo positivo",
                "despues de cubrir todos los desembolsos",
            )
            if any(
                marker in normalized_previous_generic
                for marker in overspending_follow_up_markers
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")

                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    balance = ingreso_d - gasto_d

                    if ingreso_d > 0:
                        gasto_ratio = (
                            gasto_d / ingreso_d * Decimal("100")
                        ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                        margen_ratio = (
                            balance / ingreso_d * Decimal("100")
                        ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

                        gasto_ratio_text = str(gasto_ratio).replace(".", ",")
                        margen_ratio_text = str(margen_ratio).replace(".", ",")

                        if balance >= 0:
                            content = (
                                f"No estás gastando más de lo que ingresas: tus ingresos mensuales son "
                                f"**{self._format_money(ingreso_d)}** y tus gastos mensuales son "
                                f"**{self._format_money(gasto_d)}**.\n\n"
                                f"Eso significa que estás utilizando aproximadamente el "
                                f"**{gasto_ratio_text}% de tus ingresos** y conservas un margen estimado de "
                                f"**{self._format_money(balance)}**, equivalente aproximadamente al "
                                f"**{margen_ratio_text}% de tus ingresos**.\n\n"
                                "El balance mensual estimado sigue siendo positivo, aunque el margen disponible "
                                "es reducido porque la mayor parte de tus ingresos ya está destinada a gastos.\n\n"
                                "Estos valores corresponden al análisis financiero general de FinSightAI y no al "
                                "resultado real de un mes específico."
                            )
                        else:
                            deficit = abs(balance)
                            content = (
                                f"Sí, actualmente tus gastos mensuales de **{self._format_money(gasto_d)}** "
                                f"superan tus ingresos mensuales de **{self._format_money(ingreso_d)}**.\n\n"
                                f"Estás utilizando aproximadamente el **{gasto_ratio_text}% de tus ingresos** "
                                f"y el déficit mensual estimado es **{self._format_money(deficit)}**.\n\n"
                                "Estos valores corresponden al análisis financiero general de FinSightAI y no al "
                                "resultado real de un mes específico."
                            )
                    else:
                        content = DeterministicFinancialResponder.remaining_after_expenses(analysis)
                else:
                    content = DeterministicFinancialResponder.remaining_after_expenses(analysis)

                response = self._internal_response(
                    content,
                    Intent.EXPENSES,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "overspending_follow_up_deterministic"
                return response

            # Balance después de gastos.
            if (
                "despues de tus gastos mensuales te quedan" in normalized_previous_generic
                or "te queda un margen aproximado" in normalized_previous_generic
            ):
                analysis = self._get_analysis(usuario_id)
                metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
                metrics = metrics if isinstance(metrics, dict) else {}

                ingreso = metrics.get("ingreso_mensual")
                gasto = metrics.get("gasto_mensual_promedio")

                if ingreso is not None and gasto is not None:
                    ingreso_d = Decimal(str(ingreso))
                    gasto_d = Decimal(str(gasto))
                    balance = ingreso_d - gasto_d
                    content = (
                        f"El monto que te queda después de tus gastos mensuales se calcula restando "
                        f"**{self._format_money(gasto_d)}** de gastos a **{self._format_money(ingreso_d)}** "
                        f"de ingresos.\n\n"
                        f"El resultado es **{self._format_money(balance)}**. "
                        "Este valor corresponde al balance mensual estimado del análisis general y no al "
                        "resultado real de un mes específico."
                    )
                else:
                    content = DeterministicFinancialResponder.remaining_after_expenses(analysis)

                response = self._internal_response(
                    content,
                    Intent.SAVINGS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "remaining_after_expenses_follow_up_deterministic"
                return response

            # Follow-up determinístico para educación financiera canónica.
            normalized_previous_education = QueryNormalizer.normalize(previous_answer)

            local_education_followups = {
                "fondo de emergencia": (
                    "Un **fondo de emergencia** es una reserva separada para cubrir imprevistos sin depender "
                    "de deuda. Lo importante es que sea accesible y esté diferenciada del dinero de uso cotidiano. "
                    "El objetivo no es maximizar rendimiento, sino disponer de liquidez cuando aparece una necesidad inesperada."
                ),
                "interes compuesto": (
                    "El **interés compuesto** hace que los intereses generados se incorporen al capital. "
                    "En períodos posteriores, los nuevos intereses pueden calcularse sobre una base mayor. "
                    "Por eso el tiempo y la reinversión influyen mucho en el resultado."
                ),
                "etf": (
                    "Un **ETF** reúne activos dentro de una cartera y sus participaciones se negocian en mercado. "
                    "Puede seguir un índice, un sector, bonos u otras estrategias. "
                    "Su riesgo depende de los activos que contiene y de cómo esté construido."
                ),
                "stablecoin": (
                    "Una **stablecoin** intenta mantener un valor de referencia relativamente estable, "
                    "pero esa estabilidad no está garantizada. Su riesgo depende del mecanismo de respaldo, "
                    "las reservas, la liquidez y las contrapartes involucradas."
                ),
                "diversificar": (
                    "**Diversificar** significa repartir la exposición entre distintos activos en lugar de concentrarla "
                    "en uno solo. Reduce el riesgo de concentración, aunque no elimina la posibilidad de pérdidas."
                ),
                "bono": (
                    "Un **bono** es deuda emitida por una entidad. Quien invierte presta dinero bajo ciertas condiciones "
                    "y espera recibir pagos según lo acordado. El riesgo principal es que el emisor no cumpla o que "
                    "el valor del bono cambie antes de su vencimiento."
                ),
                "accion": (
                    "Una **acción** representa participación en una empresa. Su precio puede subir o bajar y no existe "
                    "una rentabilidad garantizada. Algunas empresas reparten dividendos, pero tampoco son obligatorios."
                ),
                "ahorrar": (
                    "**Ahorrar** busca reservar dinero y mantener disponibilidad. **Invertir** implica colocar dinero "
                    "en activos con expectativa de rendimiento, aceptando algún nivel de riesgo. Son herramientas distintas."
                ),
            }

            # Estas definiciones se amplían localmente sólo si la respuesta anterior
            # tiene una firma propia de una definición educativa canónica. Una respuesta
            # libre del LLM puede mencionar "fondo de emergencia", "ETF", etc. y eso
            # NO debe cambiar el tema del follow-up.
            canonical_education_signatures = {
                "fondo de emergencia": (
                    "un fondo de emergencia es una reserva de dinero destinada a cubrir imprevistos",
                ),
                "interes compuesto": (
                    "el interes compuesto ocurre cuando los intereses generados se incorporan al capital",
                ),
                "ahorrar": (
                    "ahorrar consiste en reservar dinero para usarlo mas adelante",
                ),
                "etf": (
                    "un etf es un fondo cuyas participaciones se negocian en mercado",
                ),
                "bono": (
                    "un bono es un instrumento de deuda",
                ),
                "accion": (
                    "una accion representa una participacion en una empresa",
                ),
                "stablecoin": (
                    "una stablecoin es un criptoactivo disenado para intentar mantener un valor estable",
                ),
                "diversificar": (
                    "diversificar una inversion significa repartir la exposicion entre distintos activos",
                ),
            }

            for marker, signatures in canonical_education_signatures.items():
                if any(signature in normalized_previous_education for signature in signatures):
                    explanation = local_education_followups.get(marker)
                    if explanation is not None:
                        response = self._internal_response(
                            explanation,
                            Intent.FINANCIAL_EDUCATION,
                            query,
                            used_financial_context=False,
                        )
                        response.metadata["route"] = "financial_education_follow_up_local"
                        return response

            # Si llegamos acá, el follow-up no pertenece a una ruta local canónica.
            # Primero intentamos continuar con el LLM usando la respuesta anterior y
            # el contexto financiero real. Si el proveedor falla, respondemos con un
            # fallback local contextual que amplía EL MISMO tema de la respuesta previa.
            try:
                follow_up_analysis = self._get_analysis(usuario_id)
            except (BackendDataError, ValueError):
                follow_up_analysis = {}

            follow_up_context: dict[str, Any] = {}
            if follow_up_analysis:
                try:
                    follow_up_rules = FinancialRulesEngine.evaluate(follow_up_analysis)
                    follow_up_context = self.context_builder.build(
                        intent=Intent.FULL_ANALYSIS,
                        analysis=follow_up_analysis,
                        rules=follow_up_rules,
                    )
                except (BackendDataError, ValueError, TypeError):
                    follow_up_context = {}

            messages = self._build_compact_follow_up_messages(
                question=query.original,
                previous_answer=previous_answer,
                analysis=follow_up_analysis,
            )

            try:
                response = await self.llm.generate(messages=messages, provider=provider)
                response.metadata.update(
                    {
                        "intent": "follow_up",
                        "route": "llm_follow_up_with_context",
                        "used_financial_context": bool(follow_up_context),
                        "corrections_count": len(query.corrections),
                    }
                )
                return response
            except Exception:
                content = self._free_follow_up_local_fallback(
                    previous_answer=previous_answer,
                    analysis=follow_up_analysis,
                )
                response = self._internal_response(
                    content,
                    Intent.FULL_ANALYSIS,
                    query,
                    used_financial_context=bool(follow_up_analysis),
                )
                response.metadata.update(
                    {
                        "intent": "follow_up",
                        "route": "free_follow_up_local_fallback",
                        "used_financial_context": bool(follow_up_analysis),
                        "corrections_count": len(query.corrections),
                    }
                )
                return response

        # Follow-ups cortos sobre capacidad de ahorro conservan la intención
        # financiera de la respuesta anterior. Se resuelven antes del aislamiento
        # Advisor/Soporte para que frases como "¿puedes calcularla?", "calculala"
        # o "¿y cuánto es?" no sean interpretadas como consultas técnicas.
        if self._is_savings_capacity_follow_up(query.original, previous_answer):
            analysis = self._get_analysis(usuario_id)
            content = DeterministicFinancialResponder.respond(
                intent=Intent.SAVINGS,
                analysis=analysis,
            )
            response = self._internal_response(
                content,
                Intent.SAVINGS,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "savings_capacity_follow_up"
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
        goal_creation_response = None
        if advisor_intent_result.intent != Intent.FINANCIAL_EDUCATION:
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
        if (
            early_intent.intent != Intent.FINANCIAL_EDUCATION
            and self._is_direct_goal_query(query.corrected)
        ):
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
            and not is_financial_query
        ):
            
            follow_up_context: dict[str, Any] = {}
            try:
                follow_up_analysis = self._get_analysis(usuario_id)
                follow_up_rules = FinancialRulesEngine.evaluate(follow_up_analysis)
                follow_up_context = self.context_builder.build(
                    intent=Intent.FULL_ANALYSIS,
                    analysis=follow_up_analysis,
                    rules=follow_up_rules,
                )
            except (BackendDataError, ValueError):
                follow_up_context = {}

            messages = self._build_compact_follow_up_messages(
                question=query.original,
                previous_answer=previous_answer,
                analysis=follow_up_analysis,
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

        # Preguntas financieras LIBRES / hipotéticas / interpretativas.
        # Deben llegar al LLM con un resumen financiero verificado, incluso si el
        # detector las clasificó como SUMMARY/FULL_ANALYSIS/UNKNOWN por palabras
        # como "panorama", "patrón" o "situación". Las 30 preguntas canónicas
        # quedan excluidas explícitamente y siguen siendo locales.
        if (
            not self._is_canonical_validation_question(query.corrected)
            and self._is_free_financial_llm_question(
                query.corrected,
                intent_result.intent,
            )
        ):
            analysis = self._get_analysis(usuario_id)
            messages = self._build_compact_financial_messages(
                question=query.original,
                analysis=analysis,
            )
            try:
                response = await self.llm.generate(messages=messages, provider=provider)
                response.metadata.update(
                    {
                        "intent": intent_result.intent.value,
                        "route": "free_financial_llm_with_context",
                        "used_financial_context": True,
                        "corrections_count": len(query.corrections),
                    }
                )
                return response
            except Exception:
                # Fallback seguro para Demo Day: nunca dejar la conversación rota
                # si Groq/OpenRouter están sin cuota o fallan temporalmente.
                content = self._free_financial_local_fallback(
                    question=query.corrected,
                    analysis=analysis,
                )
                response = self._internal_response(
                    content,
                    Intent.FULL_ANALYSIS,
                    query,
                    used_financial_context=True,
                )
                response.metadata["route"] = "free_financial_local_fallback"
                return response

        # Recomendaciones y presupuesto: los datos siguen siendo determinísticos,
        # pero la interpretación de la pregunta y la redacción pasan primero por el LLM.
        # El texto local se conserva exclusivamente como fallback si falla el proveedor.
        if intent_result.intent in {Intent.RECOMMENDATIONS, Intent.BUDGET}:
            analysis = self._get_analysis(usuario_id)
            rules = FinancialRulesEngine.evaluate(analysis)
            advice_context = self.context_builder.build(
                intent=intent_result.intent,
                analysis=analysis,
                rules=rules,
            )
            messages = PromptBuilder.build(
                original_question=query.original,
                processed_question=query.corrected,
                corrections=query.corrections,
                context=advice_context,
                intent=intent_result.intent.value,
            )
            try:
                response = await self.llm.generate(messages=messages, provider=provider)
                response.metadata.update(
                    {
                        "intent": intent_result.intent.value,
                        "route": "llm_advice_with_context",
                        "used_financial_context": True,
                        "corrections_count": len(query.corrections),
                    }
                )
                return response
            except Exception:
                local_advice = self._local_recommendation_or_budget_response(
                    query.corrected,
                    intent=intent_result.intent,
                    analysis=analysis,
                )
                if local_advice is not None:
                    response = self._internal_response(
                        local_advice,
                        intent_result.intent,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "advice_local_fallback"
                    return response

        # Los resúmenes/situación actual deben ser matemáticamente deterministas
        # y usar exactamente el snapshot sincronizado con el Dashboard. Dejar estas
        # respuestas al LLM permitía contradicciones como afirmar déficit cuando
        # ingreso > gasto.
        if intent_result.intent in {Intent.SUMMARY, Intent.FULL_ANALYSIS}:
            analysis = self._get_analysis(usuario_id)
            content = DeterministicFinancialResponder.respond(
                intent=intent_result.intent,
                analysis=analysis,
            )
            response = self._internal_response(
                content,
                intent_result.intent,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "dashboard_snapshot_deterministic"
            return response

        # "Cuánto me queda después de mis gastos" pregunta por el balance, no
        # por la capacidad genérica de ahorro.
        if (
            intent_result.intent == Intent.SAVINGS
            and any(
                marker in set(intent_result.matched_terms or ())
                for marker in {"remaining_after_expenses", "saldo despues de gastos"}
            )
        ):
            analysis = self._get_analysis(usuario_id)
            content = DeterministicFinancialResponder.remaining_after_expenses(analysis)
            response = self._internal_response(
                content,
                intent_result.intent,
                query,
                used_financial_context=True,
            )
            response.metadata["route"] = "dashboard_balance_deterministic"
            return response

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

            # "¿Cuánto ingresé este mes?" debe usar las transacciones reales del
            # mes actual, no `ingreso_mensual` del snapshot general. El motor ya
            # resuelve correctamente el equivalente de gastos; protegemos aquí
            # específicamente el ingreso mensual para evitar el fallback genérico.
            normalized_transaction_query = QueryNormalizer.normalize(query.corrected)
            if (
                re.search(r"\bcuanto\s+(?:ingrese|ingreso|cobre|gane)\b", normalized_transaction_query)
                and re.search(r"\beste\s+mes\b", normalized_transaction_query)
            ):
                current_month_income = self._current_month_transaction_response(
                    transactions=transactions,
                    transaction_type="INGRESO",
                    today=local_today,
                )
                if current_month_income is not None:
                    response = self._internal_response(
                        current_month_income,
                        Intent.INCOME,
                        query,
                        used_financial_context=True,
                    )
                    response.metadata["route"] = "current_month_income_transactions"
                    response.metadata["transaction_action"] = "current_month_income"
                    return response
        
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

        if (
            route == AgentRoute.DETERMINISTIC
            and intent_result.intent != Intent.GOALS
            and not self._is_canonical_validation_question(query.corrected)
            and self._should_llm_explain_financial_question(
                query.corrected,
                intent_result.intent,
            )
        ):
            # El router puede reconocer correctamente el dominio financiero pero aun
            # así clasificar como DETERMINISTIC una pregunta explicativa. En esos casos
            # usamos las métricas reales como contexto y dejamos la interpretación al LLM.
            analysis = self._get_analysis(usuario_id)
            rules = FinancialRulesEngine.evaluate(analysis)
            explanatory_context = self.context_builder.build(
                intent=intent_result.intent,
                analysis=analysis,
                rules=rules,
            )
            messages = PromptBuilder.build(
                original_question=query.original,
                processed_question=query.corrected,
                corrections=query.corrections,
                context=explanatory_context,
                intent=intent_result.intent.value,
            )
            response = await self.llm.generate(messages=messages, provider=provider)
            response.metadata.update(
                {
                    "intent": intent_result.intent.value,
                    "route": "llm_explanatory_override",
                    "used_financial_context": True,
                    "corrections_count": len(query.corrections),
                }
            )
            return response

        if route == AgentRoute.DETERMINISTIC:
            if intent_result.intent == Intent.GOALS:
                goals = self.goal_repository.list_by_user(usuario_id)
                content = DeterministicGoalResponder.respond(goals)
            else:
                analysis = self._get_analysis(usuario_id)

                # PROFILE necesita distinguir entre preguntar cuál es el perfil
                # y preguntar por qué se obtuvo ese perfil. El router mantiene
                # ambas consultas en deterministic para no depender del LLM,
                # pero la segunda debe explicar los indicadores que lo sustentan.
                normalized_profile_question = QueryNormalizer.normalize(query.corrected)
                asks_profile_reason = (
                    intent_result.intent == Intent.PROFILE
                    and any(
                        marker in normalized_profile_question
                        for marker in (
                            "por que tengo este perfil",
                            "por que tengo ese perfil",
                            "por que tengo el perfil",
                            "por que estoy en este perfil financiero",
                            "por que estoy en este perfil",
                            "por que estoy en ese perfil financiero",
                            "por que estoy en ese perfil",
                            "por que mi perfil",
                            "por que estoy en riesgo",
                            "por que soy en riesgo",
                            "por que me da este perfil",
                            "por que me da ese perfil",
                            "por que me aparece este perfil",
                            "por que me aparece ese perfil",
                        )
                    )
                )

                if asks_profile_reason:
                    profile_content = DeterministicFinancialResponder.respond(
                        intent=Intent.PROFILE,
                        analysis=analysis,
                    )
                    summary_content = DeterministicFinancialResponder.respond(
                        intent=Intent.SUMMARY,
                        analysis=analysis,
                    )
                    content = (
                        f"{profile_content}\n\n"
                        "Este perfil se obtiene a partir de tus indicadores financieros actuales:\n\n"
                        f"{summary_content}"
                    )
                else:
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

        if crypto_king_query:
            first_crypto_for_user = usuario_id not in self._crypto_king_seen_users
            show_crypto_king = first_crypto_for_user or random.random() < 0.25
            self._crypto_king_seen_users.add(usuario_id)

            if show_crypto_king:
                response.content = (
                    "👑 Ah... veo que has venido a consultar al Rey de las Crypto.\n\n"
                    f"{response.content}\n\n"
                    "!audio[finsi-crypto](/images/task/finsi-crypto.mp3)"
                )
                response.metadata["easter_egg"] = "finsi_crypto"
                response.metadata["crypto_king_decorated"] = True
            else:
                response.metadata["crypto_king_decorated"] = False

        return response




    @classmethod
    def _compact_financial_context_text(
        cls,
        analysis: dict[str, Any],
    ) -> str:
        """Contexto corto para el LLM: sólo datos útiles para razonar la consulta."""
        analysis = analysis if isinstance(analysis, dict) else {}
        metrics = analysis.get("metricas")
        metrics = metrics if isinstance(metrics, dict) else {}

        def pct_text(value: Any) -> str | None:
            if value is None:
                return None
            try:
                number = Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None
            if abs(number) <= Decimal("1"):
                number *= Decimal("100")
            number = number.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
            return str(number).replace(".", ",") + "%"

        lines: list[str] = []
        money_fields = (
            ("Ingreso mensual", metrics.get("ingreso_mensual")),
            ("Gasto mensual", metrics.get("gasto_mensual_promedio")),
            ("Ahorro mensual estimado", metrics.get("ahorro_mensual_estimado")),
            ("Deuda mensual", metrics.get("deuda_mensual")),
        )
        for label, value in money_fields:
            if value is not None:
                lines.append(f"- {label}: {cls._format_money(value)}")

        ratio_fields = (
            ("Gasto/ingreso", metrics.get("ratio_gasto_ingreso")),
            ("Ahorro/ingreso", metrics.get("ratio_ahorro_ingreso")),
            ("Deuda/ingreso", metrics.get("ratio_deuda_ingreso")),
        )
        for label, value in ratio_fields:
            rendered = pct_text(value)
            if rendered is not None:
                lines.append(f"- {label}: {rendered}")

        if analysis.get("perfil_financiero"):
            lines.append(f"- Perfil: {analysis.get('perfil_financiero')}")
        if analysis.get("nivel_riesgo"):
            lines.append(f"- Riesgo: {analysis.get('nivel_riesgo')}")
        if analysis.get("financial_score") is not None:
            lines.append(f"- Puntaje: {analysis.get('financial_score')}")

        categories = analysis.get("categorias_principales")
        if isinstance(categories, list) and categories:
            rendered = []
            for item in categories[:3]:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("categoria") or "").strip()
                if not name:
                    continue
                p = item.get("porcentaje")
                if p is not None:
                    try:
                        p = Decimal(str(p)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                        rendered.append(f"{name} {p}% del gasto")
                    except (InvalidOperation, ValueError, TypeError):
                        rendered.append(name)
                else:
                    rendered.append(name)
            if rendered:
                lines.append("- Categorías principales: " + ", ".join(rendered))

        return "\n".join(lines)

    @classmethod
    def _build_compact_financial_messages(
        cls,
        *,
        question: str,
        analysis: dict[str, Any],
    ) -> list[dict[str, str]]:
        context_text = cls._compact_financial_context_text(analysis)
        system = (
            "Eres Finsi, asistente de FinSightAI. Responde en español neutro, claro y breve. "
            "Usa exclusivamente los datos financieros suministrados como fuente de verdad. "
            "No inventes montos, tasas, saldos, categorías ni contenido interno de categorías. "
            "Los porcentajes de categorías son sobre el gasto total. "
            "No confundas una categoría llamada Deudas con la deuda mensual. "
            "Si el usuario pide una simulación, identifícala como hipotética y explica los supuestos. "
            "No afirmes que el perfil o puntaje cambia salvo que el contexto lo indique. "
            "Usa $ y formato latino para montos. Responde exactamente lo preguntado."
        )
        user = (
            f"CONTEXTO FINANCIERO:\n{context_text}\n\n"
            f"PREGUNTA:\n{question}"
        )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    @classmethod
    def _build_compact_follow_up_messages(
        cls,
        *,
        question: str,
        previous_answer: str,
        analysis: dict[str, Any],
    ) -> list[dict[str, str]]:
        context_text = cls._compact_financial_context_text(analysis)
        previous = (previous_answer or "").strip()
        if len(previous) > 3500:
            previous = previous[:3500] + "\n[respuesta anterior recortada]"
        system = (
            "Eres Finsi, asistente de FinSightAI. El usuario pide continuar la respuesta anterior. "
            "Mantén exactamente el mismo tema. Usa el contexto financiero como fuente de verdad. "
            "No inventes datos ni cambies el foco por una palabra incidental como fondo de emergencia, ETF o deuda. "
            "Si pide 'Explícame más', explica y profundiza; no agregues automáticamente recomendaciones nuevas. "
            "Usa $ y formato latino."
        )
        user = (
            f"RESPUESTA ANTERIOR:\n{previous}\n\n"
            f"CONTEXTO FINANCIERO:\n{context_text}\n\n"
            f"FOLLOW-UP:\n{question}"
        )
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    @classmethod
    def _free_financial_local_fallback(
        cls,
        *,
        question: str,
        analysis: dict[str, Any],
    ) -> str:
        """Fallback local contextual para preguntas financieras libres.

        Se usa sólo cuando el LLM no está disponible. No intenta reemplazar al LLM:
        cubre escenarios frecuentes de demo con cálculos y reglas sobre datos reales,
        y si no reconoce el caso devuelve un análisis general determinístico.
        """
        q = QueryNormalizer.normalize(question).strip()
        analysis = analysis if isinstance(analysis, dict) else {}
        metrics = analysis.get("metricas")
        metrics = metrics if isinstance(metrics, dict) else {}

        ingreso = metrics.get("ingreso_mensual")
        gasto = metrics.get("gasto_mensual_promedio")
        deuda = metrics.get("deuda_mensual")
        ahorro = metrics.get("ahorro_mensual_estimado")
        ratio_gasto = metrics.get("ratio_gasto_ingreso")
        ratio_deuda = metrics.get("ratio_deuda_ingreso")
        ratio_ahorro = metrics.get("ratio_ahorro_ingreso")
        perfil = analysis.get("perfil_financiero")
        score = analysis.get("financial_score")
        riesgo = analysis.get("nivel_riesgo")
        categorias = analysis.get("categorias_principales")
        categorias = categorias if isinstance(categorias, list) else []

        def dec(value: Any) -> Decimal | None:
            if value is None:
                return None
            try:
                return Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None

        def pct(value: Any) -> Decimal | None:
            number = dec(value)
            if number is None:
                return None
            if abs(number) <= Decimal("1"):
                number *= Decimal("100")
            return number.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        ingreso_d = dec(ingreso)
        gasto_d = dec(gasto)
        deuda_d = dec(deuda)
        ahorro_d = dec(ahorro)
        gasto_pct = pct(ratio_gasto)
        deuda_pct = pct(ratio_deuda)
        ahorro_pct = pct(ratio_ahorro)

        # Extraer un monto mencionado en la consulta.
        amount_match = re.search(
            r"\$\s*(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)",
            question or "",
        )
        amount = None
        if amount_match:
            raw = amount_match.group(1)
            if "." in raw and "," in raw:
                raw = raw.replace(".", "").replace(",", ".")
            elif "," in raw:
                raw = raw.replace(",", ".")
            try:
                amount = Decimal(raw)
            except InvalidOperation:
                amount = None

        # Escenario: aumentar ahorro en un monto.
        if (
            amount is not None
            and ahorro_d is not None
            and ingreso_d is not None
            and any(term in q for term in ("ahorrar", "ahorro"))
            and any(term in q for term in ("mas", "aument", "increment", "sumar"))
        ):
            nuevo_ahorro = ahorro_d + amount
            nuevo_ratio = (
                nuevo_ahorro / ingreso_d * Decimal("100")
                if ingreso_d > 0
                else None
            )
            parts = [
                f"Si esos **{cls._format_money(amount)} adicionales** se suman a tu ahorro mensual "
                f"y tus ingresos y obligaciones se mantienen iguales, tu capacidad de ahorro estimada "
                f"pasaría de **{cls._format_money(ahorro_d)}** a **{cls._format_money(nuevo_ahorro)}**."
            ]
            if nuevo_ratio is not None:
                nuevo_ratio = nuevo_ratio.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                parts.append(
                    f"Ese nuevo ahorro equivaldría aproximadamente al **{str(nuevo_ratio).replace('.', ',')}% "
                    f"de tus ingresos mensuales**."
                )
            if perfil:
                parts.append(
                    f"Tu perfil actual es **{perfil}**. El cambio aumentaría tu margen disponible, "
                    "pero no implica por sí solo que el perfil cambie de categoría, porque FinSightAI "
                    "también considera otros indicadores como gasto, deuda y ahorro relativo."
                )
            return "\n\n".join(parts)

        # Escenario: reducir gastos en un monto.
        if (
            amount is not None
            and gasto_d is not None
            and ingreso_d is not None
            and any(term in q for term in ("gasto", "gastos"))
            and any(term in q for term in ("reduc", "bajar", "dismin", "recortar"))
        ):
            nuevo_gasto = max(Decimal("0"), gasto_d - amount)
            nuevo_balance = ingreso_d - nuevo_gasto
            nuevo_ratio_gasto = (
                nuevo_gasto / ingreso_d * Decimal("100")
                if ingreso_d > 0
                else None
            )
            parts = [
                f"Si reduces tus gastos mensuales en **{cls._format_money(amount)}** y tus ingresos se mantienen, "
                f"el gasto estimado bajaría de **{cls._format_money(gasto_d)}** a "
                f"**{cls._format_money(nuevo_gasto)}**."
            ]
            if nuevo_ratio_gasto is not None:
                nuevo_ratio_gasto = nuevo_ratio_gasto.quantize(
                    Decimal("0.1"), rounding=ROUND_HALF_UP
                )
                parts.append(
                    f"Eso llevaría el gasto a aproximadamente el "
                    f"**{str(nuevo_ratio_gasto).replace('.', ',')}% de tus ingresos**."
                )
            parts.append(
                f"El margen mensual estimado subiría a **{cls._format_money(nuevo_balance)}**, "
                "si no cambian tus demás obligaciones."
            )
            return "\n\n".join(parts)

        # Patrones o cosas que el usuario quizá no está viendo.
        if any(term in q for term in ("patron", "tendencia", "no estoy viendo", "no veo")):
            parts = []
            if gasto_pct is not None:
                if gasto_pct < Decimal("50"):
                    parts.append(
                        f"Tus gastos representan aproximadamente el **{str(gasto_pct).replace('.', ',')}% "
                        "de tus ingresos**, por lo que actualmente conservas un margen amplio."
                    )
                elif gasto_pct < Decimal("80"):
                    parts.append(
                        f"Tus gastos consumen aproximadamente el **{str(gasto_pct).replace('.', ',')}% "
                        "de tus ingresos**; hay margen, pero una parte importante del ingreso ya está comprometida."
                    )
                else:
                    parts.append(
                        f"Tus gastos representan aproximadamente el **{str(gasto_pct).replace('.', ',')}% "
                        "de tus ingresos**, una señal para vigilar porque deja poco margen."
                    )

            if deuda_pct is not None:
                if deuda_pct < Decimal("20"):
                    parts.append(
                        f"Tu relación deuda/ingreso es baja, alrededor del "
                        f"**{str(deuda_pct).replace('.', ',')}%**."
                    )
                elif deuda_pct < Decimal("35"):
                    parts.append(
                        f"Tu deuda representa cerca del **{str(deuda_pct).replace('.', ',')}% de tus ingresos**, "
                        "un nivel que conviene seguir de cerca."
                    )
                else:
                    parts.append(
                        f"Tu deuda representa aproximadamente el **{str(deuda_pct).replace('.', ',')}% de tus ingresos**, "
                        "por lo que es uno de los puntos de mayor presión."
                    )

            if ahorro_pct is not None:
                parts.append(
                    f"Tu capacidad de ahorro estimada equivale aproximadamente al "
                    f"**{str(ahorro_pct).replace('.', ',')}% de tus ingresos**."
                )

            if categorias:
                top = []
                for item in categorias[:3]:
                    if not isinstance(item, dict):
                        continue
                    nombre = str(item.get("categoria") or "").strip()
                    porcentaje = item.get("porcentaje")
                    if not nombre:
                        continue
                    if porcentaje is not None:
                        try:
                            p = Decimal(str(porcentaje)).quantize(
                                Decimal("1"), rounding=ROUND_HALF_UP
                            )
                            top.append(f"**{nombre}** ({p}% del gasto)")
                        except (InvalidOperation, ValueError, TypeError):
                            top.append(f"**{nombre}**")
                    else:
                        top.append(f"**{nombre}**")
                if top:
                    parts.append(
                        "La concentración principal del gasto está en " + ", ".join(top) + "."
                    )

            if perfil or riesgo or score is not None:
                estado = []
                if perfil:
                    estado.append(f"perfil **{perfil}**")
                if riesgo:
                    estado.append(f"riesgo **{riesgo}**")
                if score is not None:
                    estado.append(f"puntaje **{score}**")
                parts.append("En conjunto, FinSightAI te ubica con " + ", ".join(estado) + ".")

            if parts:
                return "\n\n".join(parts)

        # Señales de alerta / preocupación principal.
        if any(term in q for term in ("alerta", "preocupa", "preocupante", "fragil", "riesgo ves")):
            alerts = []
            if gasto_pct is not None and gasto_pct >= Decimal("80"):
                alerts.append(
                    f"el gasto consume aproximadamente el {str(gasto_pct).replace('.', ',')}% de tus ingresos"
                )
            if deuda_pct is not None and deuda_pct >= Decimal("35"):
                alerts.append(
                    f"la deuda representa aproximadamente el {str(deuda_pct).replace('.', ',')}% de tus ingresos"
                )
            if ahorro_pct is not None and ahorro_pct < Decimal("10"):
                alerts.append(
                    f"la capacidad de ahorro es baja, alrededor del {str(ahorro_pct).replace('.', ',')}%"
                )

            if alerts:
                return (
                    "Las señales de mayor atención son: " + "; ".join(alerts) + ". "
                    "Conviene priorizar la que más presión ejerza sobre tu margen mensual."
                )

            return (
                "Con los indicadores disponibles no aparece una señal crítica dominante. "
                "Lo más útil es seguir vigilando la relación entre gasto, deuda y capacidad de ahorro "
                "y revisar si alguna categoría concentra una parte excesiva del gasto."
            )

        # Ahorro vs deuda.
        if (
            "ahorro" in q
            and "deuda" in q
            and any(term in q for term in ("priorizar", "primero", "conviene", "mejor"))
        ):
            if deuda_pct is not None and deuda_pct >= Decimal("35"):
                return (
                    f"Tu relación deuda/ingreso ronda el **{str(deuda_pct).replace('.', ',')}%**, "
                    "por lo que reducir deuda debería tener prioridad sobre aumentar ahorro, "
                    "sin dejar de conservar un pequeño margen para imprevistos."
                )
            if ahorro_pct is not None and ahorro_pct < Decimal("10"):
                return (
                    "Tu capacidad de ahorro es reducida. Antes de acelerar pagos extraordinarios de deuda, "
                    "conviene preservar algo de liquidez para no depender de nueva deuda ante un imprevisto."
                )
            return (
                "Con tus indicadores actuales no aparece una presión de deuda alta. "
                "Puedes mantener el ahorro y, si tienes deudas con costos elevados, destinar parte del margen "
                "a reducirlas de forma gradual."
            )

        # Plan concreto para aprovechar el margen mensual.
        # Se activa cuando el usuario pide plan, prioridades, porcentajes o asignación.
        if any(
            term in q
            for term in (
                "plan concreto",
                "proponeme un plan",
                "propone un plan",
                "prioriza objetivos",
                "priorices objetivos",
                "aprovechar mejor",
                "dinero que me queda",
                "como distribuir",
                "como repartir",
                "que hago con el dinero",
                "que hacer con el dinero",
                "dame porcentajes",
                "asignar mi margen",
            )
        ):
            if ahorro_d is None or ahorro_d <= 0:
                return (
                    "En este momento FinSightAI no detecta un margen mensual positivo suficiente "
                    "para repartir en un plan. La prioridad sería recuperar o proteger el equilibrio "
                    "entre ingresos y gastos antes de asignar porcentajes a nuevos objetivos."
                )

            # Reglas simples, transparentes y basadas en los indicadores disponibles.
            # No usan tasas, saldos ni condiciones de deuda que FinSightAI no conoce.
            debt_pressure = deuda_pct is not None and deuda_pct >= Decimal("20")
            expense_pressure = gasto_pct is not None and gasto_pct >= Decimal("80")
            savings_pressure = ahorro_pct is not None and ahorro_pct < Decimal("10")

            if debt_pressure:
                reserve_pct, goals_pct, flex_pct = Decimal("40"), Decimal("35"), Decimal("25")
                rationale = (
                    "La deuda tiene un peso relevante respecto de tus ingresos, por eso el plan "
                    "reserva una parte importante del margen para obligaciones y liquidez sin asumir "
                    "qué deuda conviene cancelar primero."
                )
            elif expense_pressure or savings_pressure:
                reserve_pct, goals_pct, flex_pct = Decimal("55"), Decimal("25"), Decimal("20")
                rationale = (
                    "Tu margen es más sensible porque el gasto ocupa una parte alta del ingreso "
                    "o la capacidad de ahorro es reducida; por eso conviene proteger más liquidez."
                )
            else:
                reserve_pct, goals_pct, flex_pct = Decimal("50"), Decimal("30"), Decimal("20")
                rationale = (
                    "Como el margen es positivo y la presión de deuda no aparece elevada, el plan "
                    "prioriza conservar liquidez y al mismo tiempo avanzar en objetivos."
                )

            reserve_amount = (ahorro_d * reserve_pct / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            goals_amount = (ahorro_d * goals_pct / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            flex_amount = ahorro_d - reserve_amount - goals_amount

            parts = [
                f"Dispones de un margen mensual estimado de **{cls._format_money(ahorro_d)}**. "
                "Como plan de referencia, podrías repartir ese margen así:",
                f"**{reserve_pct}% ({cls._format_money(reserve_amount)}) — Reserva y liquidez.** "
                "Sirve para proteger el margen ante imprevistos y evitar que un gasto inesperado obligue a usar deuda.",
                f"**{goals_pct}% ({cls._format_money(goals_amount)}) — Metas financieras.** "
                "Permite avanzar en objetivos concretos sin comprometer todo el dinero disponible.",
                f"**{flex_pct}% ({cls._format_money(flex_amount)}) — Flexibilidad mensual.** "
                "Mantiene una parte sin asignar rígidamente para absorber variaciones de gastos u obligaciones.",
                rationale,
            ]

            if deuda_pct is not None:
                parts.append(
                    f"Tu deuda mensual representa aproximadamente el "
                    f"**{str(deuda_pct).replace('.', ',')}% de tus ingresos**; "
                    "sin saldo, tasa y plazo no conviene inventar una estrategia específica de pago."
                )
            if gasto_pct is not None:
                parts.append(
                    f"Tus gastos representan aproximadamente el "
                    f"**{str(gasto_pct).replace('.', ',')}% de tus ingresos**, por lo que cualquier ajuste "
                    "debería salir del detalle real de las categorías y no de su nombre."
                )
            return "\n\n".join(parts)

        # Último salvavidas: análisis general real, nunca un error técnico.
        return DeterministicFinancialResponder.respond(
            intent=Intent.FULL_ANALYSIS,
            analysis=analysis,
        )


    @classmethod
    def _free_follow_up_local_fallback(
        cls,
        *,
        previous_answer: str,
        analysis: dict[str, Any],
    ) -> str:
        """Amplía localmente una respuesta libre cuando el LLM no está disponible.

        Mantiene el tema de la respuesta anterior y usa el análisis financiero real.
        No decide el tema por palabras aisladas como "fondo de emergencia".
        """
        previous = (previous_answer or "").strip()
        normalized = QueryNormalizer.normalize(previous)
        analysis = analysis if isinstance(analysis, dict) else {}
        metrics = analysis.get("metricas")
        metrics = metrics if isinstance(metrics, dict) else {}

        def dec(value: Any) -> Decimal | None:
            if value is None:
                return None
            try:
                return Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None

        ingreso = dec(metrics.get("ingreso_mensual"))
        gasto = dec(metrics.get("gasto_mensual_promedio"))
        ahorro = dec(metrics.get("ahorro_mensual_estimado"))
        deuda = dec(metrics.get("deuda_mensual"))
        perfil = analysis.get("perfil_financiero")
        score = analysis.get("financial_score")
        riesgo = analysis.get("nivel_riesgo")
        categorias = analysis.get("categorias_principales")
        categorias = categorias if isinstance(categorias, list) else []

        # Caso típico de demo: escenario de "ahorrar $X más".
        extra_match = re.search(
            r"(?:anadir|añadir|sumar|agregar|adicional(?:es)?(?: de)?|ahorrar)\\s*"
            r"\\$\\s*(\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)",
            previous,
            flags=re.IGNORECASE,
        )
        if extra_match is None:
            extra_match = re.search(
                r"\\$\\s*(\\d+(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)"
                r"\\s*(?:adicional(?:es)?|mas)",
                previous,
                flags=re.IGNORECASE,
            )

        extra = None
        if extra_match:
            raw = extra_match.group(1)
            if "." in raw and "," in raw:
                raw = raw.replace(".", "").replace(",", ".")
            elif "," in raw:
                raw = raw.replace(",", ".")
            try:
                extra = Decimal(raw)
            except InvalidOperation:
                extra = None

        scenario_markers = (
            "ahorro adicional",
            "al anadir",
            "al añadir",
            "ahorro estimado pasaria",
            "ahorro estimado pasaría",
            "ratio ahorro",
            "impacto inmediato",
        )
        if extra is not None and ahorro is not None and ingreso is not None and any(
            marker in normalized for marker in scenario_markers
        ):
            nuevo_ahorro = ahorro + extra
            nuevo_ratio = (
                nuevo_ahorro / ingreso * Decimal("100")
                if ingreso > 0
                else None
            )
            parts = [
                f"La idea central del escenario anterior es que estás agregando "
                f"**{cls._format_money(extra)} por mes** a tu capacidad de ahorro actual.",
                f"Con los datos actuales de FinSightAI, tu ahorro estimado es "
                f"**{cls._format_money(ahorro)}**; al sumar ese monto pasaría a "
                f"**{cls._format_money(nuevo_ahorro)}**.",
            ]
            if nuevo_ratio is not None:
                nuevo_ratio = nuevo_ratio.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                parts.append(
                    f"Eso equivale aproximadamente al **{str(nuevo_ratio).replace('.', ',')}% "
                    f"de tus ingresos mensuales de {cls._format_money(ingreso)}**."
                )
            if gasto is not None:
                parts.append(
                    f"Este escenario supone que tus gastos mensuales de **{cls._format_money(gasto)}** "
                    "y tus demás obligaciones no aumentan. Si los $ adicionales provienen de reducir gastos, "
                    "el margen mejora por esa reducción; si provienen de un ingreso extra, el efecto sobre los "
                    "ratios debe recalcularse con ese nuevo ingreso."
                )
            if perfil:
                parts.append(
                    f"Tu perfil actual es **{perfil}**. Aumentar el ahorro refuerza el margen, "
                    "pero FinSightAI no debería afirmar que el perfil cambia automáticamente sin volver "
                    "a evaluar todos los indicadores."
                )
            return "\n\n".join(parts)

        # Si la respuesta anterior era un plan local, ampliar ESE plan.
        if (
            "reserva y liquidez" in normalized
            and "metas financieras" in normalized
            and "flexibilidad mensual" in normalized
        ):
            parts = [
                "El plan anterior divide tu margen en tres funciones distintas para no comprometerlo todo de una sola vez.",
                "**Reserva y liquidez** tiene prioridad porque mantiene dinero disponible ante variaciones o imprevistos; no supone una inversión ni una deuda específica.",
                "**Metas financieras** usa una parte del margen para objetivos concretos, pero sin convertir todo el excedente mensual en un compromiso fijo.",
                "**Flexibilidad mensual** deja una porción sin destino rígido para absorber cambios de gastos u obligaciones.",
            ]
            if ahorro is not None:
                parts.append(
                    f"El punto de partida sigue siendo tu margen mensual estimado de "
                    f"**{cls._format_money(ahorro)}**."
                )
            if deuda is not None:
                parts.append(
                    f"Tu deuda mensual registrada es **{cls._format_money(deuda)}**. "
                    "Como FinSightAI no conoce aquí saldo total, tasa ni plazo, el plan no presupone "
                    "qué deuda deberías cancelar ni en qué orden."
                )
            return "\n\n".join(parts)

        # Caso de interpretación/patrones: ampliar con los indicadores reales.
        if any(
            marker in normalized
            for marker in (
                "patron", "tendencia", "margen", "endeudamiento",
                "gastos representan", "capacidad de ahorro", "categoria",
                "fortalezas", "aspectos por mejorar",
            )
        ):
            parts = [
                "La respuesta anterior se apoya en la relación entre tus indicadores actuales, "
                "no en una sola categoría o concepto aislado."
            ]
            if ingreso is not None and gasto is not None:
                ratio = (
                    gasto / ingreso * Decimal("100")
                    if ingreso > 0 else Decimal("0")
                ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                parts.append(
                    f"Tienes ingresos mensuales de **{cls._format_money(ingreso)}** y gastos de "
                    f"**{cls._format_money(gasto)}**, por lo que el gasto representa aproximadamente "
                    f"el **{str(ratio).replace('.', ',')}% de tus ingresos**."
                )
            if ahorro is not None:
                parts.append(
                    f"Tu capacidad de ahorro estimada es **{cls._format_money(ahorro)} al mes**."
                )
            if deuda is not None:
                parts.append(
                    f"Tu deuda mensual registrada es **{cls._format_money(deuda)}**."
                )
            if categorias:
                top = []
                for item in categorias[:3]:
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get("categoria") or "").strip()
                    pct = item.get("porcentaje")
                    if not name:
                        continue
                    if pct is not None:
                        try:
                            p = Decimal(str(pct)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                            top.append(f"**{name}** ({p}% del gasto)")
                        except (InvalidOperation, ValueError, TypeError):
                            top.append(f"**{name}**")
                    else:
                        top.append(f"**{name}**")
                if top:
                    parts.append("Tus categorías de mayor peso son " + ", ".join(top) + ".")
            state = []
            if perfil:
                state.append(f"perfil **{perfil}**")
            if riesgo:
                state.append(f"riesgo **{riesgo}**")
            if score is not None:
                state.append(f"puntaje **{score}**")
            if state:
                parts.append("En conjunto, esos datos sostienen tu " + ", ".join(state) + ".")
            return "\n\n".join(parts)

        # Fallback general contextual: conservar el mismo panorama financiero.
        parts = [
            "Ampliando la respuesta anterior con tus datos actuales de FinSightAI:"
        ]
        if ingreso is not None:
            parts.append(f"ingresos mensuales **{cls._format_money(ingreso)}**")
        if gasto is not None:
            parts.append(f"gastos mensuales **{cls._format_money(gasto)}**")
        if ahorro is not None:
            parts.append(f"capacidad de ahorro estimada **{cls._format_money(ahorro)}**")
        if deuda is not None:
            parts.append(f"deuda mensual **{cls._format_money(deuda)}**")

        if len(parts) > 1:
            base = "; ".join(parts[1:]) + "."
            conclusion = (
                "Estos valores deben interpretarse en conjunto con el tema de la respuesta anterior; "
                "una mención incidental a un fondo de emergencia, una inversión u otro concepto no cambia "
                "automáticamente el foco de la conversación."
            )
            return parts[0] + "\n\n" + base + "\n\n" + conclusion

        return (
            "Puedo ampliar la respuesta anterior, pero en este momento no pude recuperar suficientes "
            "indicadores financieros para hacerlo con precisión."
        )

    @classmethod
    def _generic_local_expand_response(
        cls,
        *,
        previous_answer: str,
        analysis: dict[str, Any],
    ) -> str:
        """Amplía localmente una respuesta previa sin inventar datos.

        Se usa únicamente como último fallback de un follow-up explícito como
        "Explícame más". Los responders contextuales específicos tienen prioridad.
        """
        previous = (previous_answer or "").strip()
        normalized = QueryNormalizer.normalize(previous)
        analysis = analysis if isinstance(analysis, dict) else {}
        metrics = analysis.get("metricas")
        metrics = metrics if isinstance(metrics, dict) else {}

        # Educación financiera general: ampliar el concepto previo sin mezclar
        # automáticamente los datos personales del usuario.
        educational_markers = {
            "fondo de emergencia": (
                "La idea central es separar una reserva para imprevistos del dinero de uso cotidiano. "
                "Debe poder utilizarse cuando aparece una necesidad inesperada, evitando depender "
                "inmediatamente de deuda."
            ),
            "interes compuesto": (
                "La diferencia frente al interés simple es que los intereses generados pueden incorporarse "
                "al capital. En los períodos siguientes, esa base mayor puede generar nuevos intereses."
            ),
            "ahorrar": (
                "Ahorrar prioriza reservar dinero y conservar disponibilidad; invertir implica asumir algún "
                "nivel de riesgo buscando un rendimiento. Una misma persona puede usar ambas herramientas "
                "para objetivos diferentes."
            ),
            "etf": (
                "Un ETF es un vehículo que reúne activos dentro de una cartera y cuyas participaciones se "
                "negocian en mercado. El riesgo depende de los activos que contiene y de la estrategia que sigue."
            ),
            "bono": (
                "Al comprar un bono estás financiando al emisor bajo determinadas condiciones. "
                "El resultado depende, entre otras cosas, de que el emisor cumpla sus pagos y de cómo cambie "
                "el valor del instrumento en el mercado."
            ),
            "accion": (
                "Una acción representa participación en una empresa. Su precio puede variar y no existe una "
                "rentabilidad garantizada; el resultado depende de la empresa y de las condiciones del mercado."
            ),
            "stablecoin": (
                "Una stablecoin intenta mantener una referencia de valor, pero puede perderla. "
                "Su riesgo depende del mecanismo de respaldo, la liquidez, las reservas y las contrapartes involucradas."
            ),
            "diversificar": (
                "Diversificar reduce la concentración: en lugar de depender de un solo activo, distribuye la exposición. "
                "Eso puede disminuir el impacto de un problema puntual, aunque no elimina el riesgo de pérdida."
            ),
            "deficit": (
                "El déficit describe un período en el que los gastos superan los ingresos. "
                "Si se repite, la diferencia debe cubrirse con ahorros, deuda u otros recursos."
            ),
        }
        for marker, explanation in educational_markers.items():
            if marker in normalized:
                return explanation

        # Si la respuesta anterior ya es financiera/personal, ampliar con las
        # métricas verificadas disponibles sin reinterpretarlas.
        ingreso = metrics.get("ingreso_mensual")
        gasto = metrics.get("gasto_mensual_promedio")
        deuda = metrics.get("deuda_mensual")
        ahorro = metrics.get("ahorro_mensual_estimado")
        ratio_gasto = metrics.get("ratio_gasto_ingreso")
        ratio_deuda = metrics.get("ratio_deuda_ingreso")
        ratio_ahorro = metrics.get("ratio_ahorro_ingreso")

        def pct(value: Any) -> str | None:
            if value is None:
                return None
            try:
                number = Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None
            if abs(number) <= Decimal("1"):
                number *= Decimal("100")
            number = number.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
            return str(number).replace(".", ",")

        parts: list[str] = []

        # Contextualiza primero la respuesta previa sin repetirla literalmente.
        if previous:
            parts.append(
                "La respuesta anterior se basa en los datos que FinSightAI tiene registrados "
                "para tu análisis actual."
            )

        if ingreso is not None and gasto is not None:
            gasto_pct = pct(ratio_gasto)
            sentence = (
                f"Tus ingresos mensuales son **{cls._format_money(Decimal(str(ingreso)))}** "
                f"y tus gastos mensuales son **{cls._format_money(Decimal(str(gasto)))}**"
            )
            if gasto_pct:
                sentence += f", aproximadamente el **{gasto_pct}% de tus ingresos**"
            parts.append(sentence + ".")

        if deuda is not None:
            deuda_pct = pct(ratio_deuda)
            sentence = (
                f"Tu deuda mensual registrada es **{cls._format_money(Decimal(str(deuda)))}**"
            )
            if deuda_pct:
                sentence += f", aproximadamente el **{deuda_pct}% de tus ingresos**"
            parts.append(sentence + ".")

        if ahorro is not None:
            ahorro_pct = pct(ratio_ahorro)
            sentence = (
                f"Tu capacidad de ahorro mensual estimada es "
                f"**{cls._format_money(Decimal(str(ahorro)))}**"
            )
            if ahorro_pct:
                sentence += f", aproximadamente el **{ahorro_pct}% de tus ingresos**"
            parts.append(sentence + ".")

        if not parts:
            return (
                "Puedo ampliar la respuesta anterior, pero no tengo datos adicionales verificados "
                "para agregar sin inventar información."
            )

        parts.append(
            "Estos valores describen el análisis general actual. Si la respuesta anterior se refería "
            "a un período o transacción específica, ese contexto puntual tiene prioridad sobre estos promedios."
        )
        return "\n\n".join(parts)

    @staticmethod
    def _infer_education_topic_from_previous_answer(
        previous_answer: str | None,
    ) -> str | None:
        if not previous_answer:
            return None

        # Quitamos marcas Markdown antes de normalizar porque las respuestas
        # contextuales resaltan conceptos con **negrita**. Sin esto, una firma como
        # "la capacidad de ahorro..." no coincide con "la **capacidad de ahorro**...".
        previous_clean = re.sub(r"[`*_~]+", "", previous_answer)
        previous = QueryNormalizer.normalize(previous_clean).strip()

        # /agent/chat y /agent/chat/stream agregan el saludo de Finsi al primer
        # mensaje de una conversación. El servicio directo no lo agrega, por eso
        # las pruebas internas funcionaban pero el flujo real del frontend no.
        greeting_prefix = (
            "hola, soy finsi, el asistente de finsightai. "
            "puedo ayudarte a entender tus finanzas y a resolver dudas sobre la aplicacion."
        )
        if previous.startswith(greeting_prefix):
            previous = previous[len(greeting_prefix):].strip()

        # Usamos firmas deliberadamente específicas de las respuestas que genera
        # _education_topic_response(). No inferimos por palabras sueltas para evitar
        # falsos positivos como "fondo de emergencia" mencionado dentro de un resumen.
        signatures = (
            (
                "capacidad-ahorro",
                (
                    "la capacidad de ahorro representa cuanto dinero queda disponible despues de cubrir tus gastos mensuales",
                    "la capacidad de ahorro es el margen que queda despues de comparar tus ingresos mensuales con tus gastos mensuales",
                ),
            ),
            (
                "deuda-ingreso",
                (
                    "la relacion deuda/ingreso indica que porcentaje de tus ingresos mensuales esta comprometido en pagos de deuda",
                    "la relacion deuda/ingreso compara los pagos mensuales de deuda con los ingresos mensuales",
                ),
            ),
            (
                "gastos-fijos-variables",
                (
                    "los gastos fijos suelen repetirse con importes relativamente estables",
                    "los gastos fijos suelen repetirse y ser relativamente previsibles",
                ),
            ),
            (
                "fondo-emergencia",
                (
                    "un fondo de emergencia es dinero reservado para afrontar imprevistos",
                    "un fondo de emergencia es una reserva separada del dinero de uso cotidiano",
                ),
            ),
            (
                "metas-planificacion",
                (
                    "planificar una meta financiera significa convertir una intencion en un objetivo",
                    "una meta financiera se vuelve planificable cuando defines tres datos",
                ),
            ),
        )

        for topic, openings in signatures:
            if any(previous.startswith(opening) for opening in openings):
                return topic

        return None

    def _education_topic_response(
        self,
        *,
        usuario_id: str,
        topic: str,
        question: str,
    ) -> str | None:
        allowed_topics = {
            "capacidad-ahorro",
            "deuda-ingreso",
            "gastos-fijos-variables",
            "fondo-emergencia",
            "metas-planificacion",
        }
        if topic not in allowed_topics:
            return None

        analysis = self._get_analysis(usuario_id)
        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}

        ingreso = metrics.get("ingreso_mensual")
        gasto = metrics.get("gasto_mensual_promedio")
        deuda = metrics.get("deuda_mensual")
        ahorro = metrics.get("ahorro_mensual_estimado")
        ratio_deuda = metrics.get("ratio_deuda_ingreso")
        ratio_ahorro = metrics.get("ratio_ahorro_ingreso")

        def money(value: Any) -> str | None:
            if value is None:
                return None
            try:
                return self._format_money(Decimal(str(value)))
            except (InvalidOperation, ValueError, TypeError):
                return None

        def pct(value: Any, decimals: int = 1) -> str | None:
            if value is None:
                return None
            try:
                number = Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None
            if abs(number) <= Decimal("1"):
                number *= Decimal("100")
            quantum = Decimal("1") if decimals == 0 else Decimal("0.1")
            number = number.quantize(quantum, rounding=ROUND_HALF_UP)
            text = f"{number:.{decimals}f}" if decimals else f"{number:.0f}"
            return text.replace(".", ",")

        ingreso_text = money(ingreso)
        gasto_text = money(gasto)
        deuda_text = money(deuda)
        ahorro_text = money(ahorro)
        deuda_pct = pct(ratio_deuda)
        ahorro_pct = pct(ratio_ahorro)

        q = QueryNormalizer.normalize(question).strip()
        expand_terms = {
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
        expanded = q in expand_terms

        categorias = analysis.get("categorias_principales") if isinstance(analysis, dict) else []
        categorias = categorias if isinstance(categorias, list) else []
        category_names = [
            str(item.get("categoria") or "").strip()
            for item in categorias[:3]
            if isinstance(item, dict) and str(item.get("categoria") or "").strip()
        ]
        categories_text = ", ".join(f"**{name}**" for name in category_names)

        if topic == "deuda-ingreso":
            if expanded:
                parts = [
                    "La **relación deuda/ingreso** compara los pagos mensuales de deuda con los ingresos mensuales. "
                    "Se calcula dividiendo la deuda mensual por el ingreso mensual y multiplicando el resultado por 100."
                ]
                if deuda_text and ingreso_text and deuda_pct:
                    parts.append(
                        f"En tu análisis actual, registras **{deuda_text}** de pagos de deuda por mes "
                        f"sobre ingresos de **{ingreso_text}**. Eso equivale aproximadamente al "
                        f"**{deuda_pct}% de tus ingresos**."
                    )
                parts.append(
                    "Cuanto mayor es esta proporción, menos margen queda para gastos cotidianos, ahorro e imprevistos. "
                    "El indicador muestra el peso mensual de la deuda, pero no permite saber por sí solo qué deuda "
                    "conviene cancelar primero: para eso harían falta saldos, tasas, costos y plazos de cada obligación."
                )
                return "\n\n".join(parts)

            parts = [
                "La **relación deuda/ingreso** indica qué porcentaje de tus ingresos mensuales está comprometido "
                "en pagos de deuda."
            ]
            if deuda_text and ingreso_text and deuda_pct:
                parts.append(
                    f"En tu situación actual, FinSightAI registra **{deuda_text}** de deuda mensual sobre "
                    f"**{ingreso_text}** de ingresos, aproximadamente el **{deuda_pct}%**."
                )
            parts.append(
                "Este indicador influye en tu flexibilidad financiera: cuanto más ingreso se destina a deuda, "
                "menos margen queda para otros gastos, ahorro y objetivos."
            )
            return "\n\n".join(parts)

        if topic == "capacidad-ahorro":
            if expanded:
                parts = [
                    "La **capacidad de ahorro** es el margen que queda después de comparar tus ingresos mensuales "
                    "con tus gastos mensuales. En términos simples: **ingresos - gastos = margen estimado de ahorro**."
                ]
                if ingreso_text and gasto_text and ahorro_text:
                    parts.append(
                        f"Con tus valores actuales, **{ingreso_text} - {gasto_text} = {ahorro_text}** de margen mensual estimado."
                    )
                if ahorro_pct:
                    parts.append(
                        f"Ese margen representa aproximadamente el **{ahorro_pct}% de tus ingresos**."
                    )
                parts.append(
                    "Es una estimación del análisis general y no el saldo real de un mes específico. "
                    "Sirve para medir cuánto espacio existe para imprevistos, metas o ahorro sin comprometer "
                    "los gastos ya considerados."
                )
                return "\n\n".join(parts)

            parts = [
                "La **capacidad de ahorro** representa cuánto dinero queda disponible después de cubrir tus gastos mensuales."
            ]
            if ingreso_text and gasto_text and ahorro_text:
                parts.append(
                    f"En tu análisis actual, tus ingresos son **{ingreso_text}**, tus gastos mensuales "
                    f"**{gasto_text}** y tu margen estimado es **{ahorro_text}**."
                )
            if ahorro_pct:
                parts.append(
                    f"Eso equivale aproximadamente al **{ahorro_pct}% de tus ingresos**."
                )
            parts.append(
                "Cuanto mayor sea ese margen, más flexibilidad tienes para afrontar imprevistos o avanzar hacia objetivos."
            )
            return "\n\n".join(parts)

        if topic == "gastos-fijos-variables":
            if expanded:
                parts = [
                    "Los **gastos fijos** suelen repetirse y ser relativamente previsibles, mientras que los "
                    "**gastos variables** cambian según el consumo, las decisiones y las circunstancias de cada período."
                ]
                if gasto_text:
                    parts.append(
                        f"Tu gasto mensual promedio actual es **{gasto_text}**."
                    )
                if categories_text:
                    parts.append(
                        f"Las categorías con mayor peso son {categories_text}. Estas categorías ayudan a ubicar "
                        "dónde se concentra el gasto, pero una categoría completa no debe considerarse automáticamente "
                        "fija o variable."
                    )
                parts.append(
                    "FinSightAI también puede registrar si un movimiento es recurrente, pero **recurrente no significa "
                    "necesariamente fijo**. Para clasificar correctamente conviene revisar cada obligación: alquileres "
                    "o cuotas suelen ser más previsibles; compras discrecionales, ocio o consumos que cambian de monto "
                    "suelen tener mayor componente variable."
                )
                return "\n\n".join(parts)

            parts = [
                "Los **gastos fijos** suelen repetirse con importes relativamente estables; los **variables** cambian "
                "más según el consumo y las decisiones de cada período."
            ]
            if gasto_text:
                parts.append(
                    f"En tu caso, el gasto mensual promedio registrado es **{gasto_text}**."
                )
            if categories_text:
                parts.append(
                    f"Hoy el mayor peso está en {categories_text}. Eso muestra dónde se concentra el gasto, "
                    "pero FinSightAI no debería etiquetar una categoría completa como fija o variable sin revisar "
                    "sus movimientos."
                )
            return "\n\n".join(parts)

        if topic == "fondo-emergencia":
            if expanded:
                parts = [
                    "Un **fondo de emergencia** es una reserva separada del dinero de uso cotidiano para cubrir "
                    "imprevistos o una reducción temporal de ingresos sin depender inmediatamente de nueva deuda."
                ]
                if ahorro_text:
                    parts.append(
                        f"Tu capacidad de ahorro estimada actual es **{ahorro_text} al mes**. Ese valor puede servir "
                        "como referencia para pensar aportes graduales, siempre que no comprometan gastos y obligaciones."
                    )
                parts.append(
                    "El tamaño adecuado depende de cuáles sean tus gastos esenciales, la estabilidad de tus ingresos "
                    "y otras fuentes de respaldo. FinSightAI no debería inventar una meta exacta si no tiene identificado "
                    "qué parte de tus gastos es verdaderamente esencial."
                )
                return "\n\n".join(parts)

            parts = [
                "Un **fondo de emergencia** es dinero reservado para afrontar imprevistos sin tener que recurrir "
                "de inmediato a deuda o desarmar otros objetivos."
            ]
            if ahorro_text:
                parts.append(
                    f"Según tu análisis actual, dispones de un margen estimado de **{ahorro_text} al mes**. "
                    "Ese margen puede ayudarte a construir una reserva de forma progresiva."
                )
            parts.append(
                "La meta concreta debe adaptarse a tus gastos esenciales y a la estabilidad de tus ingresos."
            )
            return "\n\n".join(parts)

        if topic == "metas-planificacion":
            if expanded:
                parts = [
                    "Una **meta financiera** se vuelve planificable cuando defines tres datos: qué quieres lograr, "
                    "cuánto necesitas y para cuándo quieres alcanzarlo."
                ]
                if ahorro_text:
                    parts.append(
                        f"Tu capacidad de ahorro mensual estimada es **{ahorro_text}**. Puede usarse como referencia "
                        "para comparar cuánto podrías reservar con el aporte que exigiría una meta."
                    )
                parts.append(
                    "Una forma sencilla de estimar el ritmo es dividir el monto que falta por la cantidad de meses "
                    "disponibles. Si el aporte necesario supera tu margen actual, puedes ajustar el plazo, el monto "
                    "del objetivo o buscar mejorar el margen antes de comprometerte."
                )
                parts.append(
                    "La capacidad de ahorro es una referencia, no una garantía: puede variar si cambian tus ingresos, "
                    "gastos u obligaciones."
                )
                return "\n\n".join(parts)

            parts = [
                "Planificar una **meta financiera** significa convertir una intención en un objetivo con monto, fecha "
                "y un ritmo de ahorro medible."
            ]
            if ahorro_text:
                parts.append(
                    f"En tu situación actual, FinSightAI estima una capacidad de ahorro de **{ahorro_text} al mes**. "
                    "Ese margen sirve como punto de comparación para evaluar si el aporte mensual de una meta es realista."
                )
            parts.append(
                "Si una meta exige más de lo que tu margen permite, conviene ajustar el plazo o el objetivo en lugar "
                "de asumir un compromiso que no encaje con tus finanzas actuales."
            )
            return "\n\n".join(parts)

        return None

    @classmethod
    def _local_financial_education_response(
        cls,
        question: str,
        *,
        previous_answer: str | None = None,
    ) -> str | None:
        q = QueryNormalizer.normalize(question).strip()

        # Follow-up educativo local. El concepto se reconoce por el contenido
        # de la respuesta anterior, sin insertar marcadores visibles/invisibles.
        expand_terms = {
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
        if previous_answer and q in expand_terms:
            previous = QueryNormalizer.normalize(previous_answer)

            if "producto interno bruto" in previous or re.search(r"\\bpib\\b", previous):
                return (
                    "El **Producto Interno Bruto (PIB)** permite observar cuánto produce una economía "
                    "durante un período determinado. Una forma habitual de expresarlo es "
                    "**PIB = consumo + inversión + gasto público + exportaciones - importaciones**.\n\n"
                    "El **PIB nominal** usa los precios corrientes del período, mientras que el **PIB real** "
                    "ajusta el efecto de los cambios de precios para comparar mejor la producción entre períodos. "
                    "También puede calcularse el **PIB per cápita** dividiendo el PIB por la población.\n\n"
                    "Es un indicador útil para analizar la actividad económica, pero no describe por sí solo "
                    "cómo se distribuye el ingreso ni mide completamente el bienestar o la calidad de vida."
                )

            if "inflacion" in previous:
                return (
                    "La **inflación** implica que, en promedio, el dinero pierde poder de compra con el tiempo: "
                    "si los precios suben y tus ingresos no aumentan al mismo ritmo, puedes comprar menos con la "
                    "misma cantidad de dinero.\n\n"
                    "Suele medirse mediante índices de precios que siguen la evolución de una canasta de bienes "
                    "y servicios. Puede estar relacionada con aumentos de la demanda, mayores costos de producción, "
                    "expectativas de subas futuras u otros factores económicos.\n\n"
                    "No significa que todos los precios aumenten exactamente igual ni al mismo tiempo; se refiere "
                    "a una variación general del nivel de precios."
                )

            if "tasa de interes" in previous:
                return (
                    "La **tasa de interés** indica cuánto cuesta usar dinero prestado o cuánto puede rendir un "
                    "capital durante un período. Por ejemplo, sobre un capital de **$1.000**, una tasa simple del "
                    "**10%** para ese período equivale a **$100** de interés.\n\n"
                    "Puede ser **fija**, si permanece estable según las condiciones acordadas, o **variable**, "
                    "si cambia de acuerdo con una referencia. También es importante distinguir la tasa informada "
                    "del costo o rendimiento efectivo, porque la capitalización, los plazos, comisiones y otros "
                    "cargos pueden modificar el resultado final.\n\n"
                    "Por eso, al comparar créditos o inversiones no conviene mirar únicamente un porcentaje "
                    "aislado, sino también el período y las condiciones a las que corresponde."
                )

            if "fondo de emergencia" in previous:
                return (
                    "Un fondo de emergencia funciona como una reserva para gastos imprevistos, "
                    "por ejemplo una reparación urgente o una caída temporal de ingresos. "
                    "La idea es mantenerlo separado del dinero de uso cotidiano y en un lugar "
                    "de fácil acceso, para no tener que recurrir a deuda ante un imprevisto."
                )
            if "interes compuesto" in previous:
                return (
                    "Con interés compuesto, los intereses que se generan se suman al capital "
                    "y pueden generar nuevos intereses en los períodos siguientes. "
                    "Por eso el tiempo y la reinversión tienen un efecto importante sobre el resultado."
                )
            if "etf" in previous:
                return (
                    "Un ETF agrupa una cartera de activos y sus participaciones se compran y venden "
                    "en mercado. Puede seguir un índice, un sector, bonos u otras estrategias. "
                    "Su riesgo depende de los activos que contiene; ser un ETF no lo vuelve seguro por sí mismo."
                )
            if "stablecoin" in previous:
                return (
                    "Una stablecoin intenta mantener un valor relativamente estable respecto de un activo "
                    "de referencia, con frecuencia una moneda. Esa estabilidad depende de su mecanismo, "
                    "reservas, emisor y liquidez, por lo que no significa ausencia de riesgo."
                )
            if "diversificar" in previous or "diversificacion" in previous:
                return (
                    "Diversificar busca evitar que todo el resultado dependa de una sola inversión. "
                    "Puede hacerse distribuyendo la exposición entre distintos activos, emisores, sectores "
                    "o regiones. Reduce riesgos de concentración, aunque no elimina la posibilidad de pérdidas."
                )
            if "deficit" in previous:
                return (
                    "Un **déficit** ocurre cuando, durante un período, tus gastos superan tus ingresos. "
                    "La diferencia entre ambos representa el monto que falta para equilibrar ese período. "
                    "Un déficit puntual no implica necesariamente un problema permanente, pero si se repite "
                    "puede reducir el ahorro disponible o requerir otros recursos para cubrir la diferencia."
                )

        definitions: tuple[tuple[tuple[str, ...], str], ...] = (
            (
                ("que es el pib", "que es pib", "producto interno bruto"),
                "El **Producto Interno Bruto (PIB)** es el valor total de los bienes y servicios finales "
                "producidos dentro de un país durante un período determinado, normalmente un año o un trimestre. "
                "Se utiliza como uno de los principales indicadores del tamaño y la evolución de una economía.",
            ),
            (
                ("que es la inflacion", "que significa inflacion", "inflacion"),
                "La **inflación** es el aumento general y sostenido del nivel de precios de bienes y servicios "
                "en una economía durante un período. Cuando ocurre, el dinero pierde poder adquisitivo: "
                "con la misma cantidad se pueden comprar menos bienes y servicios que antes.",
            ),
            (
                ("que es una tasa de interes", "que es la tasa de interes", "que significa tasa de interes"),
                "Una **tasa de interés** es un porcentaje que expresa el costo de pedir dinero prestado o "
                "el rendimiento asociado a prestar o invertir dinero durante un período determinado. "
                "Para interpretarla correctamente es importante conocer el período y las condiciones a las que se aplica.",
            ),
            (
                ("fondo de emergencia",),
                "Un **fondo de emergencia** es una reserva de dinero destinada a cubrir imprevistos "
                "sin depender inmediatamente de deuda. Se procura que sea accesible y esté separada "
                "del dinero usado para gastos cotidianos.",
            ),
            (
                ("interes compuesto",),
                "El **interés compuesto** ocurre cuando los intereses generados se incorporan al capital "
                "y, en los períodos siguientes, también pueden generar intereses. Por eso el crecimiento "
                "se calcula sobre una base que puede ir aumentando con el tiempo.",
            ),
            (
                ("diferencia hay entre ahorrar e invertir", "diferencia entre ahorrar e invertir"),
                "**Ahorrar** consiste en reservar dinero para usarlo más adelante, normalmente priorizando "
                "disponibilidad y estabilidad. **Invertir** implica colocar dinero en activos con la expectativa "
                "de obtener un rendimiento, aceptando algún nivel de riesgo. Son objetivos relacionados, "
                "pero no son lo mismo.",
            ),
            (
                ("que es un etf", "que es etf", "un etf"),
                "Un **ETF** es un fondo cuyas participaciones se negocian en mercado. Suele agrupar varios "
                "activos y puede seguir un índice, sector, conjunto de bonos u otra estrategia. "
                "Su nivel de riesgo depende de lo que tenga dentro.",
            ),
            (
                ("que es un bono", "que es bono", "un bono"),
                "Un **bono** es un instrumento de deuda: quien lo emite recibe dinero de los inversores "
                "y asume la obligación de devolverlo según las condiciones establecidas, que pueden incluir "
                "pagos de intereses. Tiene riesgos, entre ellos el de que el emisor no pueda cumplir.",
            ),
            (
                ("que es una accion", "que es accion", "una accion"),
                "Una **acción** representa una participación en una empresa. Su valor puede subir o bajar "
                "según las expectativas del mercado y la situación de la compañía. Algunas empresas además "
                "pueden distribuir dividendos, pero no están garantizados.",
            ),
            (
                ("que es una stablecoin", "que es stablecoin", "una stablecoin"),
                "Una **stablecoin** es un criptoactivo diseñado para intentar mantener un valor estable "
                "respecto de un activo de referencia, frecuentemente una moneda. El mecanismo puede variar "
                "y existen riesgos de reservas, contraparte, liquidez y pérdida de paridad.",
            ),
            (
                ("que significa diversificar una inversion", "diversificar una inversion", "diversificacion"),
                "**Diversificar una inversión** significa repartir la exposición entre distintos activos "
                "en lugar de concentrarla en uno solo. El objetivo es reducir el impacto que tendría "
                "el mal desempeño de una inversión específica; no elimina todos los riesgos.",
            ),
            (
                ("que es deficit", "que significa deficit"),
                "Un **déficit** ocurre cuando los gastos superan a los ingresos durante un período. "
                "La diferencia entre ambos es el monto que falta para equilibrar ese período.",
            ),
        )

        for markers, answer in definitions:
            if any(marker in q for marker in markers):
                return answer
        return None

    @classmethod
    def _local_recommendation_or_budget_response(
        cls,
        question: str,
        *,
        intent: Intent,
        analysis: dict[str, Any],
    ) -> str | None:
        if not isinstance(analysis, dict):
            return None

        q = QueryNormalizer.normalize(question)
        metrics = analysis.get("metricas")
        metrics = metrics if isinstance(metrics, dict) else {}

        ingreso_raw = metrics.get("ingreso_mensual")
        gasto_raw = metrics.get("gasto_mensual_promedio")
        deuda_raw = metrics.get("deuda_mensual")
        ahorro_raw = metrics.get("ahorro_mensual_estimado")
        ratio_gasto_raw = metrics.get("ratio_gasto_ingreso")
        ratio_deuda_raw = metrics.get("ratio_deuda_ingreso")

        def money(value: Any) -> str | None:
            if value is None:
                return None
            try:
                return cls._format_money(Decimal(str(value)))
            except (InvalidOperation, ValueError, TypeError):
                return None

        def pct(value: Any, decimals: int = 1) -> str | None:
            if value is None:
                return None
            try:
                number = Decimal(str(value))
            except (InvalidOperation, ValueError, TypeError):
                return None
            if abs(number) <= Decimal("1"):
                number *= Decimal("100")
            quantum = Decimal("1") if decimals == 0 else Decimal("0." + ("0" * (decimals - 1)) + "1")
            number = number.quantize(quantum, rounding=ROUND_HALF_UP)
            text = f"{number:.{decimals}f}" if decimals > 0 else f"{number:.0f}"
            return text.replace(".", ",")

        ingreso = money(ingreso_raw)
        gasto = money(gasto_raw)
        deuda = money(deuda_raw)
        ahorro = money(ahorro_raw)
        ratio_gasto = pct(ratio_gasto_raw, 1)
        ratio_deuda = pct(ratio_deuda_raw, 1)

        categorias = analysis.get("categorias_principales")
        categorias = categorias if isinstance(categorias, list) else []
        top_categories: list[str] = []
        for item in categorias[:3]:
            if not isinstance(item, dict):
                continue
            nombre = str(item.get("categoria") or "").strip()
            monto = money(item.get("monto"))
            porcentaje = item.get("porcentaje")
            pct_cat = pct(porcentaje, 0)
            if not nombre:
                continue
            detail = f"**{nombre}**"
            if monto:
                detail += f" ({monto}"
                if pct_cat is not None:
                    detail += f", {pct_cat}% del gasto"
                detail += ")"
            elif pct_cat is not None:
                detail += f" ({pct_cat}% del gasto)"
            top_categories.append(detail)

        categorias_text = ", ".join(top_categories) if top_categories else "las categorías de mayor peso"

        # Presupuesto mensual: siempre local y basado en los datos actuales.
        if intent == Intent.BUDGET or "presupuesto" in q:
            if not (ingreso and gasto):
                return (
                    "Puedo ayudarte a armar un presupuesto, pero primero necesito un análisis financiero "
                    "con ingresos y gastos mensuales disponibles."
                )
            margen = money(ahorro_raw)
            return (
                "**Base para tu presupuesto mensual**\n\n"
                f"- Ingresos mensuales: **{ingreso}**.\n"
                f"- Gastos mensuales actuales: **{gasto}**"
                + (f" (aprox. {ratio_gasto}% de tus ingresos)." if ratio_gasto else ".")
                + (f"\n- Margen estimado después de gastos: **{margen}**." if margen else "")
                + "\n\n"
                f"Empieza controlando {categorias_text}. Usa esos montos como referencia inicial "
                "y define un límite para cada categoría que no supere el ingreso disponible. "
                "El objetivo del presupuesto es que cada gasto tenga un lugar definido y que el total "
                "no exceda tus ingresos."
            )

        if "ordenar mejor mis deudas" in q or "ordenar mis deudas" in q:
            return (
                "Para ordenar mejor tus deudas, primero arma una lista con **saldo pendiente, tasa o costo, "
                "cuota mensual y plazo** de cada obligación. "
                + (
                    f"Actualmente tus pagos de deuda registrados son **{deuda} por mes**, "
                    f"aproximadamente el **{ratio_deuda}% de tus ingresos**. "
                    if deuda and ratio_deuda
                    else ""
                )
                + "Con la información completa, prioriza las obligaciones de mayor costo sin dejar de cumplir "
                "los pagos mínimos de las demás. FinSightAI no tiene hoy el saldo, la tasa ni el plazo de cada "
                "deuda, así que no sería correcto inventar cuál deberías cancelar primero."
            )

        if "reducir mis gastos" in q or "bajar mis gastos" in q or "gastar menos" in q:
            return (
                f"Para reducir tus gastos, empieza por revisar {categorias_text}. "
                + (
                    f"Actualmente gastas aproximadamente el **{ratio_gasto}% de tus ingresos**, "
                    f"con un gasto mensual de **{gasto}**. "
                    if gasto and ratio_gasto
                    else ""
                )
                + "Busca dentro de esas categorías gastos que puedas reducir o renegociar sin asumir "
                "que todos son prescindibles. Conviene medir el efecto de cada ajuste sobre el gasto total "
                "antes de convertirlo en un cambio permanente."
            )

        if "mejorar mi situacion financiera" in q or "mejorar mis finanzas" in q:
            return (
                "Tus prioridades actuales pueden ordenarse en tres frentes:\n\n"
                f"1. **Gastos:** revisar {categorias_text}"
                + (f", porque hoy consumen cerca del {ratio_gasto}% de tus ingresos." if ratio_gasto else ".")
                + "\n"
                f"2. **Deuda:** mantener bajo seguimiento la carga mensual"
                + (f" de {deuda} ({ratio_deuda}% de tus ingresos)." if deuda and ratio_deuda else ".")
                + "\n"
                f"3. **Margen:** proteger y, si es posible, aumentar el saldo mensual"
                + (f" estimado de {ahorro}." if ahorro else ".")
                + "\n\nEstos pasos se basan en tus indicadores actuales; no requieren asumir tasas, "
                "plazos ni gastos que FinSightAI no tenga registrados."
            )

        if "mejorar mi capacidad de ahorro" in q or "capacidad de ahorro" in q:
            return (
                f"Para mejorar tu capacidad de ahorro, revisa primero {categorias_text}. "
                + (
                    f"Tu margen estimado actual es **{ahorro} al mes** y tus gastos representan "
                    f"aproximadamente el **{ratio_gasto}% de tus ingresos**. "
                    if ahorro and ratio_gasto
                    else ""
                )
                + "Cada reducción sostenible del gasto aumenta directamente ese margen, siempre que tus "
                "ingresos y las demás obligaciones se mantengan."
            )

        if "que gastos deberia revisar" in q or "que gasto deberia revisar" in q:
            return (
                f"Deberías revisar principalmente {categorias_text}. "
                "Son los rubros con mayor peso dentro de tu gasto actual, por lo que cualquier ajuste "
                "realista allí tendría más impacto que recortar primero categorías pequeñas."
            )

        if (
            "que deberia mejorar primero" in q
            or "que deberia priorizar" in q
            or "por donde deberia empezar" in q
        ):
            return (
                f"Empezaría por **revisar el gasto de mayor peso**, especialmente {categorias_text}. "
                + (
                    f"Tus gastos representan aproximadamente el **{ratio_gasto}% de tus ingresos**"
                    if ratio_gasto
                    else "Tus gastos dejan un margen reducido"
                )
                + (
                    f" y la deuda mensual equivale a cerca del **{ratio_deuda}%**. "
                    if ratio_deuda
                    else ". "
                )
                + (
                    f"Al mismo tiempo, procura conservar el margen estimado de **{ahorro} al mes**."
                    if ahorro
                    else ""
                )
            )

        # Fallback local general para cualquier otra recomendación reconocida.
        if intent == Intent.RECOMMENDATIONS:
            return (
                f"Como punto de partida, revisa {categorias_text}. "
                + (
                    f"Tus gastos mensuales son **{gasto}** sobre ingresos de **{ingreso}**. "
                    if gasto and ingreso
                    else ""
                )
                + (
                    f"Tu margen mensual estimado es **{ahorro}**. "
                    if ahorro
                    else ""
                )
                + "Prioriza cambios que puedas medir con tus datos y evita asumir información sobre "
                "tasas, plazos o compromisos que FinSightAI no tenga registrados."
            )

        return None

    def _largest_expense_follow_up_response(
        self,
        usuario_id: str,
        previous_answer: str,
    ) -> str | None:
        normalized_previous = QueryNormalizer.normalize(previous_answer)

        if "tu mayor gasto fue" not in normalized_previous:
            return None

        try:
            transactions = fetch_user_transactions(usuario_id)
        except (BackendDataError, ValueError):
            return None

        expenses = [
            tx
            for tx in transactions
            if str(tx.get("tipo") or "").upper() == "GASTO"
            and float(tx.get("monto") or 0) > 0
        ]

        if not expenses:
            return None

        largest = max(
            expenses,
            key=lambda tx: float(tx.get("monto") or 0),
        )

        monto = Decimal(str(largest.get("monto") or 0))
        descripcion = str(
            largest.get("descripcion") or "Sin descripción"
        ).strip()
        categoria = str(
            largest.get("categoria") or "Sin categoría"
        ).strip()
        fecha_raw = largest.get("fecha")

        fecha_texto = ""
        if fecha_raw:
            try:
                fecha = datetime.fromisoformat(str(fecha_raw)).date()
                fecha_texto = f" el **{fecha.strftime('%d/%m/%Y')}**"
            except ValueError:
                fecha_texto = f" el **{fecha_raw}**"

        categoria_principal = None
        try:
            analysis = fetch_live_analysis(usuario_id)
            categorias = analysis.get("categorias_principales") or []
            if isinstance(categorias, list) and categorias:
                primera = categorias[0]
                if isinstance(primera, dict):
                    categoria_principal = str(
                        primera.get("categoria") or ""
                    ).strip() or None
        except (BackendDataError, ValueError):
            categoria_principal = None

        respuesta = (
            f"Tu gasto más alto registrado fue **{self._format_money(monto)}** "
            f"por **{descripcion}**, dentro de la categoría **{categoria}**"
            f"{fecha_texto}.\n\n"
            "Esto significa que fue la transacción individual de gasto de mayor "
            "monto dentro de tu historial registrado."
        )

        if categoria_principal and categoria_principal != categoria:
            respuesta += (
                "\n\nEs distinto de tu categoría de mayor gasto en conjunto: "
                f"esa categoría es **{categoria_principal}**. Una transacción "
                "puntual puede ser la más grande sin que su categoría sea la que "
                "más peso tenga en el total."
            )

        respuesta += (
            "\n\nNo tengo información adicional sobre qué se compró "
            "específicamente ni sobre el motivo de ese gasto, por lo que no sería "
            "correcto inferirlo."
        )

        return respuesta

    def _debt_follow_up_response(
        self,
        usuario_id: str,
        previous_answer: str,
    ) -> str | None:
        normalized_previous = QueryNormalizer.normalize(previous_answer)

        debt_markers = (
            "nivel de endeudamiento actual es",
            "deuda mensual registrada es",
            "porcentaje de mis ingresos destino a deuda",
            "destinas aproximadamente",
        )
        if not any(marker in normalized_previous for marker in debt_markers):
            return None

        try:
            analysis = fetch_live_analysis(usuario_id)
        except (BackendDataError, ValueError):
            return None

        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}

        ingreso_raw = metrics.get("ingreso_mensual")
        deuda_raw = metrics.get("deuda_mensual")
        ratio_raw = metrics.get("ratio_deuda_ingreso")

        if ingreso_raw is None or deuda_raw is None:
            return None

        try:
            ingreso = Decimal(str(ingreso_raw))
            deuda = Decimal(str(deuda_raw))
            if ratio_raw is not None:
                ratio = Decimal(str(ratio_raw))
                porcentaje = (
                    ratio * Decimal("100")
                    if ratio <= Decimal("1")
                    else ratio
                )
            elif ingreso > 0:
                porcentaje = deuda / ingreso * Decimal("100")
            else:
                return None
        except (InvalidOperation, ValueError, TypeError):
            return None

        porcentaje = porcentaje.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        if porcentaje <= Decimal("20"):
            rango = (
                "Según los rangos utilizados por FinSightAI, se encuentra "
                "dentro de un rango saludable."
            )
        elif porcentaje <= Decimal("40"):
            rango = (
                "Según los rangos utilizados por FinSightAI, se encuentra "
                "en un rango intermedio y cerca del límite superior del 40%, "
                "por lo que conviene mantenerlo bajo seguimiento."
            )
        else:
            rango = (
                "Según los rangos utilizados por FinSightAI, se encuentra "
                "en un rango alto y conviene priorizar la revisión de las "
                "obligaciones mensuales."
            )

        return (
            f"Tu nivel de endeudamiento es **{str(f'{porcentaje:.2f}').replace('.', ',')}%**. "
            f"Con ingresos mensuales de **{self._format_money(ingreso)}**, "
            f"esto equivale aproximadamente a **{self._format_money(deuda)} "
            "por mes** destinados a deuda.\n\n"
            f"{rango}\n\n"
            "Este indicador muestra qué parte de tus ingresos mensuales está "
            "comprometida con pagos de deuda. No tengo información suficiente "
            "sobre el saldo total, las tasas de interés ni los plazos de esas "
            "obligaciones, por lo que no sería correcto inferir su costo total "
            "o cómo evolucionarán las cuotas."
        )

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
    def _is_savings_capacity_follow_up(
        question: str,
        previous_answer: str | None,
    ) -> bool:
        """Reconoce continuaciones breves de una consulta sobre capacidad de ahorro.

        El objetivo es conservar el contexto financiero antes de que los detectores
        amplios de soporte evalúen frases ambiguas como "puedes calcularla".
        """
        if not previous_answer:
            return False

        previous = QueryNormalizer.normalize(previous_answer)
        if not any(
            marker in previous
            for marker in (
                "capacidad de ahorro",
                "ahorro mensual estimado",
                "ahorro mensual registrado",
                "puedes ahorrar cada mes",
                "puedes ahorrar aproximadamente",
            )
        ):
            return False

        normalized = QueryNormalizer.normalize(question).strip()
        exact_follow_ups = {
            "puedes calcularla",
            "podes calcularla",
            "puedes calcularlo",
            "podes calcularlo",
            "calculala",
            "calculalo",
            "calcula eso",
            "si calculala",
            "si calculalo",
            "cuanto es",
            "y cuanto es",
            "cuanto seria",
            "y cuanto seria",
            "cuanto puedo ahorrar",
            "y cuanto puedo ahorrar",
            "decime cuanto",
            "dime cuanto",
        }
        if normalized in exact_follow_ups:
            return True

        return bool(
            re.search(
                r"^(?:puedes|podes|podrias|podrias)\s+calcular(?:la|lo)?$",
                normalized,
            )
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
        # AsÃ­ tambiÃ©n reconoce ðŸ‘ðŸ», ðŸ‘ðŸ¼, â¤ï¸ y otras variantes visuales.
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

        if cleaned in {"ðŸ‘", "ðŸ‘Œ", "âœ…", "ðŸ‘", "ðŸ™Œ"}:
            return "¡Perfecto! 😊"

        if cleaned in {"😂", "🤣"}:
            return "😂"

        if cleaned in {"ðŸ˜„", "ðŸ˜€", "ðŸ˜ƒ", "ðŸ˜", "ðŸ˜…"}:
            return "😄"

        if cleaned in {"â¤", "ðŸ’™", "ðŸ’š", "ðŸ©µ"}:
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
        except (BackendDataError, ValueError):
            return analizar_usuario(usuario_id)

    @classmethod
    def _current_month_transaction_response(
        cls,
        transactions: list[dict[str, Any]],
        transaction_type: str,
        today: date,
    ) -> str | None:
        """Resume el total REAL del mes actual usando transacciones hasta hoy."""
        frame = profile_data.pd.DataFrame(transactions)
        if frame.empty or "tipo" not in frame.columns or "monto" not in frame.columns:
            return None

        frame = frame[
            frame["tipo"].astype(str).str.strip().str.upper().eq(transaction_type.upper())
        ].copy()
        if frame.empty:
            return None

        if "fecha" not in frame.columns:
            return None

        frame["_fecha_mes"] = profile_data.pd.to_datetime(frame["fecha"], errors="coerce")
        frame = frame[
            frame["_fecha_mes"].notna()
            & frame["_fecha_mes"].dt.year.eq(today.year)
            & frame["_fecha_mes"].dt.month.eq(today.month)
            & frame["_fecha_mes"].dt.date.le(today)
        ].copy()

        if frame.empty:
            noun = "ingresos" if transaction_type.upper() == "INGRESO" else "gastos"
            return f"No encontré {noun} registrados este mes hasta hoy."

        amounts = profile_data.pd.to_numeric(frame["monto"], errors="coerce").fillna(0)
        total = Decimal(str(amounts.sum()))
        count = len(frame)
        movement_word = "movimiento" if count == 1 else "movimientos"

        if transaction_type.upper() == "INGRESO":
            return f"Ingresaste {cls._format_money(total)} este mes en {count} {movement_word}."
        return f"Gastaste {cls._format_money(total)} este mes en {count} {movement_word}."

    @classmethod
    def _current_month_transaction_follow_up_response(
        cls,
        usuario_id: str,
        previous_answer: str,
        today: date,
    ) -> str | None:
        """Amplía un total del mes sin mezclarlo con promedios del Dashboard."""
        normalized = QueryNormalizer.normalize(previous_answer)
        is_expense = "gastaste" in normalized and "este mes" in normalized
        is_income = "ingresaste" in normalized and "este mes" in normalized
        if not (is_expense or is_income):
            return None

        try:
            transactions = fetch_user_transactions(usuario_id)
        except (BackendDataError, ValueError):
            return None

        transaction_type = "GASTO" if is_expense else "INGRESO"
        summary = cls._current_month_transaction_response(
            transactions=transactions,
            transaction_type=transaction_type,
            today=today,
        )
        if summary is None:
            return None

        frame = profile_data.pd.DataFrame(transactions)
        frame = frame[
            frame["tipo"].astype(str).str.strip().str.upper().eq(transaction_type)
        ].copy()
        frame["_fecha_mes"] = profile_data.pd.to_datetime(frame["fecha"], errors="coerce")
        frame = frame[
            frame["_fecha_mes"].notna()
            & frame["_fecha_mes"].dt.year.eq(today.year)
            & frame["_fecha_mes"].dt.month.eq(today.month)
            & frame["_fecha_mes"].dt.date.le(today)
        ].copy()
        amounts = profile_data.pd.to_numeric(frame["monto"], errors="coerce").fillna(0)
        total = Decimal(str(amounts.sum()))
        count = len(frame)
        movement_word = "movimiento" if count == 1 else "movimientos"
        kind = "gastos" if is_expense else "ingresos"

        return (
            f"Este mes llevas registrados **{cls._format_money(total)}** en {kind}, "
            f"distribuidos en **{count} {movement_word}** hasta el **{today.strftime('%d/%m/%Y')}**.\n\n"
            "Este total se calcula directamente con las transacciones del mes actual hasta hoy. "
            "No corresponde al promedio mensual ni a la métrica mensual estimada del análisis general."
        )

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
        except (BackendDataError, ValueError):
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

    @staticmethod
    def _is_canonical_validation_question(question: str) -> bool:
        """Las 30 preguntas oficiales de validación responden siempre en local."""
        q = QueryNormalizer.normalize(question).strip().rstrip(".?!")
        canonical = {
            "dame mi resumen financiero",
            "como estan mis finanzas actualmente",
            "cual es mi perfil financiero",
            "por que estoy en este perfil financiero",
            "cual es mi puntaje financiero",
            "cuanto ingreso por mes",
            "cuanto estoy gastando por mes",
            "cuales son mis principales categorias de gastos",
            "en que categoria estoy gastando mas",
            "que porcentaje de mis ingresos estoy gastando",
            "como esta mi nivel de endeudamiento",
            "que porcentaje de mis ingresos destino a deuda",
            "cual es mi capacidad de ahorro",
            "estoy gastando mas de lo que ingreso",
            "cuanto me queda despues de mis gastos",
            "que deberia mejorar primero en mis finanzas",
            "que gastos deberia revisar",
            "como puedo mejorar mi capacidad de ahorro",
            "que puedo hacer para reducir mis gastos",
            "que puedo hacer para mejorar mi situacion financiera",
            "como puedo ordenar mejor mis deudas",
            "puedes ayudarme a armar un presupuesto mensual",
            "que es un fondo de emergencia",
            "que es el interes compuesto",
            "que diferencia hay entre ahorrar e invertir",
            "que es un etf",
            "que es un bono",
            "que es una accion",
            "que es una stablecoin",
            "que significa diversificar una inversion",
        }
        return q in canonical

    @staticmethod
    def _is_free_financial_llm_question(question: str, intent: Intent) -> bool:
        """Detecta preguntas financieras abiertas que requieren interpretación del LLM."""
        q = QueryNormalizer.normalize(question).strip()
        if not q:
            return False

        open_markers = (
            "que patron",
            "patron ves",
            "que tendencia",
            "que senales",
            "que señal",
            "que no estoy viendo",
            "quizas no estoy viendo",
            "como cambiaria",
            "que pasaria si",
            "que ocurriria si",
            "si logro",
            "si aumento",
            "si reduzco",
            "si mantengo",
            "mi panorama",
            "que escenario",
            "que estrategia",
            "que tendria mas impacto",
            "que tiene mas impacto",
            "me conviene",
            "que conviene",
            "que priorizo",
            "que deberia priorizar",
            "que tan sostenible",
            "que tan vulnerable",
            "que riesgo ves",
            "que aspecto",
            "que relacion ves",
            "que harías",
            "que harias",
            "que opinas",
            # Planes libres/personalizados: no deben caer en el responder
            # genérico de RECOMMENDATIONS/BUDGET.
            "plan concreto",
            "proponeme un plan",
            "propone un plan",
            "armame un plan",
            "hazme un plan",
            "prioriza objetivos",
            "priorices objetivos",
            "aprovechar mejor",
            "dinero que me queda",
            "como distribuir",
            "como repartir",
            "dame porcentajes",
            "con porcentajes",
            "justifica cada decision",
            "justifiques cada decision",
        )
        if any(marker in q for marker in open_markers):
            return True

        # Si el detector ya reconoció una intención analítica, dejamos pasar las
        # formulaciones claramente hipotéticas/comparativas aunque no coincidan con
        # una frase concreta de arriba.
        if intent in {Intent.SUMMARY, Intent.FULL_ANALYSIS, Intent.RECOMMENDATIONS, Intent.BUDGET}:
            return any(
                token in q
                for token in (
                    " si ",
                    "compar",
                    "impacto",
                    "escenario",
                    "panorama",
                    "tendencia",
                    "patron",
                    "plan",
                    "prioriz",
                    "porcentaje",
                    "distribu",
                    "repart",
                    "aprovechar",
                )
            )

        return False

    @staticmethod
    def _should_llm_explain_financial_question(question: str, intent: Intent) -> bool:
        """Distingue una consulta explicativa de una lectura factual de métricas.

        Las cifras, transacciones, metas y cálculos permanecen determinísticos. En
        cambio, preguntas que piden razones, interpretación, consejo o explicación
        deben aprovechar el LLM con el contexto financiero ya verificado.
        """
        if intent not in {
            Intent.INCOME,
            Intent.EXPENSES,
            Intent.DEBT,
            Intent.SAVINGS,
            Intent.SCORE,
            Intent.PROFILE,
        }:
            return False

        normalized = QueryNormalizer.normalize(question).strip()
        explanatory_markers = (
            "por que",
            "explicame",
            "explica",
            "que significa",
            "que quiere decir",
            "como puedo mejorar",
            "como mejoro",
            "que deberia",
            "que puedo hacer",
            "me conviene",
            "conviene",
            "recomendame",
            "recomiendame",
            "que opinas",
            "ayudame a entender",
            "ayudame a mejorar",
            "como reducir",
            "como ordenar",
            "como afecta",
            "como influye",
            "es bueno",
            "es malo",
            "es saludable",
            "es preocupante",
        )
        return any(marker in normalized for marker in explanatory_markers)

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