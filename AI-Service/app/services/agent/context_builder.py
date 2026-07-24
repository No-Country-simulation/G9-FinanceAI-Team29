from typing import Any

from app.services.agent.intent import Intent


class FinancialContextBuilder:
    """Selecciona solo los datos necesarios para cada intención."""

    @staticmethod
    def build(
        intent: Intent,
        analysis: dict[str, Any],
        currency: str = "USD",
    ) -> dict[str, Any]:
        metrics = analysis.get("metricas", {})
        base = {"currency": currency}

        if intent == Intent.INCOME:
            return {
                **base,
                "ingresos": {
                    "ingreso_mensual": metrics.get("ingreso_mensual"),
                },
            }

        if intent == Intent.EXPENSES:
            return {
                **base,
                "gastos": {
                    "gasto_mensual_promedio": metrics.get(
                        "gasto_mensual_promedio"
                    ),
                    "ratio_gasto_ingreso": metrics.get(
                        "ratio_gasto_ingreso"
                    ),
                    "categorias_principales": analysis.get(
                        "categorias_principales",
                        [],
                    ),
                },
            }

        if intent == Intent.DEBT:
            return {
                **base,
                "deuda": {
                    "deuda_mensual": metrics.get("deuda_mensual"),
                    "ratio_deuda_ingreso": metrics.get(
                        "ratio_deuda_ingreso"
                    ),
                    "ingreso_mensual": metrics.get("ingreso_mensual"),
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
            return {
                **base,
                "puntaje_financiero": {
                    "financial_score": analysis.get("financial_score"),
                    "score_status": analysis.get("score_status"),
                    "nivel_riesgo": analysis.get("nivel_riesgo"),
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

        if intent == Intent.RECOMMENDATIONS:
            return {
                **base,
                "orientacion": {
                    "recomendaciones": analysis.get(
                        "recomendaciones",
                        [],
                    ),
                    "fortalezas": analysis.get("fortalezas", []),
                    "oportunidades_mejora": analysis.get(
                        "oportunidades_mejora",
                        [],
                    ),
                    "metricas": metrics,
                    "categorias_principales": analysis.get(
                        "categorias_principales",
                        [],
                    ),
                },
            }

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
            "fortalezas": analysis.get("fortalezas", []),
            "oportunidades_mejora": analysis.get(
                "oportunidades_mejora",
                [],
            ),
            "recomendaciones": analysis.get("recomendaciones", []),
        }
