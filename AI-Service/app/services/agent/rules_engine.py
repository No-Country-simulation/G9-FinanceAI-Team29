from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FinancialFact:
    code: str
    message: str
    priority: int = 50


class FinancialRulesEngine:
    """Convierte métricas calculadas en hechos financieros verificables."""

    @classmethod
    def evaluate(cls, analysis: dict[str, Any]) -> list[dict[str, Any]]:
        metrics = analysis.get("metricas") or {}
        facts: list[FinancialFact] = []

        income = cls._number(metrics.get("ingreso_mensual"))
        expenses = cls._number(metrics.get("gasto_mensual_promedio"))
        debt = cls._number(metrics.get("deuda_mensual"))
        savings = cls._number(metrics.get("ahorro_mensual_estimado"))

        expense_ratio = cls._ratio_to_percent(
            metrics.get("ratio_gasto_ingreso")
        )
        debt_ratio = cls._ratio_to_percent(
            metrics.get("ratio_deuda_ingreso")
        )
        savings_ratio = cls._ratio_to_percent(
            metrics.get("ratio_ahorro_ingreso")
        )

        if savings is not None:
            if savings < 0:
                facts.append(FinancialFact(
                    "monthly_deficit",
                    (
                        "Existe un déficit mensual estimado de "
                        f"{cls._format_money(abs(savings))}."
                    ),
                    100,
                ))
            elif savings == 0:
                facts.append(FinancialFact(
                    "monthly_balance",
                    "Los ingresos cubren exactamente los gastos, sin margen mensual disponible.",
                    90,
                ))
            else:
                facts.append(FinancialFact(
                    "positive_savings_capacity",
                    (
                        "La capacidad de ahorro mensual estimada es de "
                        f"{cls._format_money(savings)}."
                    ),
                    85,
                ))

        if expense_ratio is not None:
            if expense_ratio >= 80:
                facts.append(FinancialFact(
                    "high_expense_ratio",
                    (
                        "Los gastos representan aproximadamente el "
                        f"{expense_ratio:.1f}% de los ingresos."
                    ),
                    90,
                ))
            elif expense_ratio <= 60:
                facts.append(FinancialFact(
                    "controlled_expenses",
                    (
                        "Los gastos representan aproximadamente el "
                        f"{expense_ratio:.1f}% de los ingresos."
                    ),
                    55,
                ))

        if debt_ratio is not None:
            if debt_ratio > 40:
                facts.append(FinancialFact(
                    "high_debt_burden",
                    (
                        "La deuda mensual equivale aproximadamente al "
                        f"{debt_ratio:.1f}% de los ingresos y se encuentra "
                        "en el rango alto utilizado por FinSightAI."
                    ),
                    95,
                ))
            elif debt_ratio > 20:
                facts.append(FinancialFact(
                    "intermediate_debt_burden",
                    (
                        "La deuda mensual equivale aproximadamente al "
                        f"{debt_ratio:.1f}% de los ingresos y se encuentra "
                        "en el rango intermedio utilizado por FinSightAI."
                    ),
                    70,
                ))
            else:
                facts.append(FinancialFact(
                    "healthy_debt_burden",
                    (
                        "La deuda mensual equivale aproximadamente al "
                        f"{debt_ratio:.1f}% de los ingresos y se encuentra "
                        "dentro del rango saludable utilizado por FinSightAI."
                    ),
                    50,
                ))

        if savings_ratio is not None and savings_ratio >= 20:
            facts.append(FinancialFact(
                "strong_savings_ratio",
                (
                    "El margen de ahorro equivale aproximadamente al "
                    f"{savings_ratio:.1f}% de los ingresos."
                ),
                60,
            ))

        score = cls._number(analysis.get("financial_score"))
        status = analysis.get("score_status")
        if score is not None:
            label = f" ({status})" if status else ""
            facts.append(FinancialFact(
                "financial_score",
                f"El puntaje financiero actual es {score:.0f}{label}.",
                45,
            ))

        categories = analysis.get("categorias_principales") or []
        if categories:
            first = categories[0]
            if isinstance(first, dict):
                name = first.get("categoria") or first.get("nombre")
            else:
                name = str(first)
            if name:
                facts.append(FinancialFact(
                    "main_expense_category",
                    f"La principal categoría de gasto registrada es {name}.",
                    65,
                ))

        # La orientación profesional se reserva para señales cuantitativas fuertes.
        # Un score o etiqueta de riesgo por sí solos no bastan para sugerirla en
        # cada consulta cotidiana.
        significant_deficit = (
            savings is not None
            and savings < 0
            and income is not None
            and income > 0
            and abs(savings) / income >= 0.10
        )
        high_debt = debt_ratio is not None and debt_ratio > 40

        if significant_deficit or high_debt:
            reasons: list[str] = []
            if significant_deficit:
                reasons.append("existe un déficit mensual significativo")
            if high_debt:
                reasons.append(
                    "la carga mensual de deuda supera el rango intermedio de FinSightAI"
                )
            reason_text = "; ".join(reasons)
            facts.append(FinancialFact(
                "professional_advice_recommended",
                (
                    "Podría ser conveniente buscar orientación de un asesor financiero "
                    f"calificado porque {reason_text}."
                ),
                88,
            ))

        if income is None or expenses is None or debt is None:
            facts.append(FinancialFact(
                "limited_data",
                "Faltan uno o más totales mensuales para una evaluación completa.",
                80,
            ))

        return [
            {"code": fact.code, "message": fact.message, "priority": fact.priority}
            for fact in sorted(facts, key=lambda item: item.priority, reverse=True)
        ]

    @staticmethod
    def _number(value: Any) -> float | None:
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @classmethod
    def _ratio_to_percent(cls, value: Any) -> float | None:
        ratio = cls._number(value)
        if ratio is None:
            return None
        return ratio * 100 if abs(ratio) <= 1 else ratio

    @staticmethod
    def _format_money(value: float) -> str:
        formatted = f"{value:,.2f}"
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return f"${formatted}"