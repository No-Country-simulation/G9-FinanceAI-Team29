from datetime import date

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.prediction import predecir_categoria
from app.profile import (
    analizar_datos_usuario,
    analizar_usuario,
)
from app.schemas import AnalisisUsuarioRequest


app = FastAPI(
    title="FinancialAI ML Service",
    version="1.0.0",
)


class TransaccionRequest(BaseModel):
    descripcion: str = Field(min_length=1)
    monto: float = Field(ge=0)
    fecha: date
    medio_pago: str
    recurrente: str


@app.get("/")
def inicio() -> dict:
    return {
        "mensaje": "FinancialAI ML Service funcionando"
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok"
    }


@app.post("/predict/category")
def predict_category(
    request: TransaccionRequest,
) -> dict:
    return predecir_categoria(
        descripcion=request.descripcion,
        monto=request.monto,
        fecha=str(request.fecha),
        medio_pago=request.medio_pago,
        recurrente=request.recurrente,
    )


@app.get("/analysis/users/{usuario_id}")
def analysis_user(
    usuario_id: str,
) -> dict:
    try:
        return analizar_usuario(usuario_id)

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@app.post("/analysis")
def analysis(
    request: AnalisisUsuarioRequest,
) -> dict:
    try:
        return analizar_datos_usuario(
            request.model_dump()
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )