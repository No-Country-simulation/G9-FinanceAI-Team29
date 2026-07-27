from pathlib import Path

import joblib
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = (
    MODELS_DIR / "clasificador_gastos.joblib"
)

modelo_gastos = joblib.load(
    RUTA_MODELO_GASTOS
)


def preparar_transaccion(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> pd.DataFrame:

    fecha_convertida = pd.to_datetime(fecha)

    descripcion_limpia = (
        descripcion.lower().strip()
    )

    return pd.DataFrame([
        {
            "descripcion_limpia": descripcion_limpia,
            "monto": float(monto),
            "mes": fecha_convertida.month,
            "dia_semana": fecha_convertida.dayofweek,
            "es_fin_de_semana": int(
                fecha_convertida.dayofweek >= 5
            ),
            "longitud_descripcion": len(
                descripcion_limpia
            ),
            "cantidad_palabras": len(
                descripcion_limpia.split()
            ),
            "medio_pago": medio_pago,
            "recurrente": recurrente,
        }
    ])


def generar_advertencias(
    descripcion: str,
    monto: float,
) -> list[str]:

    advertencias = []

    descripcion = descripcion.lower()

    if (
        "alquiler" in descripcion
        and monto < 100
    ):
        advertencias.append(
            "Monto inusualmente bajo para un alquiler."
        )

    if monto >= 5000:
        advertencias.append(
            "Monto muy elevado. La confianza del modelo puede disminuir para valores extremos."
        )

    return advertencias


def predecir_categoria(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> dict:

    entrada = preparar_transaccion(
        descripcion=descripcion,
        monto=monto,
        fecha=fecha,
        medio_pago=medio_pago,
        recurrente=recurrente,
    )

    categoria = modelo_gastos.predict(
        entrada
    )[0]

    probabilidades = modelo_gastos.predict_proba(
        entrada
    )[0]

    clases = list(modelo_gastos.classes_)
    indice = clases.index(categoria)

    confianza = float(
        probabilidades[indice]
    )

    return {
        "categoria_predicha": str(categoria),
        "confianza": round(
            confianza,
            4,
        ),
        "advertencias": generar_advertencias(
            descripcion,
            monto,
        ),
        "modelo_version": "7.0.0",
    }
