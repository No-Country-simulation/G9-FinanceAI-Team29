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
        expense_ratio = cls._number(metrics.get("ratio_gasto_ingreso"))
        debt_ratio = cls._number(metrics.get("ratio_deuda_ingreso"))
        savings_ratio = cls._number(metrics.get("ratio_ahorro_ingreso"))

        if savings is not None:
            if savings < 0:
                facts.append(FinancialFact(
                    "monthly_deficit",
                    f"Existe un déficit mensual estimado de USD {abs(savings):.2f}.",
                    100,
                ))
            elif savings == 0:
                facts.append(FinancialFact(
                    "monthly_balance",
                    "Los ingresos cubren exactamente gastos y deuda, sin margen de ahorro.",
                    90,
                ))
            else:
                facts.append(FinancialFact(
                    "positive_savings_capacity",
                    f"La capacidad de ahorro mensual estimada es de USD {savings:.2f}.",
                    85,
                ))

        if expense_ratio is not None:
            if expense_ratio >= 80:
                facts.append(FinancialFact(
                    "high_expense_ratio",
                    f"Los gastos representan aproximadamente el {expense_ratio:.1f}% de los ingresos.",
                    90,
                ))
            elif expense_ratio <= 60:
                facts.append(FinancialFact(
                    "controlled_expenses",
                    f"Los gastos representan aproximadamente el {expense_ratio:.1f}% de los ingresos.",
                    55,
                ))

        if debt_ratio is not None:
            if debt_ratio >= 35:
                facts.append(FinancialFact(
                    "high_debt_burden",
                    f"La deuda mensual equivale aproximadamente al {debt_ratio:.1f}% de los ingresos.",
                    95,
                ))
            elif debt_ratio < 20:
                facts.append(FinancialFact(
                    "moderate_debt_burden",
                    f"La deuda mensual equivale aproximadamente al {debt_ratio:.1f}% de los ingresos.",
                    50,
                ))

        if savings_ratio is not None and savings_ratio >= 20:
            facts.append(FinancialFact(
                "strong_savings_ratio",
                f"El margen de ahorro equivale aproximadamente al {savings_ratio:.1f}% de los ingresos.",
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
                    f"La principal categoría de consumo registrada es {name}.",
                    65,
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
