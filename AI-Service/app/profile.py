from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR = BASE_DIR / "models"

RUTA_USUARIOS = DATA_DIR / "usuarios_features.csv"
RUTA_TRANSACCIONES = DATA_DIR / "transacciones_features.csv"
RUTA_MODELO_PERFIL = MODELS_DIR / "clasificador_perfil.joblib"

modelo_perfil = None
usuarios = None
transacciones = None
features_perfil: list[str] = []


def _ensure_resources_loaded() -> None:
    global modelo_perfil, usuarios, transacciones, features_perfil

    if modelo_perfil is not None and usuarios is not None and transacciones is not None:
        return

    missing = [
        path for path in (RUTA_MODELO_PERFIL, RUTA_USUARIOS, RUTA_TRANSACCIONES)
        if not path.exists()
    ]
    if missing:
        names = ", ".join(path.name for path in missing)
        raise RuntimeError(f"Recursos de análisis no configurados: {names}.")

    modelo_perfil = joblib.load(RUTA_MODELO_PERFIL)
    usuarios = pd.read_csv(RUTA_USUARIOS)
    transacciones = pd.read_csv(RUTA_TRANSACCIONES)
    usuarios["usuario_id"] = usuarios["usuario_id"].astype(str)
    transacciones["usuario_id"] = transacciones["usuario_id"].astype(str)
    features_perfil = list(modelo_perfil.feature_names_in_)



