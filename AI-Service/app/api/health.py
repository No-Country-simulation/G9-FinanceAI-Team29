from fastapi import APIRouter

from app.config import settings
from app.schemas.health import ComponentStatus, HealthResponse


router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Comprobar el estado del servicio",
)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        components={
            "machine_learning": ComponentStatus(
                status="pending",
                configured=False,
            ),
            "groq": ComponentStatus(
                status="configured" if settings.groq_api_key else "pending",
                configured=bool(settings.groq_api_key),
            ),
            "gemini_embeddings": ComponentStatus(
                status="configured" if settings.gemini_api_key else "pending",
                configured=bool(settings.gemini_api_key),
            ),
            "faiss": ComponentStatus(
                status="pending",
                configured=False,
            ),
        },
    )