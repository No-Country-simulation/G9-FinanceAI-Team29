from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

RUTA_USUARIOS = DATA_DIR / "usuarios_features.csv"
RUTA_TRANSACCIONES = DATA_DIR / "transacciones_features.csv"
RUTA_MODELO_PERFIL = MODELS_DIR / "clasificador_perfil_v3.joblib"

modelo_perfil = joblib.load(RUTA_MODELO_PERFIL)

usuarios = pd.read_csv(RUTA_USUARIOS)
transacciones = pd.read_csv(RUTA_TRANSACCIONES)

usuarios["usuario_id"] = usuarios["usuario_id"].astype(str)
transacciones["usuario_id"] = transacciones["usuario_id"].astype(str)

features_perfil = list(modelo_perfil.feature_names_in_)


def generar_recomendaciones(fila_usuario: pd.Series) -> list[str]:
    recomendaciones: list[str] = []

    ratio_gasto = float(fila_usuario["ratio_gasto_ingreso_calculado"])
    ratio_deuda = float(fila_usuario["ratio_deuda_ingreso_calculado"])
    ratio_ahorro = float(fila_usuario["ratio_ahorro_ingreso_calculado"])
    recurrentes = int(fila_usuario["cantidad_recurrentes"])

    if ratio_gasto >= 0.80:
        recomendaciones.append(
            "Reducir los gastos mensuales y priorizar las categorías esenciales."
        )
    elif ratio_gasto >= 0.60:
        recomendaciones.append(
            "Revisar las categorías de mayor consumo para liberar capacidad de ahorro."
        )
    else:
        recomendaciones.append(
            "Mantener el nivel de gasto actual y revisar el presupuesto periódicamente."
        )

    if ratio_deuda >= 0.35:
        recomendaciones.append(
            "Priorizar la reducción de deuda antes de asumir nuevos compromisos financieros."
        )
    elif ratio_deuda >= 0.20:
        recomendaciones.append(
            "Evitar incrementar la deuda y planificar pagos anticipados cuando sea posible."
        )
    else:
        recomendaciones.append(
            "El nivel de endeudamiento se encuentra controlado."
        )

    if ratio_ahorro < 0.10:
        recomendaciones.append(
            "Definir un objetivo inicial de ahorro de al menos el 10% del ingreso mensual."
        )
    elif ratio_ahorro < 0.20:
        recomendaciones.append(
            "Incrementar gradualmente el porcentaje destinado al ahorro."
        )
    else:
        recomendaciones.append(
            "Mantener el hábito de ahorro y considerar un fondo de emergencia."
        )

    if recurrentes >= 15:
        recomendaciones.append(
            "Auditar suscripciones y débitos automáticos para eliminar cargos innecesarios."
        )

    return recomendaciones


def calcular_score_financiero(fila_usuario: pd.Series) -> int:
    score = 100

    ratio_gasto = float(fila_usuario["ratio_gasto_ingreso_calculado"])
    ratio_deuda = float(fila_usuario["ratio_deuda_ingreso_calculado"])
    ratio_ahorro = float(fila_usuario["ratio_ahorro_ingreso_calculado"])
    recurrentes = int(fila_usuario["cantidad_recurrentes"])

    if ratio_gasto > 0.90:
        score -= 30
    elif ratio_gasto > 0.70:
        score -= 20
    elif ratio_gasto > 0.50:
        score -= 10

    if ratio_deuda > 0.45:
        score -= 30
    elif ratio_deuda > 0.30:
        score -= 20
    elif ratio_deuda > 0.15:
        score -= 10

    if ratio_ahorro < 0:
        score -= 30
    elif ratio_ahorro < 0.10:
        score -= 20
    elif ratio_ahorro < 0.20:
        score -= 10

    if recurrentes >= 20:
        score -= 10
    elif recurrentes >= 15:
        score -= 5

    return max(0, min(100, score))