def generar_recomendaciones(
    fila_usuario: pd.Series,
    categorias_principales: list[dict] | None = None,
    perfil_financiero: str | None = None,
) -> list[dict]:
    """Genera recomendaciones explicables, accionables y priorizadas sin usar LLM."""
    categorias_principales = categorias_principales or []
    perfil = str(perfil_financiero or fila_usuario.get("perfil_financiero", "En observación"))
    ratio_gasto = float(fila_usuario["ratio_gasto_ingreso_calculado"])
    ratio_deuda = float(fila_usuario["ratio_deuda_ingreso_calculado"])
    ratio_ahorro = float(fila_usuario["ratio_ahorro_ingreso_calculado"])
    recurrentes = int(fila_usuario["cantidad_recurrentes"])

    categoria_principal = categorias_principales[0] if categorias_principales else None
    categoria_nombre = str(categoria_principal.get("categoria", "la categoría principal")) if categoria_principal else "la categoría principal"
    categoria_monto = float(categoria_principal.get("monto", 0)) if categoria_principal else 0.0
    categoria_pct = float(categoria_principal.get("porcentaje", 0)) if categoria_principal else 0.0

    recomendaciones: list[dict] = []
    advertencia = (
        "Esta orientación se basa en los datos registrados en FinSightAI. "
        "Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    )

    def agregar(**item):
        item["perfil"] = perfil
        item["advertencia"] = advertencia
        recomendaciones.append(item)

    if ratio_gasto >= 0.80:
        agregar(
            id=f"gastos-altos-{categoria_nombre.lower().replace(' ', '-')}",
            tipo="gastos_altos",
            prioridad="alta",
            titulo="Reducir el peso de los gastos",
            diagnostico=(
                f"Los gastos representan el {ratio_gasto * 100:.1f}% de los ingresos. "
                f"{categoria_nombre} es la categoría de mayor consumo"
                + (f", con ${categoria_monto:,.2f}" if categoria_monto > 0 else "") + "."
            ),
            accion=(
                f"Revisar primero los movimientos de {categoria_nombre} y buscar una reducción gradual "
                "del 5% al 10%, sin afectar necesidades esenciales."
            ),
            objetivo="Llevar gradualmente los gastos totales por debajo del 75% de los ingresos.",
            evidencia={
                "ratio_gasto_ingreso": round(ratio_gasto, 4),
                "categoria_principal": categoria_nombre,
                "monto_categoria_usd": round(categoria_monto, 2),
                "porcentaje_categoria": round(categoria_pct, 2),
            },
            pregunta_finsi=(
                f"Vengo de la recomendación 'Reducir el peso de los gastos'. "
                f"Analiza conmigo los gastos de {categoria_nombre}, explica por qué son prioritarios "
                "y ayúdame a armar un plan concreto para reducirlos."
            ),
        )
    elif ratio_gasto >= 0.60:
        agregar(
            id=f"optimizar-gastos-{categoria_nombre.lower().replace(' ', '-')}",
            tipo="optimizacion_gastos",
            prioridad="media",
            titulo="Optimizar las categorías de mayor consumo",
            diagnostico=(
                f"Los gastos utilizan el {ratio_gasto * 100:.1f}% de los ingresos. "
                f"La mayor concentración está en {categoria_nombre}."
            ),
            accion=f"Comparar los movimientos de {categoria_nombre} e identificar ajustes posibles sin afectar gastos esenciales.",
            objetivo="Liberar al menos un 5% adicional de los ingresos para ahorro o imprevistos.",
            evidencia={"ratio_gasto_ingreso": round(ratio_gasto, 4), "categoria_principal": categoria_nombre},
            pregunta_finsi=f"Ayúdame a revisar la recomendación sobre optimizar mis gastos de {categoria_nombre} y proponme acciones concretas.",
        )

    if ratio_deuda >= 0.35:
        agregar(
            id="reducir-deuda-prioritaria",
            tipo="deuda_alta",
            prioridad="alta",
            titulo="Priorizar la reducción de deuda",
            diagnostico=f"Las obligaciones mensuales representan el {ratio_deuda * 100:.1f}% de los ingresos.",
            accion="Ordenar las deudas por costo financiero, evitar nuevas obligaciones y dirigir el excedente a la deuda más costosa.",
            objetivo="Reducir gradualmente las cuotas mensuales por debajo del 30% de los ingresos.",
            evidencia={"ratio_deuda_ingreso": round(ratio_deuda, 4)},
            pregunta_finsi="Vengo de la recomendación sobre reducir deuda. Ayúdame a priorizar pagos y crear un plan realista con mis datos.",
        )
    elif ratio_deuda >= 0.20:
        agregar(
            id="controlar-endeudamiento",
            tipo="deuda_moderada",
            prioridad="media",
            titulo="Mantener la deuda bajo control",
            diagnostico=f"La deuda mensual equivale al {ratio_deuda * 100:.1f}% de los ingresos.",
            accion="Evitar nuevas cuotas y evaluar pagos anticipados solo si no comprometen el fondo de emergencia.",
            objetivo="Evitar que la deuda supere el 30% de los ingresos.",
            evidencia={"ratio_deuda_ingreso": round(ratio_deuda, 4)},
            pregunta_finsi="Explícame cómo mantener mi deuda bajo control y qué debería revisar primero.",
        )

    if ratio_ahorro < 0.10:
        agregar(
            id="construir-capacidad-ahorro",
            tipo="ahorro_bajo",
            prioridad="alta" if perfil == "En riesgo" else "media",
            titulo="Construir capacidad de ahorro",
            diagnostico=f"La capacidad de ahorro estimada es del {ratio_ahorro * 100:.1f}% de los ingresos.",
            accion="Separar una parte de cada ingreso apenas se recibe y automatizar el ahorro cuando sea posible.",
            objetivo="Alcanzar primero un ahorro mensual equivalente al 10% de los ingresos.",
            evidencia={"ratio_ahorro_ingreso": round(ratio_ahorro, 4)},
            pregunta_finsi="Vengo de la recomendación sobre construir capacidad de ahorro. Ayúdame a definir un plan mensual paso a paso.",
        )
    elif ratio_ahorro < 0.20:
        agregar(
            id="fortalecer-ahorro",
            tipo="ahorro_mejorable",
            prioridad="media",
            titulo="Fortalecer el ahorro mensual",
            diagnostico=f"La capacidad de ahorro actual es del {ratio_ahorro * 100:.1f}% de los ingresos.",
            accion="Aumentar el porcentaje reservado en pasos pequeños y sostenerlo durante varios meses.",
            objetivo="Avanzar gradualmente hacia un ahorro cercano al 20% de los ingresos.",
            evidencia={"ratio_ahorro_ingreso": round(ratio_ahorro, 4)},
            pregunta_finsi="Explícame cómo aumentar mi ahorro sin desordenar mi presupuesto actual.",
        )
    else:
        agregar(
            id="proteger-ahorro",
            tipo="ahorro_saludable",
            prioridad="sugerencia",
            titulo="Proteger y organizar el ahorro",
            diagnostico=f"La capacidad de ahorro estimada es del {ratio_ahorro * 100:.1f}% de los ingresos.",
            accion="Separar el ahorro destinado a emergencias del ahorro para metas de mediano o largo plazo.",
            objetivo="Construir o mantener un fondo de emergencia equivalente a entre 3 y 6 meses de gastos esenciales.",
            evidencia={"ratio_ahorro_ingreso": round(ratio_ahorro, 4)},
            pregunta_finsi="Vengo de la recomendación sobre proteger mi ahorro. Ayúdame a separar fondo de emergencia y metas.",
        )

    if recurrentes >= 15:
        agregar(
            id="auditar-gastos-recurrentes",
            tipo="recurrentes_altos",
            prioridad="media",
            titulo="Auditar pagos recurrentes",
            diagnostico=f"Hay {recurrentes} movimientos recurrentes registrados.",
            accion="Revisar suscripciones, membresías y débitos automáticos y cancelar los que ya no aportan valor.",
            objetivo="Eliminar cargos recurrentes innecesarios y liberar margen mensual.",
            evidencia={"cantidad_recurrentes": recurrentes},
            pregunta_finsi="Ayúdame a revisar la recomendación sobre pagos recurrentes y a decidir cuáles debería analizar primero.",
        )

    orden = {"alta": 0, "media": 1, "sugerencia": 2}
    recomendaciones.sort(key=lambda item: orden[item["prioridad"]])
    return recomendaciones[:4]


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
    transacciones_gasto = transacciones_usuario.copy()

    if "tipo" in transacciones_gasto.columns:
        transacciones_gasto = transacciones_gasto[
            transacciones_gasto["tipo"]
            .astype(str)
            .str.strip()
            .str.upper()
            .eq("GASTO")
        ]

    if transacciones_gasto.empty:
        return []

    categorias = (
        transacciones_gasto.groupby("categoria")["monto"]
        .sum()
        .sort_values(ascending=False)
        .head(3)
    )

    total_gastado = float(
        transacciones_gasto["monto"].sum()
    )

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




def construir_wallet(
    fila_usuario: pd.Series,
) -> dict:
    saldo_total = float(
        fila_usuario.get(
            "saldo_total",
            0.0,
        )
    )

    saldo_reservado = float(
        fila_usuario.get(
            "saldo_reservado",
            0.0,
        )
    )

    saldo_disponible = (
        saldo_total
        - saldo_reservado
    )

    return {
        "saldo_total": round(
            saldo_total,
            2,
        ),
        "saldo_reservado": round(
            saldo_reservado,
            2,
        ),
        "saldo_disponible": round(
            saldo_disponible,
            2,
        ),
    }

def construir_respuesta_analisis(
    usuario_id: str,
    perfil_predicho: str,
    confianza: float,
    probabilidades_clases: dict[str, float],
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
        "probabilidades_perfil": probabilidades_clases,
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
        "wallet": construir_wallet(fila_metricas),
        "categorias_principales": categorias_principales,
        "recomendaciones": generar_recomendaciones(
            fila_metricas, categorias_principales, str(perfil_predicho)
        ),
        "modelo_version": "10.0.0",
    }


def analizar_usuario(usuario_id: str) -> dict:
    _ensure_resources_loaded()
    coincidencias = usuarios[
        usuarios["usuario_id"] == usuario_id
    ]

    if coincidencias.empty:
        raise ValueError(
            f"No existe el usuario {usuario_id}."
        )

    fila = coincidencias.iloc[0]
    entrada_perfil = (
        fila[features_perfil]
        .to_frame()
        .T
    )

    perfil_predicho = modelo_perfil.predict(
        entrada_perfil
    )[0]

    probabilidades = modelo_perfil.predict_proba(
        entrada_perfil
    )[0]

    clases = list(modelo_perfil.classes_)

    probabilidades_clases = {
        str(clase): round(float(probabilidad), 4)
        for clase, probabilidad in zip(clases, probabilidades)
    }

    confianza = float(
        probabilidades[
            clases.index(perfil_predicho)
        ]
    )

    transacciones_usuario = transacciones[
        transacciones["usuario_id"]
        == usuario_id
    ]

    categorias_principales = (
        construir_categorias_principales(
            transacciones_usuario
        )
    )

    return construir_respuesta_analisis(
        usuario_id=usuario_id,
        perfil_predicho=perfil_predicho,
        confianza=confianza,
        probabilidades_clases=probabilidades_clases,
        fila_metricas=fila,
        categorias_principales=(
            categorias_principales
        ),
    )


def analizar_datos_usuario(datos: dict) -> dict:
    _ensure_resources_loaded()
    transacciones_entrada = pd.DataFrame(
        datos["transacciones"]
    )

    if transacciones_entrada.empty:
        raise ValueError(
            "El usuario no posee transacciones."
        )

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

    gasto_total = float(
        transacciones_entrada["monto"].sum()
    )

    gasto_promedio = float(
        transacciones_entrada["monto"].mean()
    )

    gasto_mediano = float(
        transacciones_entrada["monto"].median()
    )

    gasto_maximo = float(
        transacciones_entrada["monto"].max()
    )

    desviacion_gastos = float(
        transacciones_entrada["monto"].std()
    )

    if pd.isna(desviacion_gastos):
        desviacion_gastos = 0.0

    cantidad_recurrentes = int(
        transacciones_entrada["recurrente"]
        .astype(str)
        .str.lower()
        .isin(
            [
                "sí",
                "si",
                "true",
            ]
        )
        .sum()
    )

    cantidad_gastos_grandes = int(
        (
            transacciones_entrada["monto"]
            > gasto_mediano * 2
        ).sum()
    )

    categorias_distintas = int(
        transacciones_entrada[
            "categoria"
        ].nunique()
    )

    ingreso = float(
        datos["ingreso_mensual"]
    )

    deuda = float(
        datos["deuda_mensual"]
    )

    gasto_mensual = float(
        datos["gasto_mensual_promedio"]
    )

    ahorro = float(
        datos["ahorro_mensual_estimado"]
    )

    if ingreso <= 0:
        raise ValueError(
            "El ingreso mensual debe ser mayor que cero."
        )

    ratio_deuda = deuda / ingreso
    ratio_gasto = gasto_mensual / ingreso
    ratio_ahorro = ahorro / ingreso

    valores_perfil = {
        "ingreso_mensual": ingreso,
        "deuda_mensual": deuda,
        "saldo_total": 0.0,
        "saldo_reservado": 0.0,
        "saldo_disponible": 0.0,
        "nivel_endeudamiento": float(
            datos["nivel_endeudamiento"]
        ),
        "gasto_mensual_promedio": gasto_mensual,
        "ahorro_mensual_estimado": ahorro,
        "porcentaje_gastos_ingreso": float(
            datos["porcentaje_gastos_ingreso"]
        ),
        "cantidad_transacciones": len(
            transacciones_entrada
        ),
        "monto_total": gasto_total,
        "monto_promedio_transaccion": (
            gasto_promedio
        ),
        "monto_mediano": gasto_mediano,
        "monto_maximo": gasto_maximo,
        "desviacion_montos": desviacion_gastos,
        "cantidad_recurrentes": (
            cantidad_recurrentes
        ),
        "cantidad_transacciones_grandes": (
            cantidad_gastos_grandes
        ),
        "categorias_distintas": (
            categorias_distintas
        ),
        "ratio_deuda_ingreso_calculado": (
            ratio_deuda
        ),
        "ratio_gasto_ingreso_calculado": (
            ratio_gasto
        ),
        "ratio_ahorro_ingreso_calculado": (
            ratio_ahorro
        ),
        "frecuencia_ahorro": datos[
            "frecuencia_ahorro"
        ],
    }

    features_esperadas = list(
        modelo_perfil.feature_names_in_
    )

    features_faltantes = [
        feature
        for feature in features_esperadas
        if feature not in valores_perfil
    ]

    if features_faltantes:
        raise ValueError(
            "El backend no puede generar todas las "
            "features requeridas por el modelo de perfil: "
            f"{features_faltantes}"
        )

    entrada_perfil = pd.DataFrame(
        [
            {
                feature: valores_perfil[feature]
                for feature in features_esperadas
            }
        ],
        columns=features_esperadas,
    )

    fila_metricas = pd.Series(
        valores_perfil
    )

    perfil_predicho = modelo_perfil.predict(
        entrada_perfil
    )[0]

    probabilidades = modelo_perfil.predict_proba(
        entrada_perfil
    )[0]

    clases = list(modelo_perfil.classes_)

    probabilidades_clases = {
        str(clase): round(float(probabilidad), 4)
        for clase, probabilidad in zip(clases, probabilidades)
    }

    confianza = float(
        probabilidades[
            clases.index(perfil_predicho)
        ]
    )

    categorias_principales = (
        construir_categorias_principales(
            transacciones_entrada
        )
    )

    return construir_respuesta_analisis(
        usuario_id=str(
            datos["usuario_id"]
        ),
        perfil_predicho=perfil_predicho,
        confianza=confianza,
        probabilidades_clases=probabilidades_clases,
        fila_metricas=fila_metricas,
        categorias_principales=(
            categorias_principales
        ),
    )