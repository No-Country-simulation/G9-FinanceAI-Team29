from datetime import date

from pydantic import BaseModel, Field


class TransaccionRequest(BaseModel):
    descripcion: str = Field(min_length=1)
    monto: float = Field(ge=0)
    fecha: date
    medio_pago: str
    recurrente: str


class CategoriaResponse(BaseModel):
    categoria_predicha: str
    confianza: float
    advertencias: list[str]
    modelo_version: str