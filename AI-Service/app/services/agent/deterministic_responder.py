from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from app.services.agent.intent import Intent


class DeterministicFinancialResponder:
    """Responde hechos financieros ya calculados sin utilizar IA generativa."""

    CURRENCY = "$"

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

        if intent == Intent.TOP_EXPENSE_CATEGORY:
            return cls._top_expense_category_message(analysis)

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

        if intent == Intent.SUMMARY:
            return cls.summary(analysis)

        if intent == Intent.FULL_ANALYSIS:
            return cls.full_analysis(analysis)

        raise ValueError(
            "No existe una respuesta determinista para "
            f"la intención {intent.value}."
        )

    @classmethod
    def _top_expense_category_message(
        cls,
        analysis: dict[str, Any],
    ) -> str:
        categorias = (
            analysis.get("categorias_principales")
            if isinstance(analysis, dict)
            else None
        )

        if not isinstance(categorias, list) or not categorias:
            return (
                "No hay información suficiente para determinar "
                "tu categoría de mayor gasto."
            )

        categorias_validas = [
            categoria
            for categoria in categorias
            if isinstance(categoria, dict)
        ]

        if not categorias_validas:
            return (
                "No hay información suficiente para determinar "
                "tu categoría de mayor gasto."
            )

        principal = max(
            categorias_validas,
            key=lambda categoria: cls._optional_decimal(
                categoria.get("monto")
            ) or Decimal("0"),
        )

        nombre = str(
            principal.get("categoria") or "Sin categoría"
        ).strip()
        monto = cls._optional_decimal(principal.get("monto"))
        porcentaje = cls._optional_decimal(
            principal.get("porcentaje")
        )

        if monto is None:
            return (
                f"Tu categoría de mayor gasto es **{nombre}**."
            )

        respuesta = (
            f"Tu categoría de mayor gasto es **{nombre}**, "
            f"con {cls._format_money(monto)}"
        )

        if porcentaje is not None:
            porcentaje = porcentaje.quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
            respuesta += (
                f", equivalente al {cls._format_percentage(porcentaje, 2)}% "
                "de tus gastos"
            )

        return respuesta + "."

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
                f"{cls._format_percentage(rounded_percentage, 1)}% de tus ingresos."
            )

            if rounded_percentage <= Decimal("20"):
                parts.append(
                    "Se encuentra dentro de un rango saludable."
                )
            elif rounded_percentage <= Decimal("40"):
                parts.append(
                    "Se encuentra en un rango intermedio y está cerca del "
                    "límite superior, por lo que conviene mantenerlo bajo "
                    "seguimiento."
                )
            else:
                parts.append(
                    "Se encuentra en un rango alto y conviene priorizar la "
                    "revisión de las obligaciones mensuales."
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
    def summary(cls, analysis: dict[str, Any]) -> str:
        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}

        income = cls._optional_decimal(metrics.get("ingreso_mensual"))
        expenses = cls._optional_decimal(metrics.get("gasto_mensual_promedio"))
        savings = cls._optional_decimal(metrics.get("ahorro_mensual_estimado"))
        debt_ratio = cls._optional_decimal(metrics.get("ratio_deuda_ingreso"))
        profile = analysis.get("perfil_financiero") or "Sin clasificar"

        if income is None or expenses is None:
            return "No hay información suficiente para generar tu resumen financiero."

        balance = savings if savings is not None else income - expenses
        expense_pct = (expenses / income * Decimal("100")) if income > 0 else Decimal("0")
        debt_pct = (debt_ratio * Decimal("100")) if debt_ratio is not None and debt_ratio <= 1 else debt_ratio

        parts = [
            "**Resumen financiero**",
            f"Ingresos mensuales: {cls._format_money(income)}.",
            f"Gastos mensuales: {cls._format_money(expenses)} ({cls._format_percentage(expense_pct, 0)}% de tus ingresos).",
            f"Balance mensual: {cls._format_money(balance)}.",
        ]
        if debt_pct is not None:
            parts.append(f"Nivel de endeudamiento: {cls._format_percentage(debt_pct, 2)}%.")
        parts.append(f"Perfil financiero: {profile}.")

        if balance < 0:
            parts.append("Tus gastos superan tus ingresos, por lo que actualmente existe un déficit mensual.")
        elif balance == 0:
            parts.append("Tus ingresos cubren tus gastos, pero no queda margen mensual de ahorro.")
        else:
            parts.append(f"Tus gastos no superan tus ingresos: te queda un margen aproximado de {cls._format_money(balance)} al mes.")

        if debt_pct is not None and debt_pct >= Decimal("50"):
            parts.append("El principal factor de riesgo es el nivel de endeudamiento, aunque el balance mensual sea positivo.")

        return "\n\n".join(parts)

    @classmethod
    def full_analysis(cls, analysis: dict[str, Any]) -> str:
        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}

        income = cls._optional_decimal(metrics.get("ingreso_mensual"))
        expenses = cls._optional_decimal(metrics.get("gasto_mensual_promedio"))
        savings = cls._optional_decimal(metrics.get("ahorro_mensual_estimado"))
        debt_ratio = cls._optional_decimal(metrics.get("ratio_deuda_ingreso"))
        profile = analysis.get("perfil_financiero") or "Sin clasificar"
        score = analysis.get("financial_score")

        if income is None or expenses is None:
            return "No hay información suficiente para analizar tu situación financiera actual."

        balance = savings if savings is not None else income - expenses
        expense_pct = (expenses / income * Decimal("100")) if income > 0 else Decimal("0")
        debt_pct = (debt_ratio * Decimal("100")) if debt_ratio is not None and debt_ratio <= 1 else debt_ratio

        lines = [
            "**Resumen**",
            f"Tus ingresos mensuales son {cls._format_money(income)} y tus gastos mensuales son {cls._format_money(expenses)}, equivalentes aproximadamente al {cls._format_percentage(expense_pct, 1)}% de tus ingresos.",
        ]
        if balance >= 0:
            lines.append(f"Esto deja un margen mensual aproximado de {cls._format_money(balance)}; por lo tanto, tus gastos no superan tus ingresos.")
        else:
            lines.append(f"Esto genera un déficit mensual aproximado de {cls._format_money(abs(balance))}.")

        profile_line = f"Tu perfil financiero es **{profile}**"
        if score is not None:
            profile_line += f" y tu puntaje financiero es {score}"
        profile_line += "."
        lines.append(profile_line)

        if debt_pct is not None:
            lines.append(f"Tu nivel de endeudamiento es de aproximadamente {cls._format_percentage(debt_pct, 2)}% de tus ingresos.")

        lines.append("\n**Aspectos a tener en cuenta**")
        if debt_pct is not None and debt_pct >= Decimal("50"):
            lines.append("- La deuda es el factor que más presión ejerce sobre tu perfil financiero y conviene priorizar su reducción.")
        if expense_pct >= Decimal("90"):
            lines.append("- Tus gastos consumen casi todo tu ingreso, por lo que el margen disponible es reducido.")
        elif expense_pct >= Decimal("70"):
            lines.append("- Tus gastos representan una parte alta del ingreso; revisar categorías variables puede ampliar tu margen.")
        if balance > 0:
            lines.append(f"- Conservás un margen positivo de {cls._format_money(balance)} al mes; conviene protegerlo y aumentarlo gradualmente.")

        lines.append("\n**Próximos pasos**")
        lines.append("1. Priorizar las obligaciones de deuda con mayor costo o tasa.")
        lines.append("2. Revisar las categorías de gasto con mayor peso para encontrar ajustes realistas.")
        lines.append("3. Reservar parte del margen mensual para construir un fondo de emergencia.")
        return "\n".join(lines)

    @classmethod
    def remaining_after_expenses(cls, analysis: dict[str, Any]) -> str:
        metrics = analysis.get("metricas") if isinstance(analysis, dict) else {}
        metrics = metrics if isinstance(metrics, dict) else {}
        income = cls._optional_decimal(metrics.get("ingreso_mensual"))
        expenses = cls._optional_decimal(metrics.get("gasto_mensual_promedio"))
        if income is None or expenses is None:
            return "No hay información suficiente para calcular cuánto te queda después de tus gastos."
        balance = income - expenses
        if balance >= 0:
            return f"Después de tus gastos mensuales te quedan aproximadamente {cls._format_money(balance)}."
        return f"Tus gastos superan tus ingresos en aproximadamente {cls._format_money(abs(balance))} por mes."

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
                    f"Tus gastos representan aproximadamente {cls._format_percentage(ratio, 2)}% de "
                    "tus ingresos, por lo que conviene reducir gastos variables "
                    "o recurrentes."
                )

        if income is not None and debt is not None and income > 0:
            ratio = (debt / income * Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            lines.append(
                f"Tu deuda mensual representa aproximadamente {cls._format_percentage(ratio, 2)}% "
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
    def _format_percentage(
        cls,
        value: Any,
        decimals: int = 2,
    ) -> str:
        number = cls._decimal(value)
        quantum = Decimal("1") if decimals == 0 else Decimal("1." + ("0" * decimals))
        rounded = number.quantize(quantum, rounding=ROUND_HALF_UP)
        return f"{rounded:.{decimals}f}".replace(".", ",")

    @classmethod
    def _format_money(cls, value: Any) -> str:
        rounded = cls._decimal(value).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        # Formato visual de FinSightAI: sólo símbolo $, miles con punto y
        # decimales con coma (ej. $3.000,00).
        sign = "-" if rounded < 0 else ""
        absolute = abs(rounded)
        raw = f"{absolute:,.2f}"
        localized = raw.replace(",", "_").replace(".", ",").replace("_", ".")
        return f"{sign}{cls.CURRENCY}{localized}"