def ajustar_score_por_perfil(
    score_base: int,
    perfil_financiero: str,
) -> int:
    rangos = {
        "Saludable": (75, 100),
        "En observación": (45, 74),
        "En riesgo": (0, 44),
    }

    minimo, maximo = rangos.get(
        perfil_financiero,
        (0, 100),
    )

    return max(
        minimo,
        min(score_base, maximo),
    )


def obtener_estado_score(score: int) -> dict:
    if score >= 85:
        return {
            "estado": "Excelente",
            "color": "green",
        }

    if score >= 75:
        return {
            "estado": "Bueno",
            "color": "green",
        }

    if score >= 60:
        return {
            "estado": "En observación",
            "color": "yellow",
        }

    if score >= 40:
        return {
            "estado": "Riesgo alto",
            "color": "orange",
        }

    return {
        "estado": "Crítico",
        "color": "red",
    }


def determinar_nivel_riesgo(score: int) -> str:
    if score >= 80:
        return "Bajo"
    if score >= 60:
        return "Moderado"
    if score >= 40:
        return "Alto"
    return "Crítico"


def generar_explicacion(
    fila_usuario: pd.Series,
    categorias_principales: list[dict],
) -> str:
    gasto = round(
        float(fila_usuario["ratio_gasto_ingreso_calculado"]) * 100,
        1,
    )
    deuda = round(
        float(fila_usuario["ratio_deuda_ingreso_calculado"]) * 100,
        1,
    )
    ahorro = round(
        float(fila_usuario["ratio_ahorro_ingreso_calculado"]) * 100,
        1,
    )

    if categorias_principales:
        nombres = [item["categoria"] for item in categorias_principales[:2]]
        categorias_texto = " y ".join(nombres)
    else:
        categorias_texto = "sin categorías predominantes"

    return (
        f"Los gastos mensuales representan aproximadamente el {gasto}% de los ingresos. "
        f"El nivel de endeudamiento equivale al {deuda}% y la capacidad de ahorro "
        f"estimada es del {ahorro}%. Las principales categorías de consumo son "
        f"{categorias_texto}."
    )


def generar_fortalezas(fila_usuario: pd.Series) -> list[str]:
    fortalezas: list[str] = []

    ratio_gasto = float(fila_usuario["ratio_gasto_ingreso_calculado"])
    ratio_deuda = float(fila_usuario["ratio_deuda_ingreso_calculado"])
    ratio_ahorro = float(fila_usuario["ratio_ahorro_ingreso_calculado"])

    if ratio_gasto <= 0.60:
        fortalezas.append("El nivel de gasto se mantiene controlado.")
    if ratio_deuda <= 0.20:
        fortalezas.append(
            "El endeudamiento se encuentra dentro de un rango saludable."
        )
    if ratio_ahorro >= 0.20:
        fortalezas.append("La capacidad de ahorro mensual es sólida.")
    if not fortalezas:
        fortalezas.append(
            "Existe información suficiente para definir un plan de mejora."
        )

    return fortalezas


def generar_oportunidades(fila_usuario: pd.Series) -> list[str]:
    oportunidades: list[str] = []

    ratio_gasto = float(fila_usuario["ratio_gasto_ingreso_calculado"])
    ratio_deuda = float(fila_usuario["ratio_deuda_ingreso_calculado"])
    ratio_ahorro = float(fila_usuario["ratio_ahorro_ingreso_calculado"])
    recurrentes = int(fila_usuario["cantidad_recurrentes"])

    if ratio_gasto > 0.70:
        oportunidades.append(
            "Reducir el porcentaje de ingresos destinado a gastos."
        )
    if ratio_deuda > 0.30:
        oportunidades.append("Priorizar la reducción progresiva de deuda.")
    if ratio_ahorro < 0.10:
        oportunidades.append("Construir un hábito de ahorro mensual.")
    if recurrentes >= 15:
        oportunidades.append("Revisar suscripciones y pagos recurrentes.")
    if not oportunidades:
        oportunidades.append(
            "Mantener los hábitos actuales y revisar el presupuesto periódicamente."
        )

    return oportunidades


