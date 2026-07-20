from collections import defaultdict
from typing import Any


class FinancialTools:
    @staticmethod
    def total_ingresos(transactions: list[dict[str, Any]]) -> float:
        return sum(
            float(t.get("monto", 0))
            for t in transactions
            if t.get("tipo") == "ingreso"
        )

    @staticmethod
    def total_gastos(transactions: list[dict[str, Any]]) -> float:
        return sum(
            float(t.get("monto", 0))
            for t in transactions
            if t.get("tipo") == "gasto"
        )

    @staticmethod
    def balance(transactions: list[dict[str, Any]]) -> float:
        return (
            FinancialTools.total_ingresos(transactions)
            - FinancialTools.total_gastos(transactions)
        )

    @staticmethod
    def gastos_por_categoria(
        transactions: list[dict[str, Any]],
    ) -> dict[str, float]:

        categorias = defaultdict(float)

        for t in transactions:
            if t.get("tipo") != "gasto":
                continue

            categoria = t.get("categoria", "Sin categoría")

            categorias[categoria] += float(
                t.get("monto", 0)
            )

        return dict(categorias)