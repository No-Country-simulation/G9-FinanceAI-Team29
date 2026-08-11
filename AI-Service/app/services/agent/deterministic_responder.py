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
            return cls._debt_message(
                monthly_debt=metrics.get("deuda_mensual"),
                debt_ratio=(
                    metrics.get("ratio_deuda_ingreso")
                    if metrics.get("ratio_deuda_ingreso") is not None
                    else metrics.get("ratio_deuda_ingreso_calculado")
                ),
                debt_percentage=(
                    metrics.get("nivel_endeudamiento")
                    if metrics.get("nivel_endeudamiento") is not None
                    else analysis.get("nivel_endeudamiento")
                ),
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
    def _debt_message(
        cls,
        monthly_debt: Any,
        debt_ratio: Any,
        debt_percentage: Any,
    ) -> str:
        percentage: Decimal | None = None

        if debt_ratio is not None:
            ratio = cls._decimal(debt_ratio)
            percentage = (
                ratio * Decimal("100")
                if ratio <= Decimal("1")
                else ratio
            )
        elif debt_percentage is not None:
            percentage = cls._decimal(debt_percentage)

        parts: list[str] = []

        if percentage is not None:
            rounded_percentage = percentage.quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )

            parts.append(
                "Tu nivel de endeudamiento actual es "
                f"{rounded_percentage:.2f}% de tus ingresos."
            )

            if rounded_percentage <= Decimal("20"):
                parts.append(
                    "Se encuentra dentro de un rango saludable."
                )
            elif rounded_percentage <= Decimal("30"):
                parts.append(
                    "Se encuentra en un rango moderado y conviene "
                    "mantenerlo bajo seguimiento."
                )
            elif rounded_percentage <= Decimal("50"):
                parts.append(
                    "Se encuentra en un rango elevado y conviene revisar "
                    "las obligaciones mensuales."
                )
            else:
                parts.append(
                    "Se encuentra en un rango alto y requiere atención."
                )

        if monthly_debt is not None:
            parts.append(
                "Tu deuda mensual registrada es "
                f"{cls._format_money(monthly_debt)}."
            )

        if not parts:
            return (
                "No hay información suficiente para calcular tu nivel de "
                "endeudamiento."
            )

        return " ".join(parts)

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
                "Puedes ahorrar aproximadamente "
                f"{cls._format_money(balance)} por mes."
            )

        if balance == 0:
            return (
                "Actualmente no tienes capacidad de ahorro mensual. "
                "Tus ingresos alcanzan para cubrir exactamente "
                "tus gastos y deudas."
            )

        return (
            "Actualmente no tienes capacidad de ahorro mensual. "
            "Con tus ingresos, gastos y deudas actuales, "
            "tu balance mensual estimado presenta un déficit de "
            f"{cls._format_money(abs(balance))}."
        )

    @classmethod
    def recommendations(
        cls,
        analysis: dict[str, Any],
        question: str = "",
    ) -> str:
        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}

        income = cls._optional_decimal(metrics.get("ingreso_mensual"))
        expenses = cls._optional_decimal(metrics.get("gasto_mensual_promedio"))
        debt = cls._optional_decimal(metrics.get("deuda_mensual"))
        savings = cls._optional_decimal(metrics.get("ahorro_mensual_estimado"))
        normalized = str(question).casefold()

        lines: list[str] = []
        if "deuda" in normalized or "debo" in normalized:
            lines.append(
                "Primero revisaría las deudas con mayor tasa de interés y "
                "evitaría asumir nuevas obligaciones."
            )
        elif "gasto" in normalized or "categoria" in normalized:
            lines.append(
                "Primero revisaría las categorías con mayor gasto y los "
                "consumos recurrentes para identificar ajustes posibles."
            )
        else:
            lines.append(
                "Primero revisaría la relación entre tus ingresos, gastos, "
                "deudas y capacidad de ahorro."
            )

        if income is not None and expenses is not None and income > 0:
            ratio = (expenses / income * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if ratio >= Decimal("80"):
                lines.append(
                    f"Tus gastos representan aproximadamente {ratio:.2f}% de "
                    "tus ingresos, por lo que conviene reducir gastos variables "
                    "o recurrentes."
                )

        if income is not None and debt is not None and income > 0:
            ratio = (debt / income * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            lines.append(
                f"Tu deuda mensual representa aproximadamente {ratio:.2f}% "
                "de tus ingresos."
            )

        if savings is None or savings <= 0:
            lines.append(
                "Actualmente no se observa capacidad de ahorro mensual. "
                "Un primer objetivo es liberar un margen pequeño y constante."
            )
        else:
            lines.append(
                "Mantén una parte del excedente mensual separada como ahorro "
                "automático o fondo de emergencia."
            )

        lines.append(
            "Estas sugerencias son orientativas y no reemplazan el "
            "asesoramiento profesional."
        )
        return "\n\n".join(lines)

    @staticmethod
    def _optional_decimal(value: Any) -> Decimal | None:
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return None

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
