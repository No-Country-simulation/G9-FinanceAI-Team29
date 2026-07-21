from pathlib import Path
import re
import unicodedata

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = (
    MODELS_DIR / "clasificador_gastos.joblib"
)

MODELO_VERSION = "9.0.0"

CATEGORIAS_INGRESO = {
    "Reintegro",
    "Salario",
    "Transferencia recibida",
    "Venta",
}


modelo_gastos = joblib.load(
    RUTA_MODELO_GASTOS
)


print("===================================")
print("Ruta del modelo:", RUTA_MODELO_GASTOS)
print("Versión del modelo:", MODELO_VERSION)
print("Clases cargadas:")
print(modelo_gastos.classes_)
print("===================================")


def normalizar_texto(
    texto: str,
) -> str:
    if pd.isna(texto):
        return ""

    texto = str(texto).strip().lower()

    texto = unicodedata.normalize(
        "NFKD",
        texto,
    )

    texto = "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(
            caracter
        )
    )

    texto = re.sub(
        r"[^a-z0-9\s]",
        " ",
        texto,
    )

    texto = re.sub(
        r"\s+",
        " ",
        texto,
    )

    return texto.strip()


def preparar_transaccion(
    descripcion: str,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> pd.DataFrame:
    if (
        not descripcion
        or not descripcion.strip()
    ):
        raise ValueError(
            "La descripción no puede estar vacía."
        )

    # Validamos que la fecha tenga formato correcto,
    # aunque el modelo no la utilice para clasificar.
    pd.to_datetime(
        fecha,
        errors="raise",
    )

    descripcion_limpia = normalizar_texto(
        descripcion
    )

    print("Descripción original:", descripcion)
    print(
        "Descripción limpia:",
        descripcion_limpia,
    )
    print("Medio de pago:", medio_pago)
    print("Recurrente:", recurrente)

    return pd.DataFrame([
        {
            "descripcion_limpia":
                descripcion_limpia,
        }
    ])


def generar_advertencias(
    descripcion: str,
    monto: float,
) -> list[str]:
    advertencias: list[str] = []

    descripcion_limpia = normalizar_texto(
        descripcion
    )

    if (
        "alquiler" in descripcion_limpia
        and monto < 100
    ):
        advertencias.append(
            "Monto inusualmente bajo "
            "para un alquiler."
        )

    if monto >= 5000:
        advertencias.append(
            "El monto está fuera del rango "
            "habitual. La categoría fue "
            "determinada sin utilizar el monto "
            "de la transacción."
        )

    return advertencias


def predecir_categoria(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> dict:
    if monto <= 0:
        raise ValueError(
            "El monto debe ser mayor que cero."
        )

    entrada = preparar_transaccion(
        descripcion=descripcion,
        fecha=fecha,
        medio_pago=medio_pago,
        recurrente=recurrente,
    )

    categoria = str(
        modelo_gastos.predict(
            entrada
        )[0]
    )

    probabilidades = (
        modelo_gastos.predict_proba(
            entrada
        )[0]
    )

    clases = list(
        modelo_gastos.classes_
    )

    indice_categoria = clases.index(
        categoria
    )

    confianza = float(
        probabilidades[indice_categoria]
    )

    tipo_transaccion = (
        "INGRESO"
        if categoria in CATEGORIAS_INGRESO
        else "GASTO"
    )

    advertencias = generar_advertencias(
        descripcion=descripcion,
        monto=monto,
    )

    return {
        "tipo_transaccion":
            tipo_transaccion,
        "categoria_predicha":
            categoria,
        "confianza":
            round(confianza, 4),
        "advertencias":
            advertencias,
        "modelo_version":
            MODELO_VERSION,
    }