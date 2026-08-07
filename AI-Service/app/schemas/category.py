from datetime import date

from pydantic import BaseModel, Field


class TransaccionRequest(BaseModel):
    descripcion: str = Field(
        ...,
        min_length=1,
        examples=["Pago de alquiler"],
    )

    monto: float = Field(
        ...,
        gt=0,
        examples=[850],
    )

    fecha: date = Field(
        ...,
        examples=["2026-07-21"],
    )

    medio_pago: str = Field(
        ...,
        examples=["Transferencia bancaria"],
    )

    recurrente: str = Field(
        ...,
        examples=["Sí"],
    )


class CategoriaResponse(BaseModel):
    tipo_transaccion: str = Field(
        ...,
        examples=["GASTO"],
    )

    categoria_predicha: str = Field(
        ...,
        examples=["Vivienda"],
    )

    subcategoria_predicha: str | None = Field(
        default=None,
        examples=["Alquiler"],
        description=(
            "Subcategoría detectada para la transacción."
        ),
    )

    confianza: float = Field(
        ...,
        ge=0,
        le=1,
        examples=[0.99],
    )

    metodo_clasificacion: str | None = Field(
        default=None,
        examples=["regla_exacta"],
        description=(
            "Método utilizado para clasificar: "
            "regla_exacta, fuzzy o ml."
        ),
    )

    advertencias: list[str] = Field(
        default_factory=list,
        examples=[[]],
    )

    modelo_version: str = Field(
        ...,
        examples=["8.1.0"],
    )