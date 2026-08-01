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
    profile_model = settings.models_dir / "clasificador_perfil.joblib"
    category_model = settings.models_dir / "clasificador_gastos.joblib"
    ml_configured = profile_model.exists() and category_model.exists()

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        components={
            "machine_learning": ComponentStatus(
                status="configured" if ml_configured else "pending",
                configured=ml_configured,
            ),
            "groq": ComponentStatus(
                status="configured" if settings.groq_api_key else "pending",
                configured=bool(settings.groq_api_key),
            ),
            "gemini": ComponentStatus(
                status="configured" if settings.gemini_api_key else "pending",
                configured=bool(settings.gemini_api_key),
            ),
        },
    )
