"""Helpers compartidos para las llamadas del AI-Service al backend Spring."""

from app.config import settings


def service_headers() -> dict[str, str]:
    """
    Header X-Service-Token para autenticarse ante el backend (auth service-to-service).
    Si no hay token configurado, devuelve vacío (útil en dev con el backend permisivo).
    """
    if settings.service_token:
        return {"X-Service-Token": settings.service_token}
    return {}
