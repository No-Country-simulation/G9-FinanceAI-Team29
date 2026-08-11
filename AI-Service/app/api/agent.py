import json
import logging
import re
import unicodedata
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.intent import Intent
from app.services.agent.rules_engine import FinancialRulesEngine
from app.services.agent.service import FinSightAgentService
from app.services.backend_financial_data import (
    BackendDataError,
    build_live_analysis,
    fetch_user_transactions,
)
from app.services.llm.prompt_builder import PromptBuilder


logger = logging.getLogger(__name__)


_FIRST_MESSAGE_INTRO = (
    "👋 Hola, soy **Finsi**, el asistente de FinSightAI. "
    "Puedo ayudarte a entender tus finanzas y a resolver dudas sobre la aplicación."
)


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.lower())
    without_accents = "".join(
        character for character in normalized if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", " ", without_accents).strip()


def _is_simple_greeting(question: str) -> bool:
    normalized = _normalize_text(question)
    return normalized in {
        "hola",
        "buenas",
        "buen dia",
        "buen dia finsi",
        "buenas tardes",
        "buenas noches",
        "hey",
        "hi",
        "hello",
    }


def _first_message_answer(question: str, answer: str) -> str:
    """Presenta a Finsi una sola vez y conserva la respuesta concreta."""
    if _is_simple_greeting(question):
        return f"{_FIRST_MESSAGE_INTRO}\n\n¿En qué puedo ayudarte hoy?"

    cleaned_answer = answer.strip()
    if not cleaned_answer:
        return _FIRST_MESSAGE_INTRO

    return f"{_FIRST_MESSAGE_INTRO}\n\n{cleaned_answer}"


router = APIRouter(
    prefix="/agent",
    tags=["Agent"],
)


class ChatRequest(BaseModel):
    usuario_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=1000)
    previous_answer: str | None = Field(default=None, max_length=6000)
    time_zone: str | None = Field(default=None, max_length=100)
    assistant_mode: str | None = Field(default=None, max_length=50)

    @field_validator("usuario_id", "question")
    @classmethod
    def strip_values(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo no puede estar vacío.")
        return stripped

    @field_validator("previous_answer", "time_zone", "assistant_mode")
    @classmethod
    def strip_previous_answer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ChatResponse(BaseModel):
    answer: str
    provider: str


agent = FinSightAgentService()


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        response = await agent.chat(
            usuario_id=request.usuario_id,
            question=request.question,
            previous_answer=request.previous_answer,
            time_zone=request.time_zone,
            assistant_mode=request.assistant_mode,
        )
        answer = response.content
        if request.previous_answer is None:
            answer = _first_message_answer(request.question, answer)

        return ChatResponse(
            answer=answer,
            provider=response.provider,
        )

    except ValueError as error:
        message = str(error)
        status_code = 404 if "No existe el usuario" in message else 400
        raise HTTPException(
            status_code=status_code,
            detail=message,
        ) from error

    except Exception as error:
        logger.exception("Error al procesar la consulta del agente")
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible procesar la consulta en este momento. "
                "Inténtalo nuevamente más tarde."
            ),
        ) from error


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _stream_plain_answer(request: "ChatRequest") -> AsyncIterator[str]:
    """Camino de respaldo: sin pasos narrados, un único evento final."""
    try:
        response = await agent.chat(
            usuario_id=request.usuario_id,
            question=request.question,
            previous_answer=request.previous_answer,
            time_zone=request.time_zone,
            assistant_mode=request.assistant_mode,
        )
    except ValueError as error:
        # Propaga el mensaje (p.ej. "no posee transacciones") tal cual lo hace
        # /agent/chat, ya que el frontend detecta el flujo "sin datos" por texto.
        yield _sse({"status": "error", "message": str(error)})
        return
    except Exception:
        logger.exception("Error al procesar la consulta del agente (stream)")
        yield _sse(
            {
                "status": "error",
                "message": "No fue posible procesar la consulta en este momento.",
            }
        )
        return

    answer = response.content
    if request.previous_answer is None:
        answer = _first_message_answer(request.question, answer)
    yield _sse({"status": "done", "answer": answer, "provider": response.provider})


async def _stream_summary_answer(request: "ChatRequest") -> AsyncIterator[str]:
    """Ejemplo de flujo narrado (estilo "Finsi está haciendo X") para el
    caso de "dame mi resumen financiero" cuando hay transacciones cargadas."""
    yield _sse(
        {"status": "step", "message": "Finsi está revisando tus datos financieros..."}
    )
    try:
        transactions = await run_in_threadpool(fetch_user_transactions, request.usuario_id)
    except (BackendDataError, ValueError):
        transactions = []

    if not transactions:
        async for event in _stream_plain_answer(request):
            yield event
        return

    yield _sse(
        {"status": "step", "message": "Finsi está analizando tus ingresos y gastos..."}
    )
    try:
        analysis = await run_in_threadpool(
            build_live_analysis, request.usuario_id, transactions
        )
    except Exception:
        async for event in _stream_plain_answer(request):
            yield event
        return

    yield _sse({"status": "step", "message": "Finsi está redactando tu resumen..."})
    try:
        rules = FinancialRulesEngine.evaluate(analysis)
        context = FinancialContextBuilder.build(
            intent=Intent.SUMMARY, analysis=analysis, rules=rules
        )
        messages = PromptBuilder.build(
            original_question=request.question,
            processed_question=request.question,
            corrections=(),
            context=context,
            intent=Intent.SUMMARY.value,
        )
        llm_response = await agent.llm.generate(messages=messages)
    except Exception:
        logger.exception("Error al generar el resumen financiero narrado")
        yield _sse(
            {
                "status": "error",
                "message": "No fue posible generar tu resumen en este momento.",
            }
        )
        return

    answer = llm_response.content
    if request.previous_answer is None:
        answer = _first_message_answer(request.question, answer)
    yield _sse({"status": "done", "answer": answer, "provider": llm_response.provider})


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Variante con streaming de estado (SSE) para el ejemplo de "resumen
    financiero". Para el resto de las preguntas cae al flujo normal, con un
    único evento final, para no duplicar toda la lógica de `chat()`."""
    intent_result = agent.intent_detector.detect_result(request.question)
    if intent_result.intent == Intent.SUMMARY:
        generator = _stream_summary_answer(request)
    else:
        generator = _stream_plain_answer(request)

    return StreamingResponse(generator, media_type="text/event-stream")