def construir_categorias_principales(
    transacciones_usuario: pd.DataFrame,
) -> list[dict]:
    categorias = (
        transacciones_usuario.groupby("categoria")["monto"]
        .sum()
        .sort_values(ascending=False)
        .head(3)
    )

    total_gastado = float(transacciones_usuario["monto"].sum())
    resultado: list[dict] = []

    for categoria, monto in categorias.items():
        porcentaje = (
            float(monto) / total_gastado * 100
            if total_gastado > 0
            else 0
        )
        resultado.append(
            {
                "categoria": str(categoria),
                "monto": round(float(monto), 2),
                "porcentaje": round(porcentaje, 2),
            }
        )

    return resultado


def construir_respuesta_analisis(
    usuario_id: str,
    perfil_predicho: str,
    confianza: float,
    fila_metricas: pd.Series,
    categorias_principales: list[dict],
) -> dict:
    score_base = calcular_score_financiero(
        fila_metricas
    )

    score_financiero = ajustar_score_por_perfil(
        score_base=score_base,
        perfil_financiero=str(perfil_predicho),
    )

    estado_score = obtener_estado_score(
        score_financiero
    )

    return {
        "usuario_id": usuario_id,
        "financial_score": score_financiero,
        "score_status": estado_score["estado"],
        "score_color": estado_score["color"],
        "nivel_riesgo": determinar_nivel_riesgo(
            score_financiero
        ),
        "perfil_financiero": str(perfil_predicho),
        "confianza_perfil": round(float(confianza), 4),
        "explicacion": generar_explicacion(
            fila_metricas,
            categorias_principales,
        ),
        "fortalezas": generar_fortalezas(fila_metricas),
        "oportunidades_mejora": generar_oportunidades(fila_metricas),
        "metricas": {
            "ingreso_mensual": round(
                float(fila_metricas["ingreso_mensual"]),
                2,
            ),
            "gasto_mensual_promedio": round(
                float(fila_metricas["gasto_mensual_promedio"]),
                2,
            ),
            "deuda_mensual": round(
                float(fila_metricas["deuda_mensual"]),
                2,
            ),
            "ahorro_mensual_estimado": round(
                float(fila_metricas["ahorro_mensual_estimado"]),
                2,
            ),
            "ratio_gasto_ingreso": round(
                float(fila_metricas["ratio_gasto_ingreso_calculado"]),
                4,
            ),
            "ratio_deuda_ingreso": round(
                float(fila_metricas["ratio_deuda_ingreso_calculado"]),
                4,
            ),
            "ratio_ahorro_ingreso": round(
                float(fila_metricas["ratio_ahorro_ingreso_calculado"]),
                4,
            ),
        },
        "categorias_principales": categorias_principales,
        "recomendaciones": generar_recomendaciones(fila_metricas),
        "modelo_version": "3.2.0",
    }


def analizar_usuario(usuario_id: str) -> dict:
    coincidencias = usuarios[usuarios["usuario_id"] == usuario_id]

    if coincidencias.empty:
        raise ValueError(f"No existe el usuario {usuario_id}.")

    fila = coincidencias.iloc[0]
    entrada_perfil = fila[features_perfil].to_frame().T

    perfil_predicho = modelo_perfil.predict(entrada_perfil)[0]
    probabilidades = modelo_perfil.predict_proba(entrada_perfil)[0]

    clases = list(modelo_perfil.classes_)
    confianza = float(probabilidades[clases.index(perfil_predicho)])

    transacciones_usuario = transacciones[
        transacciones["usuario_id"] == usuario_id
    ]

    categorias_principales = construir_categorias_principales(
        transacciones_usuario
    )

    return construir_respuesta_analisis(
        usuario_id=usuario_id,
        perfil_predicho=str(perfil_predicho),
        confianza=confianza,
        fila_metricas=fila,
        categorias_principales=categorias_principales,
    )


