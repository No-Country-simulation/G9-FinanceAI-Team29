from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from app.services.agent.intent import Intent


class DeterministicFinancialResponder:
    """Responde hechos financieros ya calculados sin utilizar IA generativa."""

    CURRENCY = "USD"

    @classmethod
    def respond(
        cls,
        intent: Intent,
        analysis: dict[str, Any],
    ) -> str:
        metrics = (
            analysis.get("metricas")
            if isinstance(analysis, dict)
            else None
        )
        metrics = metrics if isinstance(metrics, dict) else {}

        if intent == Intent.INCOME:
            return cls._metric_message(
                label="Tu ingreso mensual registrado es",
                value=metrics.get("ingreso_mensual"),
            )

        if intent == Intent.EXPENSES:
            return cls._metric_message(
                label="Tu gasto mensual promedio es",
                value=metrics.get("gasto_mensual_promedio"),
            )

        if intent == Intent.DEBT:
            return cls._metric_message(
                label="Tu deuda mensual registrada es",
                value=metrics.get("deuda_mensual"),
            )

        if intent == Intent.SAVINGS:
            return cls._savings_message(
                value=metrics.get("ahorro_mensual_estimado"),
            )

        if intent == Intent.SCORE:
            score = analysis.get("financial_score")
            status = analysis.get("score_status")

            if score is None:
                return (
                    "Todavía no hay un puntaje financiero "
                    "disponible para tu cuenta."
                )

            suffix = f" ({status})" if status else ""
            return f"Tu puntaje financiero actual es {score}{suffix}."

        if intent == Intent.PROFILE:
            profile = analysis.get("perfil_financiero")
            risk = analysis.get("nivel_riesgo")

            if not profile:
                return (
                    "Todavía no hay un perfil financiero "
                    "disponible para tu cuenta."
                )

            suffix = (
                f" y tu nivel de riesgo es {risk}"
                if risk
                else ""
            )
            return f"Tu perfil financiero actual es {profile}{suffix}."

        raise ValueError(
            "No existe una respuesta determinista para "
            f"la intención {intent.value}."
        )

    @classmethod
    def _savings_message(cls, value: Any) -> str:
        if value is None:
            return (
                "No hay información suficiente para calcular "
                "tu capacidad de ahorro mensual."
            )

        balance = cls._decimal(value)

        if balance > 0:
            return (
                "Podés ahorrar aproximadamente "
                f"{cls._format_money(balance)} por mes."
            )

        if balance == 0:
            return (
                "Actualmente no tenés capacidad de ahorro mensual. "
                "Tus ingresos alcanzan para cubrir exactamente "
                "tus gastos y deudas."
            )

        return (
            "Actualmente no tenés capacidad de ahorro mensual. "
            "Con tus ingresos, gastos y deudas actuales, "
            "tu balance mensual estimado presenta un déficit de "
            f"{cls._format_money(abs(balance))}."
        )

    @classmethod
    def _metric_message(
        cls,
        label: str,
        value: Any,
    ) -> str:
        if value is None:
            return (
                "No hay información suficiente disponible "
                "para responder esa consulta."
            )

        return f"{label} {cls._format_money(value)}."

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError) as error:
            raise ValueError(
                "El dato financiero disponible no tiene "
                "un formato válido."
            ) from error

    @classmethod
    def _format_money(cls, value: Any) -> str:
        rounded = cls._decimal(value).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        return f"{cls.CURRENCY} {rounded:.2f}"
