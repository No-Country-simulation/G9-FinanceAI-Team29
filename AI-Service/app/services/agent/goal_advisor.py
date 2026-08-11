from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


@dataclass(frozen=True)
class GoalPlan:
    name: str
    target_amount: Decimal
    reserved_amount: Decimal
    remaining_amount: Decimal
    monthly_required: Decimal | None
    current_monthly_saving: Decimal
    monthly_gap: Decimal | None
    target_date: date | None
    months_remaining: int | None
    status: str


class GoalAdvisor:
    """Construye planes determinísticos para metas financieras reales.

    No usa LLM para inventar importes. Trabaja exclusivamente con:
    - datos persistidos de la meta;
    - métricas financieras verificadas;
    - cálculos derivados de esos datos.
    """

    @classmethod
    def build_plan(
        cls,
        goal: dict[str, Any],
        analysis: dict[str, Any] | None,
        today: date | None = None,
    ) -> str:
        today = today or date.today()
        plan = cls._build_goal_plan(
            goal=goal,
            analysis=analysis,
            today=today,
        )

        if plan.status == "completed":
            return (
                f"La meta **{plan.name}** ya está completada. "
                f"Alcanzaste el objetivo de {cls._format_money(plan.target_amount)}."
            )

        if plan.status == "no_date":
            return cls._build_without_date(plan)

        if plan.status == "overdue":
            return cls._build_overdue(plan)

        if plan.monthly_required is None:
            return cls._build_without_monthly_requirement(plan)

        if plan.monthly_gap is None:
            return cls._build_without_capacity_data(plan)

        if plan.monthly_gap <= 0:
            return cls._build_on_track(plan)

        return cls._build_with_gap(plan)

    @classmethod
    def _build_goal_plan(
        cls,
        goal: dict[str, Any],
        analysis: dict[str, Any] | None,
        today: date,
    ) -> GoalPlan:
        name = str(goal.get("nombre") or "Meta financiera").strip()

        target = cls._decimal(goal.get("monto_objetivo"))
        reserved = cls._decimal(goal.get("monto_reservado"))

        remaining = goal.get("monto_restante")
        if remaining is None:
            remaining_value = max(target - reserved, Decimal("0"))
        else:
            remaining_value = max(
                cls._decimal(remaining),
                Decimal("0"),
            )

        target_date = cls._parse_date(goal.get("fecha_objetivo"))

        current_saving = Decimal("0")
        has_saving_data = False

        if analysis:
            metrics = analysis.get("metricas", {})
            raw_saving = metrics.get("ahorro_mensual_estimado")

            if raw_saving is not None:
                current_saving = cls._decimal(raw_saving)
                has_saving_data = True

        if remaining_value <= 0:
            return GoalPlan(
                name=name,
                target_amount=target,
                reserved_amount=reserved,
                remaining_amount=remaining_value,
                monthly_required=Decimal("0"),
                current_monthly_saving=current_saving,
                monthly_gap=Decimal("0"),
                target_date=target_date,
                months_remaining=0,
                status="completed",
            )

        if target_date is None:
            return GoalPlan(
                name=name,
                target_amount=target,
                reserved_amount=reserved,
                remaining_amount=remaining_value,
                monthly_required=None,
                current_monthly_saving=current_saving,
                monthly_gap=None,
                target_date=None,
                months_remaining=None,
                status="no_date",
            )

        months_remaining = cls._months_between(today, target_date)

        if months_remaining <= 0:
            return GoalPlan(
                name=name,
                target_amount=target,
                reserved_amount=reserved,
                remaining_amount=remaining_value,
                monthly_required=None,
                current_monthly_saving=current_saving,
                monthly_gap=None,
                target_date=target_date,
                months_remaining=0,
                status="overdue",
            )

        monthly_required = cls._money(
            remaining_value / Decimal(months_remaining)
        )

        monthly_gap = None
        if has_saving_data:
            monthly_gap = cls._money(
                monthly_required - current_saving
            )

        return GoalPlan(
            name=name,
            target_amount=target,
            reserved_amount=reserved,
            remaining_amount=remaining_value,
            monthly_required=monthly_required,
            current_monthly_saving=current_saving,
            monthly_gap=monthly_gap,
            target_date=target_date,
            months_remaining=months_remaining,
            status="active",
        )

    @classmethod
    def _build_on_track(
        cls,
        plan: GoalPlan,
    ) -> str:
        assert plan.monthly_required is not None
        assert plan.monthly_gap is not None

        available_extra = abs(plan.monthly_gap)

        if available_extra > Decimal("0"):
            return cls._join(
                f"Vas bien con **{plan.name}**: necesitas "
                f"{cls._format_money(plan.monthly_required)} por mes y tu capacidad "
                f"estimada es {cls._format_money(plan.current_monthly_saving)}.",
                f"Tienes un margen aproximado de {cls._format_money(available_extra)} "
                "por mes. Conviene separar primero el aporte de la meta.",
            )

        return cls._join(
            f"Vas justo para cumplir **{plan.name}**: necesitas "
            f"{cls._format_money(plan.monthly_required)} por mes y tu capacidad "
            f"estimada es {cls._format_money(plan.current_monthly_saving)}.",
            "Conviene separar ese aporte al inicio de cada mes.",
        )

    @classmethod
    def _build_with_gap(
        cls,
        plan: GoalPlan,
    ) -> str:
        assert plan.monthly_required is not None
        assert plan.monthly_gap is not None

        gap = max(plan.monthly_gap, Decimal("0"))

        return cls._join(
            f"Con tu ritmo actual, **no llegarías a tiempo** a **{plan.name}**. "
            f"Necesitas {cls._format_money(plan.monthly_required)} por mes y tu "
            f"capacidad estimada es {cls._format_money(plan.current_monthly_saving)}.",
            f"La brecha es de **{cls._format_money(gap)} por mes**. Puedes reducir "
            "gastos ajustables, generar ingresos adicionales o extender la fecha.",
        )

    @classmethod
    def _build_without_capacity_data(
        cls,
        plan: GoalPlan,
    ) -> str:
        assert plan.monthly_required is not None

        return cls._join(
            f"Para **{plan.name}** necesitas aproximadamente "
            f"{cls._format_money(plan.monthly_required)} por mes.",
            "No tengo una estimación confiable de tu ahorro mensual, así que todavía "
            "no puedo confirmar si llegarías a tiempo.",
        )

    @classmethod
    def _build_without_date(
        cls,
        plan: GoalPlan,
    ) -> str:
        parts = [
            f"A **{plan.name}** le faltan {cls._format_money(plan.remaining_amount)}, "
            "pero no tiene una fecha objetivo.",
        ]

        if plan.current_monthly_saving > Decimal("0"):
            parts.append(
                f"Tu ahorro mensual estimado es "
                f"{cls._format_money(plan.current_monthly_saving)}."
            )

        parts.append(
            "Si defines una fecha, puedo calcular el aporte mensual necesario."
        )
        return cls._join(*parts)

    @classmethod
    def _build_overdue(
        cls,
        plan: GoalPlan,
    ) -> str:
        target_date_text = (
            plan.target_date.strftime("%d/%m/%Y")
            if plan.target_date
            else "la fecha registrada"
        )

        return cls._join(
            f"La fecha de **{plan.name}** ({target_date_text}) ya venció y todavía "
            f"faltan {cls._format_money(plan.remaining_amount)}.",
            "Conviene definir una nueva fecha para recalcular el aporte mensual.",
        )

    @classmethod
    def income_ideas(
        cls,
        monthly_gap: Any,
    ) -> str:
        gap = max(
            cls._decimal(monthly_gap),
            Decimal("0"),
        )

        if gap <= 0:
            return (
                "Según el cálculo actual no necesitas ingresos adicionales para "
                "cumplir la meta; tu capacidad de ahorro alcanza para cubrir el "
                "aporte mensual estimado."
            )

        return cls._join(
            f"Te faltan aproximadamente **{cls._format_money(gap)} por mes** para "
            "mantener la fecha actual.",
            "Puedes cubrir parte con gastos ajustables y, si no alcanza, evaluar "
            "freelance, servicios ocasionales, ventas o monetizar alguna habilidad. "
            "Evitaría asumir deuda nueva para financiar la meta.",
        )

    @classmethod
    def savings_method(
        cls,
        monthly_required: Any,
        current_saving: Any,
    ) -> str:
        required = max(
            cls._decimal(monthly_required),
            Decimal("0"),
        )
        available = cls._decimal(current_saving)

        if required <= 0:
            return (
                "No hay un aporte mensual pendiente para esta meta en este momento."
            )

        if available <= 0:
            return cls._join(
                f"El aporte necesario es de aproximadamente "
                f"{cls._format_money(required)} por mes.",
                "Como actualmente no aparece capacidad de ahorro positiva, primero "
                "conviene recuperar margen mensual antes de fijar un ahorro automático.",
            )

        if available >= required:
            return cls._join(
                f"El aporte necesario es de aproximadamente "
                f"{cls._format_money(required)} por mes.",
                "Puedes usar un método de ahorro prioritario: separar ese monto "
                "apenas recibes tus ingresos y considerar el resto como presupuesto "
                "disponible para el mes.",
            )

        gap = required - available

        return cls._join(
            f"Necesitas {cls._format_money(required)} por mes. Tu ahorro actual "
            f"cubre {cls._format_money(available)}, así que faltan "
            f"**{cls._format_money(gap)} mensuales**.",
            "Separa primero tu ahorro disponible y cubre la diferencia reduciendo "
            "gastos ajustables, con ingresos extra o extendiendo el plazo.",
        )

    @staticmethod
    def _months_between(
        today: date,
        target: date,
    ) -> int:
        if target <= today:
            return 0

        months = (
            (target.year - today.year) * 12
            + target.month
            - today.month
        )

        if target.day > today.day:
            months += 1

        return max(months, 1)

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if not value:
            return None

        if isinstance(value, date):
            return value

        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        if value is None:
            return Decimal("0")

        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal("0")

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return value.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    @classmethod
    def _format_money(
        cls,
        value: Any,
    ) -> str:
        decimal_value = cls._money(
            cls._decimal(value)
        )

        english = f"{decimal_value:,.2f}"
        localized = (
            english.replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )

        return f"${localized}"

    @staticmethod
    def _join(*parts: str) -> str:
        cleaned = [
            part.strip()
            for part in parts
            if part and part.strip()
        ]
        return "\n\n".join(cleaned)