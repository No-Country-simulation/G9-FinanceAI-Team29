from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


GoalCategory = Literal[
    "COMPRA",
    "DEUDA",
    "AHORRO",
    "EMERGENCIA",
    "VIAJE",
    "OTRO",
]

GoalStatus = Literal[
    "ACTIVA",
    "COMPLETADA",
    "CANCELADA",
]


class GoalCreate(BaseModel):
    usuario_id: str = Field(
        min_length=1,
        description="ID del usuario propietario de la meta.",
    )
    nombre: str = Field(
        min_length=1,
        max_length=100,
    )
    descripcion: str | None = Field(
        default=None,
        max_length=255,
    )
    categoria: GoalCategory = "OTRO"
    monto_objetivo: float = Field(
        gt=0,
    )
    fecha_objetivo: date | None = None


class GoalUpdate(BaseModel):
    nombre: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    descripcion: str | None = Field(
        default=None,
        max_length=255,
    )
    categoria: GoalCategory | None = None
    monto_objetivo: float | None = Field(
        default=None,
        gt=0,
    )
    fecha_objetivo: date | None = None


class GoalAmountRequest(BaseModel):
    monto: float = Field(
        gt=0,
    )


class GoalResponse(BaseModel):
    id: str
    usuario_id: str
    nombre: str
    descripcion: str | None
    categoria: GoalCategory
    monto_objetivo: float
    monto_reservado: float
    monto_restante: float
    progreso: float
    fecha_objetivo: date | None
    reserva_mensual_sugerida: float | None = None
    estado: GoalStatus
    fecha_creacion: datetime
    fecha_actualizacion: datetime


class GoalSummaryResponse(BaseModel):
    usuario_id: str
    saldo_total: float
    total_reservado: float
    saldo_disponible: float
    metas_activas: int
    metas_completadas: int
    porcentaje_reservado: float