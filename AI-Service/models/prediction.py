from pathlib import Path

import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = MODELS_DIR / "clasificador_gastos.joblib"

modelo_gastos = joblib.load(RUTA_MODELO_GASTOS)


# Traduce marcas comerciales y nombres habituales a descripciones genéricas
# conocidas por el modelo entrenado.
ALIASES_DESCRIPCIONES = {
    # Streaming y entretenimiento digital
    "netflix": "streaming",
    "spotify": "servicio de musica",
    "disney+": "streaming",
    "disney plus": "streaming",
    "youtube premium": "streaming",
    "hbo max": "streaming",
    "prime video": "streaming",

    # Transporte
    "uber": "viaje por aplicacion",
    "cabify": "viaje por aplicacion",
    "didi": "viaje por aplicacion",

    # Compras por internet
    "mercado libre": "compra por internet",
    "amazon": "compra por internet",
    "temu": "compra por internet",
    "shein": "compra por internet",

    # Videojuegos
    "steam": "videojuego",
    "epic games": "videojuego",
    "playstation": "videojuego",
    "xbox": "videojuego",
    "nintendo": "videojuego",

    # Comida rápida
    "mcdonald": "comida rapida",
    "burger king": "comida rapida",
    "kfc": "comida rapida",

    # Delivery
    "pedidosya": "pedido de comida",
    "rappi": "pedido de comida",
}


def normalizar_descripcion(descripcion: str) -> str:
    texto = descripcion.lower().strip()

    for alias, descripcion_generica in ALIASES_DESCRIPCIONES.items():
        if alias in texto:
            return descripcion_generica

    return texto


def preparar_transaccion(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> pd.DataFrame:

    fecha_convertida = pd.to_datetime(fecha)

    descripcion_limpia = normalizar_descripcion(descripcion)

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
    confianza: float | None = None,
) -> list[str]:

    advertencias = []

    descripcion_normalizada = normalizar_descripcion(descripcion)

    if (
        "alquiler" in descripcion_normalizada
        and monto < 100
    ):
        advertencias.append(
            "Monto inusualmente bajo para un alquiler."
        )

    if monto >= 5000:
        advertencias.append(
            "Monto muy elevado. La confianza del modelo puede disminuir para valores extremos."
        )

    if confianza is not None and confianza < 0.40:
        advertencias.append(
            "La categoría fue estimada con baja confianza. Revisa la categoría antes de guardar."
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
            descripcion=descripcion,
            monto=monto,
            confianza=confianza,
        ),
        "modelo_version": "7.1.0",
    }