from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


class DeterministicGoalResponder:
    """Resume metas del usuario sin utilizar un LLM."""

    @classmethod
    def respond(cls, goals: list[dict[str, Any]]) -> str:
        active = [goal for goal in goals if goal.get("estado") == "ACTIVA"]
        completed = [goal for goal in goals if goal.get("estado") == "COMPLETADA"]

        if not goals:
            return "Todavía no tenés metas financieras registradas."
        if not active:
            if completed:
                return f"No tenés metas activas. Ya completaste {len(completed)} meta(s)."
            return "No tenés metas financieras activas en este momento."

        if len(active) == 1:
            return cls._describe(active[0])

        lines = [f"Tenés {len(active)} metas activas:"]
        for goal in active[:5]:
            target = cls._decimal(goal.get("monto_objetivo", 0))
            reserved = cls._decimal(goal.get("monto_reservado", 0))
            progress = cls._progress(target, reserved)
            remaining = max(target - reserved, Decimal("0"))
            lines.append(
                f"- {goal.get('nombre', 'Meta')}: {progress:.1f}% completada; "
                f"faltan USD {remaining:.2f}."
            )
        if len(active) > 5:
            lines.append(f"- Y {len(active) - 5} meta(s) activa(s) más.")
        return "\n".join(lines)

    @classmethod
    def _describe(cls, goal: dict[str, Any]) -> str:
        target = cls._decimal(goal.get("monto_objetivo", 0))
        reserved = cls._decimal(goal.get("monto_reservado", 0))
        remaining = max(target - reserved, Decimal("0"))
        progress = cls._progress(target, reserved)
        name = goal.get("nombre", "Tu meta")

        message = (
            f"Tu meta “{name}” está completada en un {progress:.1f}%. "
            f"Reservaste USD {reserved:.2f} de USD {target:.2f} y "
            f"te faltan USD {remaining:.2f}."
        )

        monthly = goal.get("reserva_mensual_sugerida")
        if monthly is not None:
            monthly_value = cls._decimal(monthly)
            if monthly_value > 0:
                message += f" La reserva mensual sugerida es de USD {monthly_value:.2f}."

        target_date = goal.get("fecha_objetivo")
        if target_date:
            message += f" La fecha objetivo es {cls._format_date(target_date)}."
        return message

    @staticmethod
    def _progress(target: Decimal, reserved: Decimal) -> float:
        if target <= 0:
            return 0.0
        return float(min((reserved / target) * Decimal("100"), Decimal("100")))

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("0.00")

    @staticmethod
    def _format_date(value: Any) -> str:
        if isinstance(value, date):
            parsed = value
        else:
            try:
                parsed = date.fromisoformat(str(value))
            except ValueError:
                return str(value)
        return parsed.strftime("%d/%m/%Y")
