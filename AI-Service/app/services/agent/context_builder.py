from typing import Any


class FinancialContextBuilder:
    """
    Construye el contexto financiero que será enviado al LLM.
    Por ahora recibe los datos ya calculados. Más adelante
    se conectará automáticamente al ML y al RAG.
    """

    def build(
        self,
        user_data: dict[str, Any],
        transactions: list[dict[str, Any]],
        profile: dict[str, Any],
    ) -> dict[str, Any]:

        ingresos = [
            t for t in transactions
            if t.get("tipo") == "ingreso"
        ]

        gastos = [
            t for t in transactions
            if t.get("tipo") == "gasto"
        ]

        total_ingresos = sum(
            float(t.get("monto", 0))
            for t in ingresos
        )

        total_gastos = sum(
            float(t.get("monto", 0))
            for t in gastos
        )

        balance = total_ingresos - total_gastos

        return {
            "usuario": user_data,
            "perfil_financiero": profile,
            "resumen": {
                "ingresos": total_ingresos,
                "gastos": total_gastos,
                "balance": balance,
                "cantidad_transacciones": len(transactions),
            },
            "transacciones": transactions,
        }