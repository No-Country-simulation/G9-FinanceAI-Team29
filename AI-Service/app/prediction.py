from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = (
    MODELS_DIR / "clasificador_gastos.joblib"
)

modelo_gastos = joblib.load(
    RUTA_MODELO_GASTOS
)

print("===================================")
print("Ruta del modelo:", RUTA_MODELO_GASTOS)
print("Clases cargadas:")
print(modelo_gastos.classes_)
print("===================================")


def preparar_transaccion(
    descripcion: str,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> pd.DataFrame:

    fecha_convertida = pd.to_datetime(
        fecha,
        errors="raise",
    )

    descripcion_limpia = (
        descripcion
        .lower()
        .strip()
    )

    return pd.DataFrame([
        {
            "descripcion_limpia": descripcion_limpia,
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

    advertencias: list[str] = []

    descripcion_limpia = (
        descripcion
        .lower()
        .strip()
    )

    if (
        "alquiler" in descripcion_limpia
        and monto < 100
    ):
        advertencias.append(
            "Monto inusualmente bajo para un alquiler."
        )

    if monto >= 5000:
        advertencias.append(
            "El monto está fuera del rango habitual. "
            "La categoría fue determinada sin utilizar "
            "el monto de la transacción."
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

    clases = list(
        modelo_gastos.classes_
    )

    indice_categoria = clases.index(
        categoria
    )

    confianza = float(
        probabilidades[indice_categoria]
    )

    advertencias = generar_advertencias(
        descripcion=descripcion,
        monto=monto,
    )

    return {
        "categoria_predicha": str(
            categoria
        ),
        "confianza": round(
            confianza,
            4,
        ),
        "advertencias": advertencias,
        "modelo_version": "8.0.0",
    }