def analizar_datos_usuario(datos: dict) -> dict:
    transacciones_entrada = pd.DataFrame(datos["transacciones"])

    if transacciones_entrada.empty:
        raise ValueError("El usuario no posee transacciones.")

    if "categoria" not in transacciones_entrada.columns:
        raise ValueError(
            "Las transacciones deben incluir la categoría."
        )

    transacciones_entrada["monto"] = pd.to_numeric(
        transacciones_entrada["monto"],
        errors="coerce",
    )

    if transacciones_entrada["monto"].isna().any():
        raise ValueError(
            "Existen montos inválidos en las transacciones."
        )

    gasto_total = float(transacciones_entrada["monto"].sum())
    gasto_promedio = float(transacciones_entrada["monto"].mean())
    gasto_mediano = float(transacciones_entrada["monto"].median())
    gasto_maximo = float(transacciones_entrada["monto"].max())
    desviacion_gastos = float(transacciones_entrada["monto"].std())

    if pd.isna(desviacion_gastos):
        desviacion_gastos = 0.0

    cantidad_recurrentes = int(
        transacciones_entrada["recurrente"]
        .astype(str)
        .str.lower()
        .isin(["sí", "si", "true"])
        .sum()
    )

    cantidad_gastos_grandes = int(
        (
            transacciones_entrada["monto"]
            > gasto_mediano * 2
        ).sum()
    )

    categorias_distintas = int(
        transacciones_entrada["categoria"].nunique()
    )

    ingreso = float(datos["ingreso_mensual"])
    deuda = float(datos["deuda_mensual"])
    gasto_mensual = float(datos["gasto_mensual_promedio"])
    ahorro = float(datos["ahorro_mensual_estimado"])

    if ingreso <= 0:
        raise ValueError(
            "El ingreso mensual debe ser mayor que cero."
        )

    ratio_deuda = deuda / ingreso
    ratio_gasto = gasto_mensual / ingreso
    ratio_ahorro = ahorro / ingreso

    entrada_perfil = pd.DataFrame(
        [
            {
                "ingreso_mensual": ingreso,
                "deuda_mensual": deuda,
                "nivel_endeudamiento": float(
                    datos["nivel_endeudamiento"]
                ),
                "gasto_mensual_promedio": gasto_mensual,
                "ahorro_mensual_estimado": ahorro,
                "porcentaje_gastos_ingreso": float(
                    datos["porcentaje_gastos_ingreso"]
                ),
                "cantidad_transacciones": len(transacciones_entrada),
                "gasto_total": gasto_total,
                "gasto_promedio_transaccion": gasto_promedio,
                "gasto_mediano": gasto_mediano,
                "gasto_maximo": gasto_maximo,
                "desviacion_gastos": desviacion_gastos,
                "cantidad_recurrentes": cantidad_recurrentes,
                "cantidad_gastos_grandes": cantidad_gastos_grandes,
                "categorias_distintas": categorias_distintas,
                "ratio_deuda_ingreso_calculado": ratio_deuda,
                "ratio_gasto_ingreso_calculado": ratio_gasto,
                "ratio_ahorro_ingreso_calculado": ratio_ahorro,
                "frecuencia_ahorro": datos["frecuencia_ahorro"],
            }
        ]
    )

    perfil_predicho = modelo_perfil.predict(entrada_perfil)[0]
    probabilidades = modelo_perfil.predict_proba(entrada_perfil)[0]

    clases = list(modelo_perfil.classes_)
    confianza = float(probabilidades[clases.index(perfil_predicho)])

    categorias_principales = construir_categorias_principales(
        transacciones_entrada
    )

    return construir_respuesta_analisis(
        usuario_id=str(datos["usuario_id"]),
        perfil_predicho=str(perfil_predicho),
        confianza=confianza,
        fila_metricas=entrada_perfil.iloc[0],
        categorias_principales=categorias_principales,
    )