import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.agent.service import FinSightAgentService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/agent",
    tags=["Agent"],
)


class ChatRequest(BaseModel):
    usuario_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=1000)

    @field_validator("usuario_id", "question")
    @classmethod
    def strip_values(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El campo no puede estar vacío.")
        return stripped


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
        )
        return ChatResponse(
            answer=response.content,
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
