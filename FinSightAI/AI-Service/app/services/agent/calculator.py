import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from difflib import SequenceMatcher


@dataclass(frozen=True)
class CalculationResult:
    message: str
    completed: bool


@dataclass(frozen=True)
class MoneyAmount:
    value: Decimal
    display_prefix: str


class FinancialCalculator:
    """Resuelve cálculos financieros simples sin enviar datos al LLM."""

    _AMOUNT_PATTERN = re.compile(
        r"(?P<prefix>US\$|\$|USD)\s*(?P<amount>\d+(?:[.,]\d+)?)",
        re.IGNORECASE,
    )
    _PERCENT_PATTERN = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")

    _DISCOUNT_TERMS = {"descuento", "rebaja", "bonificacion"}
    _INTEREST_TERMS = {"interes", "tasa", "rendimiento", "rentabilidad"}
    _TAX_TERMS = {"iva", "impuesto"}
    _INCREASE_TERMS = {"aumento", "incremento", "recargo"}

    @classmethod
    def calculate(cls, question: str) -> CalculationResult:
        money = cls._extract_money(question)
        if money is None:
            return CalculationResult(
                "Para realizar un cálculo financiero necesito que incluyas un monto monetario, por ejemplo USD 500 o $500.",
                False,
            )

        normalized = cls._normalize(question)
        percent = cls._extract_percent(question)

        if cls._contains_any(normalized, cls._DISCOUNT_TERMS):
            if percent is None:
                return CalculationResult(
                    f"Indicá también el porcentaje de descuento que querés aplicar sobre {cls._format_money(money)}.",
                    False,
                )
            discount = money.value * percent / Decimal("100")
            final = money.value - discount
            return CalculationResult(
                f"El descuento es {cls._format_value(discount, money.display_prefix)} y el precio final queda en {cls._format_value(final, money.display_prefix)}.",
                True,
            )

        if cls._contains_any(normalized, cls._INTEREST_TERMS):
            if percent is None:
                return CalculationResult(
                    "Indicá la tasa de interés y el período para poder calcularla sobre el monto monetario.",
                    False,
                )
            interest = money.value * percent / Decimal("100")
            total = money.value + interest
            return CalculationResult(
                f"Aplicando una tasa del {cls._format_percent(percent)} sobre {cls._format_money(money)}, el interés es {cls._format_value(interest, money.display_prefix)} y el total es {cls._format_value(total, money.display_prefix)}. Esto asume un único período y sin capitalización.",
                True,
            )

        if cls._contains_any(normalized, cls._TAX_TERMS):
            if percent is None:
                return CalculationResult(
                    f"Indicá el porcentaje del impuesto que querés aplicar sobre {cls._format_money(money)}.",
                    False,
                )
            tax = money.value * percent / Decimal("100")
            total = money.value + tax
            return CalculationResult(
                f"El impuesto es {cls._format_value(tax, money.display_prefix)} y el total queda en {cls._format_value(total, money.display_prefix)}.",
                True,
            )

        if cls._contains_any(normalized, cls._INCREASE_TERMS):
            if percent is None:
                return CalculationResult(
                    f"Indicá el porcentaje de aumento que querés aplicar sobre {cls._format_money(money)}.",
                    False,
                )
            increase = money.value * percent / Decimal("100")
            total = money.value + increase
            return CalculationResult(
                f"El aumento es {cls._format_value(increase, money.display_prefix)} y el total queda en {cls._format_value(total, money.display_prefix)}.",
                True,
            )

        if percent is not None:
            result = money.value * percent / Decimal("100")
            return CalculationResult(
                f"El {cls._format_percent(percent)} de {cls._format_money(money)} es {cls._format_value(result, money.display_prefix)}.",
                True,
            )

        return CalculationResult(
            "La consulta incluye un monto, pero falta indicar qué cálculo financiero querés realizar.",
            False,
        )

    @classmethod
    def _extract_money(cls, question: str) -> MoneyAmount | None:
        match = cls._AMOUNT_PATTERN.search(question)
        if match is None:
            return None

        prefix = match.group("prefix")
        display_prefix = "$" if "$" in prefix else "USD "
        return MoneyAmount(
            value=cls._number(match.group("amount")),
            display_prefix=display_prefix,
        )

    @classmethod
    def _extract_percent(cls, question: str) -> Decimal | None:
        match = cls._PERCENT_PATTERN.search(question)
        return cls._number(match.group(1)) if match else None

    @staticmethod
    def _number(value: str) -> Decimal:
        try:
            return Decimal(value.replace(",", "."))
        except InvalidOperation as error:
            raise ValueError("El monto o porcentaje indicado no es válido.") from error

    @classmethod
    def _format_money(cls, money: MoneyAmount) -> str:
        return cls._format_value(money.value, money.display_prefix)

    @staticmethod
    def _format_value(value: Decimal, prefix: str) -> str:
        rounded = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return f"{prefix}{rounded:.2f}"

    @staticmethod
    def _format_percent(value: Decimal) -> str:
        normalized = value.normalize()
        return f"{normalized:f}%"

    @staticmethod
    def _normalize(text: str) -> str:
        normalized = unicodedata.normalize("NFD", text.lower())
        return "".join(
            character
            for character in normalized
            if unicodedata.category(character) != "Mn"
        )

    @classmethod
    def _contains_any(cls, question: str, terms: set[str]) -> bool:
        if any(re.search(rf"(?<!\w){re.escape(term)}(?!\w)", question) for term in terms):
            return True

        words = [word for word in re.findall(r"\w+", question) if len(word) >= 5]
        return any(
            abs(len(word) - len(term)) <= 2
            and SequenceMatcher(None, word, term).ratio() >= 0.78
            for word in words
            for term in terms
            if len(term) >= 5
        )
