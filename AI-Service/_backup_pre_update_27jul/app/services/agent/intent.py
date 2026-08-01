import re
from enum import StrEnum

from app.services.agent.normalizer import QueryNormalizer
from app.services.agent.schemas import IntentResult, QueryMode


class Intent(StrEnum):
    GREETING = "greeting"
    THANKS = "thanks"
    FAREWELL = "farewell"
    CAPABILITIES = "capabilities"
    PRIVACY_RESTRICTED = "privacy_restricted"
    SECURITY_RESTRICTED = "security_restricted"
    NON_FINANCIAL_CALCULATION = "non_financial_calculation"
    FINANCIAL_CALCULATION = "financial_calculation"
    BUDGET = "budget"
    SUMMARY = "summary"
    INCOME = "income"
    EXPENSES = "expenses"
    DEBT = "debt"
    SAVINGS = "savings"
    SCORE = "score"
    PROFILE = "profile"
    GOALS = "goals"
    RECOMMENDATIONS = "recommendations"
    FULL_ANALYSIS = "full_analysis"
    FINANCIAL_EDUCATION = "financial_education"
    OUT_OF_SCOPE = "out_of_scope"
    UNKNOWN = "unknown"


class IntentDetector:
    """Detecta intención con reglas deterministas sobre texto ya corregido."""

    _MONEY_PATTERN = re.compile(
        r"(?:US\$\s*\d|\$\s*\d|\b(?:usd|dolares?)\s*\d)", re.IGNORECASE
    )
    _MATH_PATTERN = re.compile(
        r"(?:\d\s*[+x×*/÷-]\s*(?:US\$|\$|USD)?\s*\d|\d+(?:[.,]\d+)?\s*%|√\s*\d|raiz cuadrada)",
        re.IGNORECASE,
    )

    _TERMS: tuple[tuple[Intent, set[str]], ...] = (
        (Intent.GREETING, {"hola", "buen dia", "buenas", "buenas tardes", "buenas noches"}),
        (Intent.THANKS, {"gracias", "muchas gracias", "te agradezco"}),
        (Intent.FAREWELL, {"chau", "adios", "hasta luego", "nos vemos"}),
        (Intent.CAPABILITIES, {"que podes hacer", "que puedes hacer", "como me ayudas", "tus funciones"}),
        (Intent.BUDGET, {"presupuesto", "plan de gastos", "distribuir mi sueldo", "organizar mis gastos"}),
        (Intent.SUMMARY, {"resumen", "resumime", "panorama", "vista general"}),
        (Intent.RECOMMENDATIONS, {"recomendacion", "recomendaciones", "consejo", "consejos", "que deberia mejorar", "como mejorar"}),
        (Intent.EXPENSES, {"gasto", "gastos", "consumo", "consumos", "egreso", "egresos", "en que gasto"}),
        (Intent.INCOME, {"ingreso", "ingresos", "sueldo", "salario", "cuanto gano"}),
        (Intent.DEBT, {"deuda", "deudas", "endeudamiento", "prestamo", "credito", "desendeudar", "desendeudarme"}),
        (Intent.SAVINGS, {"ahorro", "ahorros", "ahorrar", "capacidad de ahorro"}),
        (Intent.SCORE, {"financial score", "puntaje financiero", "score financiero", "puntaje"}),
        (Intent.PROFILE, {"perfil financiero", "nivel de riesgo", "riesgo financiero", "perfil"}),
        (Intent.GOALS, {"meta", "metas", "objetivo financiero", "objetivos financieros", "como va mi meta", "cuanto me falta para mi meta"}),
        (Intent.FULL_ANALYSIS, {"analiza mis finanzas", "analisis financiero", "situacion financiera", "como estan mis finanzas", "salud financiera", "balance financiero"}),
    )


    _SAVINGS_ADVICE_TERMS = {
        "como ahorrar",
        "como puedo ahorrar",
        "como hago para ahorrar",
        "que puedo hacer para ahorrar",
        "ayudame a ahorrar",
        "formas de ahorrar",
        "consejos para ahorrar",
        "estrategias para ahorrar",
        "plan para ahorrar",
    }

    _FINANCIAL_CALC_TERMS = {
        "interes", "descuento", "rebaja", "bonificacion", "rendimiento",
        "rentabilidad", "tasa", "impuesto", "iva", "aumento", "incremento", "recargo",
    }
    _FINANCIAL_DOMAIN_TERMS = {
        "finanzas", "financiero", "financiera", "dinero", "presupuesto", "ingreso",
        "gasto", "deuda", "ahorro", "credito", "prestamo", "inversion", "impuesto",
        "salario", "sueldo", "cuota", "interes", "descuento", "precio", "costo",
        "economia", "situacion", "perfil", "riesgo", "resumen", "puntaje", "meta", "objetivo",
    }
    _ANALYTICAL_TERMS = {
        "analiza", "analisis", "explica", "por que", "opina", "opinion",
        "mejorar", "recomienda", "recomendacion", "prioridad", "deberia",
        "resolver", "salir", "reducir", "pagar", "desendeudar", "desendeudarme",
    }

    def detect(self, text: str) -> Intent:
        # API de conveniencia: aplica el mismo pipeline que usa el servicio.
        from app.services.agent.spell_corrector import FinancialSpellCorrector

        normalized = QueryNormalizer.normalize(text)
        query = FinancialSpellCorrector.process(text, normalized)
        return self.detect_result(query.corrected).intent

    def detect_result(self, text: str) -> IntentResult:
        normalized = QueryNormalizer.normalize(text)
        if not normalized:
            return IntentResult(Intent.UNKNOWN)

        has_money = self.has_monetary_amount(text)
        has_math = bool(self._MATH_PATTERN.search(text))
        has_financial_calculation = self._contains_any(normalized, self._FINANCIAL_CALC_TERMS)

        if has_math or has_financial_calculation:
            if has_money and (has_financial_calculation or "%" in text):
                return IntentResult(Intent.FINANCIAL_CALCULATION)
            if has_math:
                return IntentResult(Intent.NON_FINANCIAL_CALCULATION)

        if self._is_financial_education(normalized):
            return IntentResult(Intent.FINANCIAL_EDUCATION)

        # "Cómo ahorrar" solicita orientación; "cuánto ahorro" solicita un monto.
        # Esta regla debe evaluarse antes de la coincidencia genérica con "ahorrar".
        savings_advice = tuple(
            term
            for term in self._SAVINGS_ADVICE_TERMS
            if self._contains_term(normalized, term)
        )
        if savings_advice:
            return IntentResult(
                intent=Intent.RECOMMENDATIONS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=savings_advice,
            )

        for intent, terms in self._TERMS:
            matched = tuple(term for term in terms if self._contains_term(normalized, term))
            if matched:
                mode = (
                    QueryMode.ANALYTICAL
                    if intent in {Intent.INCOME, Intent.EXPENSES, Intent.DEBT, Intent.SAVINGS, Intent.SCORE, Intent.PROFILE}
                    and self._contains_any(normalized, self._ANALYTICAL_TERMS)
                    else QueryMode.DIRECT
                )
                return IntentResult(intent=intent, mode=mode, matched_terms=matched)

        if self._contains_any(normalized, self._FINANCIAL_DOMAIN_TERMS):
            return IntentResult(Intent.UNKNOWN)
        return IntentResult(Intent.OUT_OF_SCOPE)

    def _is_financial_education(self, normalized: str) -> bool:
        starters = {"que es", "que significa", "explicame", "como funciona", "para que sirve", "cual es la diferencia"}
        return self._contains_any(normalized, starters) and self._contains_any(normalized, self._FINANCIAL_DOMAIN_TERMS)

    @classmethod
    def has_monetary_amount(cls, question: str) -> bool:
        return bool(cls._MONEY_PATTERN.search(question))

    @staticmethod
    def normalize(text: str) -> str:
        return QueryNormalizer.normalize(text)

    @classmethod
    def _contains_any(cls, question: str, terms: set[str]) -> bool:
        return any(cls._contains_term(question, term) for term in terms)

    @staticmethod
    def _contains_term(question: str, term: str) -> bool:
        return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", question) is not None
