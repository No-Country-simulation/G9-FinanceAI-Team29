from fastapi import APIRouter, HTTPException

from app.profile import (
    analizar_datos_usuario,
    analizar_usuario,
)
from app.schemas.analysis import (
    AnalisisResponse,
    AnalisisUsuarioRequest,
)


router = APIRouter(
    prefix="/analysis",
    tags=["Análisis financiero"],
)


@router.post(
    "",
    response_model=AnalisisResponse,
)
def analysis(
    request: AnalisisUsuarioRequest,
) -> AnalisisResponse:
    try:
        return analizar_datos_usuario(
            request.model_dump()
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.get(
    "/users/{usuario_id}",
    response_model=AnalisisResponse,
)
def analysis_by_user(
    usuario_id: str,
) -> AnalisisResponse:
    try:
        return analizar_usuario(usuario_id)

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error