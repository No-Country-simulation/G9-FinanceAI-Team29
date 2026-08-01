import re
from difflib import SequenceMatcher

from app.services.agent.schemas import NormalizedQuery


class FinancialSpellCorrector:
    """Corrige únicamente errores claros contra un vocabulario financiero cerrado."""

    KNOWN_FINANCIAL_TERMS = frozenset({
        "resumen", "resumime", "presupuesto", "ingreso", "ingresos",
        "gasto", "gastos", "ahorro", "ahorros", "ahorrar", "deuda",
        "deudas", "endeudamiento", "perfil", "puntaje", "recomendacion",
        "recomendaciones", "finanzas", "financiero", "financiera", "analisis",
        "situacion", "capacidad", "descuento", "interes", "impuesto",
        "aumento", "rendimiento", "rentabilidad", "prestamo", "credito",
    })

    # Palabras válidas frecuentes que pueden parecerse a términos financieros.
    PROTECTED_WORDS = frozenset({
        "ahora", "estado", "precio", "costo", "capital", "salario", "sueldo",
        "cuota", "riesgo", "balance", "dinero", "economia", "mensual",
    }) | KNOWN_FINANCIAL_TERMS

    _TOKEN_PATTERN = re.compile(r"\b[^\W\d_]+\b", re.UNICODE)

    @classmethod
    def process(cls, original: str, normalized: str) -> NormalizedQuery:
        corrections: list[tuple[str, str]] = []

        def replace(match: re.Match[str]) -> str:
            word = match.group(0)
            replacement = cls._correct_word(word)
            if replacement != word:
                corrections.append((word, replacement))
            return replacement

        corrected = cls._TOKEN_PATTERN.sub(replace, normalized)
        return NormalizedQuery(
            original=original,
            normalized=normalized,
            corrected=corrected,
            corrections=tuple(corrections),
        )

    @classmethod
    def _correct_word(cls, word: str) -> str:
        if len(word) < 5 or word in cls.PROTECTED_WORDS:
            return word
        if any(character.isdigit() for character in word):
            return word

        candidates = sorted(
            (
                (term, SequenceMatcher(None, word, term).ratio())
                for term in cls.KNOWN_FINANCIAL_TERMS
                if abs(len(word) - len(term)) <= 2
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        if not candidates:
            return word

        best_term, best_score = candidates[0]
        second_score = candidates[1][1] if len(candidates) > 1 else 0.0
        minimum_score = cls._required_similarity(word)

        clear_margin = best_score - second_score >= 0.08
        same_word_family = (
            len(candidates) > 1
            and cls._same_word_family(best_term, candidates[1][0])
        )
        if best_score >= minimum_score and (clear_margin or same_word_family):
            return best_term
        return word

    @staticmethod
    def _same_word_family(left: str, right: str) -> bool:
        return left.rstrip("s") == right.rstrip("s")

    @staticmethod
    def _required_similarity(word: str) -> float:
        if len(word) <= 5:
            return 0.88
        if len(word) <= 7:
            return 0.84
        return 0.80
