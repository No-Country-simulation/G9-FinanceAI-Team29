from pathlib import Path

import re
import unicodedata
import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = MODELS_DIR / "clasificador_gastos.joblib"
RUTA_MODELO_SUBCATEGORIA = MODELS_DIR / "clasificador_subcategoria.joblib"

modelo_gastos = joblib.load(RUTA_MODELO_GASTOS)
modelo_subcategoria = joblib.load(RUTA_MODELO_SUBCATEGORIA)


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


def normalizar_texto_subcategoria(texto: str) -> str:
    """
    Normalización compatible con el clasificador de subcategorías entrenado
    en el notebook: minúsculas, sin tildes, sin puntuación y espacios compactados.
    """
    texto = str(texto).lower().strip()
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(caracter)
    )
    texto = re.sub(r"[^a-z0-9\s]", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def predecir_subcategoria(
    descripcion: str,
    categoria: str,
) -> dict:
    """
    Segundo nivel jerárquico:
    descripcion + categoria predicha -> subcategoria.
    """
    texto_modelo = (
        normalizar_texto_subcategoria(categoria)
        + " __cat__ "
        + normalizar_texto_subcategoria(descripcion)
    )

    subcategoria = modelo_subcategoria.predict([texto_modelo])[0]

    confianza_subcategoria = None
    if hasattr(modelo_subcategoria, "predict_proba"):
        probabilidades = modelo_subcategoria.predict_proba([texto_modelo])[0]
        clases = list(modelo_subcategoria.classes_)
        indice = clases.index(subcategoria)
        confianza_subcategoria = float(probabilidades[indice])

    return {
        "subcategoria_predicha": str(subcategoria),
        "confianza_subcategoria": (
            round(confianza_subcategoria, 4)
            if confianza_subcategoria is not None
            else None
        ),
    }


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

    resultado_subcategoria = predecir_subcategoria(
        descripcion=descripcion,
        categoria=str(categoria),
    )

    return {
        "categoria_predicha": str(categoria),
        "subcategoria_predicha": resultado_subcategoria["subcategoria_predicha"],
        "confianza_subcategoria": resultado_subcategoria["confianza_subcategoria"],
        "confianza": round(
            confianza,
            4,
        ),
        "advertencias": generar_advertencias(
            descripcion=descripcion,
            monto=monto,
            confianza=confianza,
        ),
        "modelo_version": "10.0.0",
    }