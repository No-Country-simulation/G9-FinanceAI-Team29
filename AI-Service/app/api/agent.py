import logging
import re
import unicodedata

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.agent.service import FinSightAgentService


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

    @field_validator("usuario_id", "question")
    @classmethod
    def strip_values(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo no puede estar vacío.")
        return stripped

    @field_validator("previous_answer", "time_zone")
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
