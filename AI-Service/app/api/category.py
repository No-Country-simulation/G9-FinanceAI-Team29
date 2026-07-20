from fastapi import APIRouter

from app.prediction import predecir_categoria
from app.schemas.category import (
    CategoriaResponse,
    TransaccionRequest,
)


router = APIRouter(
    prefix="/predict",
    tags=["Predicción de categorías"],
)


@router.post(
    "/category",
    response_model=CategoriaResponse,
)
def predict_category(
    request: TransaccionRequest,
) -> CategoriaResponse:
    return predecir_categoria(
        descripcion=request.descripcion,
        monto=request.monto,
        fecha=str(request.fecha),
        medio_pago=request.medio_pago,
        recurrente=request.recurrente,
    )