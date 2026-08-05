from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


@dataclass(frozen=True)
class RecommendationContext:
    profile: str
    diagnosis: str
    action: str
    objective: str


class RecommendationAdvisor:
    """Construye continuaciones determinísticas y específicas para recomendaciones.

    No usa el LLM: trabaja únicamente con los campos verificados que llegan desde
    la tarjeta de recomendaciones.
    """

    _PERCENT_WORD_PATTERN = re.compile(
        r"(?P<value>-?\d+(?:[.,]\d+)?)\s+por\s+ciento",
        re.IGNORECASE,
    )
    _USD_PATTERN = re.compile(
        r"\bUSD\s*(?P<amount>\d[\d.,]*)",
        re.IGNORECASE,
    )
    _MONEY_PATTERN = re.compile(
        r"\$(?P<amount>\d[\d.,]*)",
        re.IGNORECASE,
    )
    _PERCENT_PATTERN = re.compile(r"-?\d+(?:[.,]\d+)?\s*%")

    @classmethod
    def build(cls, fields: dict[str, str]) -> str:
        context = RecommendationContext(
            profile=cls._normalize_profile(fields.get("perfil financiero")),
            diagnosis=cls._clean_text(
                fields.get("diagnostico"),
                "La recomendación se generó a partir de tus datos financieros actuales.",
            ),
            action=cls._clean_text(
                fields.get("accion sugerida"),
                "Revisar el factor principal señalado por el análisis.",
            ),
            objective=cls._clean_text(
                fields.get("objetivo"),
                "Mejorar gradualmente tu margen financiero.",
            ),
        )

        recommendation_type = cls._detect_type(context)
        builders = {
            "savings_negative": cls._build_negative_savings,
            "savings_low": cls._build_low_savings,
            "savings_strong": cls._build_strong_savings,
            "debt": cls._build_debt,
            "emergency_fund": cls._build_emergency_fund,
            "high_expenses": cls._build_high_expenses,
            "expense_optimization": cls._build_expense_optimization,
            "risk_profile": cls._build_risk_profile,
        }
        builder = builders.get(recommendation_type, cls._build_general)
        return builder(context)

    @classmethod
    def _detect_type(cls, context: RecommendationContext) -> str:
        text = " ".join((context.diagnosis, context.action, context.objective)).lower()
        savings_percent = cls._extract_named_percent(context.diagnosis, "ahorro")

        if "deuda" in text or "endeudamiento" in text or "obligaciones mensuales" in text:
            return "debt"
        # La capacidad de ahorro define el tipo principal aunque el objetivo
        # mencione un fondo de emergencia. Esto evita usar una plantilla
        # genérica de emergencia para perfiles con ahorro alto o negativo.
        if "capacidad de ahorro" in text or "frecuencia de ahorro" in text or "ahorro mensual" in text:
            if savings_percent is not None and savings_percent < 0:
                return "savings_negative"
            if savings_percent is not None and savings_percent >= 20:
                return "savings_strong"
            return "savings_low"
        if "fondo de emergencia" in text or "meses de gastos esenciales" in text:
            return "emergency_fund"
        if "categoría de mayor consumo" in text or "categoria de mayor consumo" in text:
            return "high_expenses"
        if "mayor concentración" in text or "mayor concentracion" in text:
            return "expense_optimization"
        if "gastos representan" in text or "gastos utilizan" in text:
            expense_percent = cls._first_percent(context.diagnosis)
            return "high_expenses" if expense_percent is not None and expense_percent >= 80 else "expense_optimization"
        if context.profile == "en riesgo":
            return "risk_profile"
        return "general"

    @classmethod
    def _build_high_expenses(cls, context: RecommendationContext) -> str:
        category = cls._extract_category(context.diagnosis)
        category_detail = (
            f" La categoría {category} concentra el mayor consumo, por lo que un ajuste allí puede tener más impacto que varios recortes pequeños."
            if category
            else ""
        )
        return cls._join(
            cls._profile_intro(context.profile),
            f"Esta recomendación se generó porque {cls._lower_first(context.diagnosis)}{category_detail}",
            f"Como primer paso, te recomiendo {cls._lower_first(context.action)}",
            f"La meta es {cls._lower_first(context.objective)}",
            "Podés empezar separando los gastos esenciales de los ajustables y comparando escenarios de reducción gradual antes de hacer cambios.",
            cls._professional_close("presupuesto"),
        )

    @classmethod
    def _build_expense_optimization(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"El análisis muestra que {cls._lower_first(context.diagnosis)}",
            f"Como siguiente paso, te recomiendo {cls._lower_first(context.action)}",
            f"El objetivo es {cls._lower_first(context.objective)}",
            "La idea no es recortar necesidades básicas, sino encontrar ajustes sostenibles que mejoren tu margen para ahorro e imprevistos.",
            cls._professional_close("presupuesto"),
        )

    @classmethod
    def _build_negative_savings(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Actualmente, {cls._lower_first(context.diagnosis)} Esto indica que tus gastos y obligaciones están superando el margen disponible.",
            "Antes de automatizar el ahorro, la prioridad debería ser recuperar un balance mensual positivo: revisar gastos ajustables, evitar nuevas obligaciones y evaluar oportunidades realistas para mejorar los ingresos.",
            f"Una vez recuperado ese margen, la meta será {cls._lower_first(context.objective)}",
            cls._professional_close("plan de recuperación financiera"),
        )

    @classmethod
    def _build_low_savings(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Esta recomendación se generó porque {cls._lower_first(context.diagnosis)}",
            f"Como primer paso, te recomiendo {cls._lower_first(context.action)}",
            f"El objetivo es {cls._lower_first(context.objective)}",
            "Conviene avanzar en incrementos pequeños y sostenibles para no desordenar el presupuesto ni volver la meta difícil de mantener.",
            cls._professional_close("plan de ahorro"),
        )

    @classmethod
    def _build_strong_savings(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Tu situación muestra una capacidad de ahorro sólida: {cls._lower_first(context.diagnosis)}",
            "En este escenario, la prioridad ya no es solamente ahorrar más, sino organizar el ahorro según su propósito.",
            f"Te recomiendo {cls._lower_first(context.action)}",
            f"La meta es {cls._lower_first(context.objective)}",
            "Separar el fondo de emergencia de las metas de mediano y largo plazo ayuda a evitar que un imprevisto desarme otros objetivos.",
            cls._professional_close("estrategia de ahorro o inversión"),
        )

    @classmethod
    def _build_debt(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Esta recomendación se generó porque {cls._lower_first(context.diagnosis)}",
            f"La prioridad es {cls._lower_first(context.action)}",
            f"El objetivo es {cls._lower_first(context.objective)}",
            "Antes de refinanciar, cancelar anticipadamente o asumir nuevas obligaciones, conviene comparar tasas, costos totales y plazos.",
            cls._professional_close("plan de reducción de deuda"),
        )

    @classmethod
    def _build_emergency_fund(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Esta recomendación busca fortalecer tu capacidad para afrontar imprevistos. {context.diagnosis}",
            f"Como siguiente paso, te recomiendo {cls._lower_first(context.action)}",
            f"La meta es {cls._lower_first(context.objective)}",
            "Podés construirla de forma gradual, manteniéndola separada del dinero destinado a gastos cotidianos u otras metas.",
            cls._professional_close("fondo de emergencia"),
        )

    @classmethod
    def _build_risk_profile(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"El análisis indica que {cls._lower_first(context.diagnosis)}",
            f"La primera acción recomendada es {cls._lower_first(context.action)}",
            f"La meta inicial es {cls._lower_first(context.objective)}",
            "Mientras recuperás estabilidad, conviene priorizar liquidez, obligaciones esenciales y evitar compromisos financieros nuevos.",
            cls._professional_close("plan de estabilización"),
        )

    @classmethod
    def _build_general(cls, context: RecommendationContext) -> str:
        return cls._join(
            cls._profile_intro(context.profile),
            f"Esta recomendación se generó porque {cls._lower_first(context.diagnosis)}",
            f"Como siguiente paso, te recomiendo {cls._lower_first(context.action)}",
            f"La meta es {cls._lower_first(context.objective)}",
            cls._professional_close("plan financiero"),
        )

    @staticmethod
    def _profile_intro(profile: str) -> str:
        if profile == "saludable":
            return "Analicemos esta recomendación. Actualmente tu perfil financiero es saludable."
        if profile == "en observación":
            return "Analicemos esta recomendación. Actualmente tu perfil financiero se encuentra en observación."
        if profile == "en riesgo":
            return "Analicemos esta recomendación. Actualmente tu perfil financiero se encuentra en riesgo."
        return "Analicemos esta recomendación a partir de tus datos financieros actuales."

    @staticmethod
    def _professional_close(topic: str) -> str:
        return (
            f"Esta orientación se basa en los datos registrados en FinSightAI. "
            f"Para definir un {topic} adaptado a tu situación y antes de tomar decisiones financieras importantes, "
            "es recomendable consultar con un asesor financiero."
        )

    @classmethod
    def _clean_text(cls, value: str | None, fallback: str) -> str:
        text = (value or fallback).strip()
        text = cls._PERCENT_WORD_PATTERN.sub(lambda match: f"{cls._normalize_decimal(match.group('value'))}%", text)
        text = cls._USD_PATTERN.sub(lambda match: f"${cls._format_money(match.group('amount'))}", text)
        text = cls._MONEY_PATTERN.sub(lambda match: f"${cls._format_money(match.group('amount'))}", text)
        text = re.sub(r"\s+([.,;:])", r"\1", text)
        text = re.sub(r"\.{2,}", ".", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text.rstrip(". ") + "."

    @staticmethod
    def _normalize_profile(value: str | None) -> str:
        profile = (value or "").strip().rstrip(". ").lower()
        aliases = {
            "saludable": "saludable",
            "en observacion": "en observación",
            "en observación": "en observación",
            "en riesgo": "en riesgo",
        }
        return aliases.get(profile, profile or "")

    @classmethod
    def _format_money(cls, raw: str) -> str:
        cleaned = raw.strip().replace(" ", "")
        try:
            if "," in cleaned and "." in cleaned:
                # El último separador se considera decimal; el otro, de miles.
                if cleaned.rfind(".") > cleaned.rfind(","):
                    numeric = cleaned.replace(",", "")
                else:
                    numeric = cleaned.replace(".", "").replace(",", ".")
            elif "," in cleaned:
                parts = cleaned.split(",")
                numeric = cleaned.replace(",", ".") if len(parts[-1]) <= 2 else cleaned.replace(",", "")
            else:
                numeric = cleaned
            value = Decimal(numeric).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return f"{value:,.2f}"
        except (InvalidOperation, ValueError):
            return cleaned

    @staticmethod
    def _normalize_decimal(raw: str) -> str:
        return raw.replace(",", ".")

    @classmethod
    def _first_percent(cls, text: str) -> float | None:
        match = cls._PERCENT_PATTERN.search(text)
        if not match:
            return None
        try:
            return float(match.group(0).replace("%", "").replace(",", ".").strip())
        except ValueError:
            return None

    @classmethod
    def _extract_named_percent(cls, text: str, keyword: str) -> float | None:
        if keyword.lower() not in text.lower():
            return None
        return cls._first_percent(text)

    @staticmethod
    def _extract_category(diagnosis: str) -> str | None:
        patterns = (
            r"\.\s*([^.,]+?)\s+es la categoría de mayor consumo",
            r"\.\s*([^.,]+?)\s+es la categoria de mayor consumo",
            r"mayor concentración está en\s+([^.,]+)",
            r"mayor concentracion esta en\s+([^.,]+)",
        )
        for pattern in patterns:
            match = re.search(pattern, diagnosis, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    @staticmethod
    def _lower_first(text: str) -> str:
        cleaned = text.strip().rstrip(". ")
        return cleaned[:1].lower() + cleaned[1:] + "." if cleaned else cleaned

    @staticmethod
    def _join(*parts: str) -> str:
        cleaned = [part.strip() for part in parts if part and part.strip()]
        return "\n\n".join(cleaned)
