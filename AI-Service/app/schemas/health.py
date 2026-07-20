from pydantic import BaseModel


class ComponentStatus(BaseModel):
    status: str
    configured: bool


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    components: dict[str, ComponentStatus]