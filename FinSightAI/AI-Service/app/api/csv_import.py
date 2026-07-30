from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.csv_import import CSVProcessResponse
from app.services.csv_processor import CSVValidationError, process_user_csv


router = APIRouter(
    prefix="/csv",
    tags=["Importación CSV"],
)


@router.post(
    "/procesar",
    response_model=CSVProcessResponse,
    summary="Valida y transforma un CSV de movimientos",
)
async def process_csv(
    usuario_id: str = Form(...),
    archivo: UploadFile = File(...),
) -> CSVProcessResponse:
    filename = (archivo.filename or "").lower()
    if filename and not filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail={
                "valido": False,
                "errores": ["El archivo debe tener extensión .csv."],
            },
        )

    try:
        result = process_user_csv(
            content=await archivo.read(),
            usuario_id=usuario_id,
        )
    except CSVValidationError as error:
        raise HTTPException(
            status_code=422,
            detail={
                "valido": False,
                "errores": error.errors,
            },
        ) from error

    return CSVProcessResponse(
        usuario=result.usuario,
        transacciones=result.transacciones,
        resumen=result.resumen,
    )
