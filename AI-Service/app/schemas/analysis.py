from typing import Literal

from pydantic import BaseModel, Field, model_validator


FrecuenciaAhorro = Literal[
    "Alta",
    "Media",
    "Baja",
    "Nunca",
]


class TransaccionAnalisis(BaseModel):
    monto: float = Field(gt=0)
    categoria: str = Field(min_length=1)
    recurrente: bool = False

    @model_validator(mode="after")
    def validar_categoria(self):
        categoria_normalizada = self.categoria.strip().lower()

        if categoria_normalizada == "ahorro":
            raise ValueError(
                "'Ahorro' no es una categoría de gasto."
            )

        return self


class AnalisisUsuarioRequest(BaseModel):
    usuario_id: str = Field(min_length=1)

    ingreso_mensual: float = Field(gt=0)
    deuda_mensual: float = Field(ge=0)

    nivel_endeudamiento: float = Field(
        ge=0,
        le=100,
        description=(
            "Porcentaje de deuda respecto del ingreso. "
            "Ejemplo: 6.25 representa 6.25%."
        ),
    )

    gasto_mensual_promedio: float = Field(ge=0)
    ahorro_mensual_estimado: float

    porcentaje_gastos_ingreso: float = Field(
        ge=0,
        le=150,
        description=(
            "Porcentaje de gastos respecto del ingreso. "
            "Ejemplo: 52.5 representa 52.5%."
        ),
    )

    frecuencia_ahorro: FrecuenciaAhorro

    transacciones: list[TransaccionAnalisis] = Field(
        default_factory=list
    )

    @model_validator(mode="after")
    def validar_coherencia_financiera(self):
        nivel_endeudamiento_calculado = (
            self.deuda_mensual
            / self.ingreso_mensual
            * 100
        )

        porcentaje_gastos_calculado = (
            self.gasto_mensual_promedio
            / self.ingreso_mensual
            * 100
        )

        ahorro_calculado = (
            self.ingreso_mensual
            - self.gasto_mensual_promedio
            - self.deuda_mensual
        )

        tolerancia_porcentaje = 0.15
        tolerancia_monetaria = max(
            1.0,
            self.ingreso_mensual * 0.01,
        )

        if abs(
            self.nivel_endeudamiento
            - nivel_endeudamiento_calculado
        ) > tolerancia_porcentaje:
            raise ValueError(
                "nivel_endeudamiento no coincide con "
                "deuda_mensual / ingreso_mensual × 100."
            )

        if abs(
            self.porcentaje_gastos_ingreso
            - porcentaje_gastos_calculado
        ) > tolerancia_porcentaje:
            raise ValueError(
                "porcentaje_gastos_ingreso no coincide con "
                "gasto_mensual_promedio / ingreso_mensual × 100."
            )

        if abs(
            self.ahorro_mensual_estimado
            - ahorro_calculado
        ) > tolerancia_monetaria:
            raise ValueError(
                "ahorro_mensual_estimado no coincide con "
                "ingreso - gasto - deuda."
            )

        return self


class CategoriaPrincipal(BaseModel):
    categoria: str
    monto: float
    porcentaje: float


class Metricas(BaseModel):
    ingreso_mensual: float
    gasto_mensual_promedio: float
    deuda_mensual: float
    ahorro_mensual_estimado: float
    ratio_gasto_ingreso: float
    ratio_deuda_ingreso: float
    ratio_ahorro_ingreso: float


class Wallet(BaseModel):
    saldo_total: float
    saldo_reservado: float
    saldo_disponible: float


class AnalisisResponse(BaseModel):
    usuario_id: str
    financial_score: int
    score_status: str
    score_color: str
    nivel_riesgo: str
    perfil_financiero: str
    confianza_perfil: float
    probabilidades_perfil: dict[str, float]
    explicacion: str
    fortalezas: list[str]
    oportunidades_mejora: list[str]
    metricas: Metricas
    wallet: Wallet
    categorias_principales: list[CategoriaPrincipal]
    recomendaciones: list[str]
    modelo_version: str