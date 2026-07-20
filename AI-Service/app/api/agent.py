from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.agent.service import FinSightAgentService


router = APIRouter(
    prefix="/agent",
    tags=["Agent"],
)


class ChatRequest(BaseModel):
    usuario_id: str
    question: str


class ChatResponse(BaseModel):
    answer: str
    provider: str


agent = FinSightAgentService()


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(request: ChatRequest):
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
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error