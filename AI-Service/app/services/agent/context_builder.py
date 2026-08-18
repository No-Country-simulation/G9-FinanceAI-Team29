from typing import Any

from app.services.agent.intent import Intent


class FinancialContextBuilder:
    """Selecciona solo los datos necesarios para cada intención."""

    @staticmethod
    def _category_context(categories: Any) -> list[dict[str, Any]]:
        if not isinstance(categories, list):
            return []

        normalized: list[dict[str, Any]] = []
        for item in categories:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    "categoria": item.get("categoria") or item.get("nombre"),
                    "monto_mensual_categoria": item.get("monto"),
                    "porcentaje_del_gasto_total": item.get("porcentaje"),
                }
            )
        return normalized

    @staticmethod
    def _safe_recommendations(values: Any) -> list[str]:
        if not isinstance(values, list):
            return []

        safe: list[str] = []
        for value in values:
            text = str(value or "").strip()
            if not text:
                continue

            normalized = text.lower()
            # No convertir referencias genéricas de ahorro en una meta personalizada
            # automática. Si el usuario pide una simulación, el LLM podrá plantearla
            # explícitamente como escenario hipotético.
            if "10%" in normalized and "ahorro" in normalized:
                continue

            safe.append(text)
        return safe

    @staticmethod
    def _fact_value(rules: list[dict[str, Any]], code: str) -> str | None:
        for rule in rules or []:
            if not isinstance(rule, dict):
                continue
            if rule.get("code") != code:
                continue
            message = str(rule.get("message") or "").strip()
            if message:
                return message
        return None

    @staticmethod
    def build(
        intent: Intent,
        analysis: dict[str, Any],
        rules: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not isinstance(analysis, dict):
            raise ValueError("El análisis financiero debe ser un diccionario.")

        metrics = analysis.get("metricas") or {}
        if not isinstance(metrics, dict):
            metrics = {}

        base = {"currency": "$"}
        verified_facts = rules or []

        if intent == Intent.INCOME:
            return {
                **base,
                "ingresos": {
                    "ingreso_mensual": metrics.get("ingreso_mensual"),
                },
            }

        if intent == Intent.EXPENSES:
            ingreso = metrics.get("ingreso_mensual")
            gasto = metrics.get("gasto_mensual_promedio")
            ratio = metrics.get("ratio_gasto_ingreso")

            saldo_despues_gastos = None
            gastos_superan_ingresos = None
            porcentaje_gasto_ingreso = None

            try:
                ingreso_num = float(ingreso) if ingreso is not None else None
                gasto_num = float(gasto) if gasto is not None else None

                if ingreso_num is not None and gasto_num is not None:
                    saldo_despues_gastos = round(ingreso_num - gasto_num, 2)
                    gastos_superan_ingresos = gasto_num > ingreso_num

                if ratio is not None:
                    ratio_num = float(ratio)
                    porcentaje_gasto_ingreso = round(
                        ratio_num * 100 if ratio_num <= 1 else ratio_num,
                        2,
                    )
                elif (
                    ingreso_num is not None
                    and gasto_num is not None
                    and ingreso_num > 0
                ):
                    porcentaje_gasto_ingreso = round(
                        gasto_num / ingreso_num * 100,
                        2,
                    )
            except (TypeError, ValueError):
                pass

            return {
                **base,
                "gastos": {
                    "ingreso_mensual": ingreso,
                    "gasto_mensual_promedio": gasto,
                    "ratio_gasto_ingreso": ratio,
                    "porcentaje_gasto_ingreso": porcentaje_gasto_ingreso,
                    "saldo_despues_gastos": saldo_despues_gastos,
                    "gastos_superan_ingresos": gastos_superan_ingresos,
                    "categorias_de_gasto": FinancialContextBuilder._category_context(
                        analysis.get("categorias_principales", [])
                    ),
                    "nota_categorias": (
                        "Los porcentajes de las categorías son participaciones "
                        "sobre el gasto total, no sobre el ingreso."
                    ),
                },
            }

        if intent == Intent.DEBT:
            deuda = metrics.get("deuda_mensual")
            ratio = metrics.get("ratio_deuda_ingreso")
            porcentaje_deuda_ingreso = None

            try:
                if ratio is not None:
                    ratio_num = float(ratio)
                    porcentaje_deuda_ingreso = round(
                        ratio_num * 100 if ratio_num <= 1 else ratio_num,
                        2,
                    )
            except (TypeError, ValueError):
                pass

            return {
                **base,
                "deuda": {
                    "deuda_mensual": deuda,
                    "ratio_deuda_ingreso": ratio,
                    "porcentaje_deuda_ingreso": porcentaje_deuda_ingreso,
                    "ingreso_mensual": metrics.get("ingreso_mensual"),
                    "rango_financial_finsight": (
                        "saludable"
                        if porcentaje_deuda_ingreso is not None
                        and porcentaje_deuda_ingreso <= 20
                        else "intermedio"
                        if porcentaje_deuda_ingreso is not None
                        and porcentaje_deuda_ingreso <= 40
                        else "alto"
                        if porcentaje_deuda_ingreso is not None
                        else None
                    ),
                },
            }

        if intent == Intent.SAVINGS:
            return {
                **base,
                "ahorro": {
                    "ahorro_mensual_estimado": metrics.get(
                        "ahorro_mensual_estimado"
                    ),
                    "ratio_ahorro_ingreso": metrics.get(
                        "ratio_ahorro_ingreso"
                    ),
                    "ingreso_mensual": metrics.get("ingreso_mensual"),
                    "gasto_mensual_promedio": metrics.get(
                        "gasto_mensual_promedio"
                    ),
                    "deuda_mensual": metrics.get("deuda_mensual"),
                },
            }

        if intent == Intent.SCORE:
            score = analysis.get("financial_score")
            status = analysis.get("score_status")
            risk = analysis.get("nivel_riesgo")

            # Algunas respuestas del backend incluyen el score en hechos verificados
            # aunque el campo superior no esté poblado. Lo exponemos también como
            # respaldo textual para evitar respuestas "no hay puntaje" cuando sí existe.
            score_fact = FinancialContextBuilder._fact_value(
                verified_facts,
                "financial_score",
            )

            return {
                **base,
                "puntaje_financiero": {
                    "financial_score": score,
                    "score_status": status,
                    "nivel_riesgo": risk,
                    "hecho_verificado_puntaje": score_fact,
                    "explicacion": analysis.get("explicacion"),
                    "metricas": {
                        "ingreso_mensual": metrics.get(
                            "ingreso_mensual"
                        ),
                        "gasto_mensual_promedio": metrics.get(
                            "gasto_mensual_promedio"
                        ),
                        "deuda_mensual": metrics.get(
                            "deuda_mensual"
                        ),
                        "ahorro_mensual_estimado": metrics.get(
                            "ahorro_mensual_estimado"
                        ),
                        "ratio_gasto_ingreso": metrics.get(
                            "ratio_gasto_ingreso"
                        ),
                        "ratio_deuda_ingreso": metrics.get(
                            "ratio_deuda_ingreso"
                        ),
                        "ratio_ahorro_ingreso": metrics.get(
                            "ratio_ahorro_ingreso"
                        ),
                    },
                    "categorias_principales": (
                        FinancialContextBuilder._category_context(
                            analysis.get(
                                "categorias_principales",
                                [],
                            )
                        )
                    ),
                },
            }

        if intent == Intent.PROFILE:
            return {
                **base,
                "perfil": {
                    "perfil_financiero": analysis.get(
                        "perfil_financiero"
                    ),
                    "nivel_riesgo": analysis.get("nivel_riesgo"),
                    "financial_score": analysis.get("financial_score"),
                    "score_status": analysis.get("score_status"),
                    "metricas": metrics,
                },
            }

        if intent in {Intent.RECOMMENDATIONS}:
            return {
                **base,
                "orientacion": {
                    "recomendaciones_existentes": FinancialContextBuilder._safe_recommendations(
                        analysis.get("recomendaciones", [])
                    ),
                    "fortalezas": analysis.get("fortalezas", []),
                    "oportunidades_mejora": analysis.get(
                        "oportunidades_mejora",
                        [],
                    ),
                    "metricas": {
                        "ingreso_mensual": metrics.get("ingreso_mensual"),
                        "gasto_mensual_promedio": metrics.get(
                            "gasto_mensual_promedio"
                        ),
                        "deuda_mensual": metrics.get("deuda_mensual"),
                        "ahorro_mensual_estimado": metrics.get(
                            "ahorro_mensual_estimado"
                        ),
                        "ratio_gasto_ingreso": metrics.get(
                            "ratio_gasto_ingreso"
                        ),
                        "ratio_deuda_ingreso": metrics.get(
                            "ratio_deuda_ingreso"
                        ),
                        "ratio_ahorro_ingreso": metrics.get(
                            "ratio_ahorro_ingreso"
                        ),
                    },
                    "categorias_de_gasto": FinancialContextBuilder._category_context(
                        analysis.get("categorias_principales", [])
                    ),
                    "semantica": {
                        "porcentajes_categorias": (
                            "Cada porcentaje de categoría representa su participación "
                            "sobre el gasto total mensual."
                        ),
                        "categoria_deudas": (
                            "La categoría Deudas es un agregado de transacciones de gasto. "
                            "No es el saldo pendiente de deuda ni sustituye la métrica deuda_mensual."
                        ),
                        "deuda_mensual": (
                            "deuda_mensual es la métrica de endeudamiento calculada por FinSightAI."
                        ),
                    },
                    "disponibilidad_datos_deuda": {
                        "saldo_total_disponible": analysis.get("deuda_total") is not None,
                        "tasas_disponibles": bool(analysis.get("tasas_deuda")),
                        "plazos_disponibles": bool(analysis.get("plazos_deuda")),
                        "detalle_obligaciones_disponible": bool(
                            analysis.get("detalle_deudas")
                        ),
                    },
                    "restricciones_recomendacion": {
                        "no_inferir_composicion_categorias": True,
                        "no_recomendar_consolidacion_sin_datos": True,
                        "no_recomendar_pago_anticipado_sin_datos": True,
                        "no_asignar_ahorro_automaticamente": True,
                    },
                    "hechos_verificados": verified_facts,
                },
            }

        if intent not in {Intent.FULL_ANALYSIS, Intent.BUDGET, Intent.SUMMARY}:
            return base

        return {
            **base,
            "financial_score": analysis.get("financial_score"),
            "score_status": analysis.get("score_status"),
            "nivel_riesgo": analysis.get("nivel_riesgo"),
            "perfil_financiero": analysis.get("perfil_financiero"),
            "explicacion": analysis.get("explicacion"),
            "metricas": metrics,
            "categorias_principales": analysis.get(
                "categorias_principales",
                [],
            ),
            "semantica_categorias": (
                "Los porcentajes de categorias_principales representan "
                "participaciones sobre el gasto total, no sobre el ingreso."
            ),
            "fortalezas": analysis.get("fortalezas", []),
            "oportunidades_mejora": analysis.get(
                "oportunidades_mejora",
                [],
            ),
            "recomendaciones": analysis.get("recomendaciones", []),
            "semantica_presupuesto": {
                "usar_balance_calculado": True,
                "no_inventar_objetivo_ahorro": True,
                "no_inventar_recorte": True,
                "no_sumar_deuda_dos_veces": True,
                "gasto_mensual_es_fuente_de_verdad": metrics.get(
                    "gasto_mensual_promedio"
                ),
                "ahorro_mensual_es_fuente_de_verdad": metrics.get(
                    "ahorro_mensual_estimado"
                ),
            },
            "hechos_verificados": verified_facts,
        }
