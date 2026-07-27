from pydantic import BaseModel, Field


class TransaccionAnalisis(BaseModel):
    monto: float
    categoria: str
    recurrente: bool = False


class AnalisisUsuarioRequest(BaseModel):
    usuario_id: int

    ingreso_mensual: float = Field(gt=0)
    deuda_mensual: float = Field(ge=0)
    nivel_endeudamiento: float = Field(ge=0)

    gasto_mensual_promedio: float = Field(ge=0)
    ahorro_mensual_estimado: float

    porcentaje_gastos_ingreso: float = Field(ge=0)

    frecuencia_ahorro: str

    transacciones: list[TransaccionAnalisis]