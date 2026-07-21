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
        examples=[25000],
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

    confianza: float = Field(
        ...,
        ge=0,
        le=1,
        examples=[0.9915],
    )

    advertencias: list[str] = Field(
        default_factory=list,
        examples=[[]],
    )

    modelo_version: str = Field(
        ...,
        examples=["9.0.0"],
    )