from datetime import date

from pydantic import BaseModel, Field


class TransaccionInput(BaseModel):
    fecha: date
    descripcion: str = Field(min_length=1)
    monto: float = Field(ge=0)
    categoria: str | None = None
    medio_pago: str
    recurrente: str


class AnalisisUsuarioRequest(BaseModel):
    usuario_id: str
    ingreso_mensual: float = Field(gt=0)
    deuda_mensual: float = Field(ge=0)
    gasto_mensual_promedio: float = Field(ge=0)
    ahorro_mensual_estimado: float
    nivel_endeudamiento: float
    porcentaje_gastos_ingreso: float
    frecuencia_ahorro: str
    transacciones: list[TransaccionInput]