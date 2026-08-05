import re
from enum import StrEnum

from app.services.agent.normalizer import QueryNormalizer
from app.services.agent.schemas import IntentResult, QueryMode


class Intent(StrEnum):
    GREETING = "greeting"
    THANKS = "thanks"
    FAREWELL = "farewell"
    CAPABILITIES = "capabilities"
    CREATOR_INFO = "creator_info"
    PRIVACY_RESTRICTED = "privacy_restricted"
    SECURITY_RESTRICTED = "security_restricted"
    NON_FINANCIAL_CALCULATION = "non_financial_calculation"
    FINANCIAL_CALCULATION = "financial_calculation"
    BUDGET = "budget"
    SUMMARY = "summary"
    INCOME = "income"
    EXPENSES = "expenses"
    RECENT_EXPENSES = "recent_expenses"
    HIGHEST_EXPENSE_DAY = "highest_expense_day"
    LARGEST_EXPENSE = "largest_expense"
    TOP_EXPENSE_CATEGORY = "top_expense_category"
    HIGHEST_EXPENSE_MONTH = "highest_expense_month"
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
        (Intent.GREETING, {"hola", "holi", "buen dia", "buenas", "buenas tardes", "buenas noches"}),
        (Intent.THANKS, {"gracias", "muchas gracias", "te agradezco"}),
        (Intent.FAREWELL, {"chau", "adios", "hasta luego", "nos vemos"}),
        (Intent.CAPABILITIES, {"que podes hacer", "que puedes hacer", "como me ayudas", "tus funciones"}),
        (Intent.BUDGET, {"presupuesto", "plan de gastos", "distribuir mi sueldo", "organizar mis gastos"}),
        (Intent.SUMMARY, {"resumen", "resumime", "panorama", "vista general"}),
        (Intent.RECOMMENDATIONS, {"recomendacion", "recomendaciones", "consejo", "consejos", "que deberia mejorar", "como mejorar"}),
        (Intent.EXPENSES, {"gasto", "gastos", "consumo", "consumos", "egreso", "egresos", "en que gasto", "donde gasto", "donde estoy gastando", "categoria con mas gastos", "mayor gasto"}),
        (Intent.INCOME, {"ingreso", "ingresos", "sueldo", "salario", "cuanto gano", "cuanto dinero me ingreso", "cuanto dinero me entro", "me depositaron dinero", "me acreditaron dinero"}),
        (Intent.DEBT, {"deuda", "deudas", "endeudamiento", "prestamo", "credito", "desendeudar", "desendeudarme"}),
        (Intent.SAVINGS, {"ahorro", "ahorros", "ahorrar", "capacidad de ahorro"}),
        (Intent.SCORE, {"financial score", "puntaje financiero", "score financiero", "puntaje"}),
        (Intent.PROFILE, {"perfil financiero", "nivel de riesgo", "riesgo financiero", "perfil"}),
        (Intent.GOALS, {"meta", "metas", "objetivo financiero", "objetivos financieros", "como va mi meta", "cuanto me falta para mi meta"}),
        (Intent.FULL_ANALYSIS, {"analiza mis finanzas", "analisis financiero", "situacion financiera", "como estan mis finanzas", "salud financiera", "balance financiero"}),
    )


    _INCOME_ADVICE_TERMS = {
        "como aumentar mis ingresos",
        "como puedo aumentar mis ingresos",
        "como mejorar mis ingresos",
        "como puedo mejorar mis ingresos",
        "como generar mas ingresos",
        "como puedo generar mas ingresos",
        "generar mas ingresos",
        "generar ingresos extra",
        "generar un ingreso extra",
        "conseguir ingresos extra",
        "tener ingresos extra",
        "aumentar mis ingresos",
        "mejorar mis ingresos",
        "subir mis ingresos",
        "incrementar mis ingresos",
        "como ganar mas",
        "como puedo ganar mas",
        "como ganar mas dinero",
        "como puedo ganar mas dinero",
        "como ganar mas plata",
        "como puedo ganar mas plata",
        "quiero ganar mas",
        "quiero ganar mas dinero",
        "quiero ganar mas plata",
        "necesito ganar mas",
        "necesito ganar mas dinero",
        "necesito ganar mas plata",
        "formas de aumentar mis ingresos",
        "ideas para aumentar mis ingresos",
        "ideas para ganar mas",
        "ideas para ganar dinero",
        "ideas para generar ingresos",
        "necesito aumentar mis ingresos",
        "necesito generar mas ingresos",
        "que puedo hacer para ganar mas",
        "que puedo hacer para aumentar mis ingresos",
        "como consigo otro ingreso",
        "como consigo un ingreso extra",
        "como hago plata extra",
        "como hacer dinero extra",
        "como mejorar mi sueldo",
        "como aumentar mi sueldo",
        "como complementar mi sueldo",
        "quiero un ingreso adicional",
        "necesito un ingreso adicional",
    }

    _EXPENSE_REDUCTION_TERMS = {
        "como reducir mis gastos",
        "como puedo reducir mis gastos",
        "como bajar mis gastos",
        "como puedo bajar mis gastos",
        "como disminuir mis gastos",
        "como puedo disminuir mis gastos",
        "como recortar mis gastos",
        "como puedo recortar mis gastos",
        "como gastar menos",
        "como puedo gastar menos",
        "quiero gastar menos",
        "necesito gastar menos",
        "reducir gastos",
        "bajar gastos",
        "disminuir gastos",
        "recortar gastos",
        "reducir mis consumos",
        "bajar mis consumos",
        "como reducir mis consumos",
        "como controlar mis gastos",
        "como puedo controlar mis gastos",
        "como ordenar mis gastos",
        "como ajustar mis gastos",
        "como puedo ajustar mis gastos",
        "como ahorrar en gastos",
        "donde puedo recortar gastos",
        "en que puedo gastar menos",
        "que gastos puedo reducir",
        "que gastos deberia reducir",
        "ayudame a bajar mis gastos",
        "ayudame a reducir mis gastos",
        "quiero bajar mis gastos",
        "necesito bajar mis gastos",
        "mis gastos son muy altos",
        "estoy gastando demasiado",
        "gasto demasiado",
        "se me va mucha plata",
        "como evitar gastos innecesarios",
        "como dejar de gastar tanto",
        "como cuidar mejor mi dinero",
    }

    _DEBT_ADVICE_TERMS = {
        "como salir de deudas",
        "como puedo salir de deudas",
        "como salir de mi deuda",
        "como puedo salir de mi deuda",
        "quiero salir de deudas",
        "necesito salir de deudas",
        "ayudame a salir de deudas",
        "como pagar mis deudas",
        "como puedo pagar mis deudas",
        "como pagar mi deuda",
        "como puedo pagar mi deuda",
        "quiero pagar mi deuda",
        "quiero pagar mis deudas",
        "necesito pagar mi deuda",
        "necesito pagar mis deudas",
        "ayudame a pagar mi deuda",
        "ayudame a pagar mis deudas",
        "como reducir mis deudas",
        "como puedo reducir mis deudas",
        "como reducir mi deuda",
        "como puedo reducir mi deuda",
        "como bajar mi deuda",
        "como bajar mis deudas",
        "como puedo bajar mi deuda",
        "como puedo bajar mis deudas",
        "como saldar mi deuda",
        "como puedo saldar mi deuda",
        "como saldar mis deudas",
        "como puedo saldar mis deudas",
        "saldar mi deuda",
        "saldar mis deudas",
        "quiero saldar mi deuda",
        "quiero saldar mis deudas",
        "necesito saldar mi deuda",
        "necesito saldar mis deudas",
        "ayudame a saldar mi deuda",
        "ayudame a saldar mis deudas",
        "como liquidar mi deuda",
        "como puedo liquidar mi deuda",
        "como liquidar mis deudas",
        "como puedo liquidar mis deudas",
        "quiero liquidar mi deuda",
        "quiero liquidar mis deudas",
        "como cancelar mi deuda",
        "como puedo cancelar mi deuda",
        "como cancelar mis deudas",
        "como puedo cancelar mis deudas",
        "quiero cancelar mi deuda",
        "quiero cancelar mis deudas",
        "como terminar de pagar mi deuda",
        "como terminar de pagar mis deudas",
        "como desendeudarme",
        "que hago para desendeudarme",
        "necesito desendeudarme",
        "plan para pagar deudas",
        "plan para pagar mi deuda",
        "plan para salir de deudas",
        "estrategia para pagar deudas",
        "estrategia para salir de deudas",
        "por donde empiezo a pagar mis deudas",
        "que deuda pago primero",
        "cual deuda pago primero",
        "como organizar el pago de mis deudas",
        "como priorizar mis deudas",
    }

    _EXPENSE_ANALYSIS_TERMS = {
        "donde estoy gastando mas",
        "donde gasto mas",
        "en que gasto mas",
        "en que estoy gastando mas",
        "en que categoria gasto mas",
        "cual es mi mayor gasto",
        "categoria con mas gastos",
        "donde se va mi dinero",
        "donde se me va la plata",
        "donde se me va el dinero",
        "en que se me va el dinero",
        "en que se me esta yendo el dinero",
    }

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
        "quiero ahorrar",
        "quiero empezar a ahorrar",
        "necesito ahorrar",
        "necesito empezar a ahorrar",
        "como empiezo a ahorrar",
        "como puedo empezar a ahorrar",
        "como comenzar a ahorrar",
        "como juntar plata",
        "como puedo juntar plata",
        "quiero juntar plata",
        "necesito juntar plata",
        "como guardar dinero",
        "como puedo guardar dinero",
        "como guardar plata",
        "como puedo guardar plata",
        "como crear un fondo de emergencia",
        "como armar un fondo de emergencia",
        "quiero crear un fondo de emergencia",
        "necesito un fondo de emergencia",
        "como ahorrar todos los meses",
        "como ahorrar cada mes",
        "cuanto deberia ahorrar",
        "que porcentaje deberia ahorrar",
        "como separar plata para ahorrar",
        "como evitar gastar mis ahorros",
        "como cumplir mi meta de ahorro",
        "como mejorar mi capacidad de ahorro",
        "quiero mejorar mi capacidad de ahorro",
    }

    _CREATOR_TERMS = {
        "quien te creo",
        "quienes te crearon",
        "quien te programo",
        "quienes te programaron",
        "quien te desarrollo",
        "quienes te desarrollaron",
        "quien hizo finsight",
        "quien hizo finsightai",
        "quien creo finsight",
        "quien creo finsightai",
        "quien hizo esta aplicacion",
        "quien creo esta aplicacion",
    }


    _HIGHEST_EXPENSE_DAY_TERMS = {
        "que dia tuve mas gastos",
        "que dia gaste mas",
        "cual fue el dia que mas gaste",
        "cual fue el dia con mas gastos",
        "dia que mas gaste",
        "dia con mas gastos",
        "fecha con mas gastos",
        "cuando gaste mas",
        "en que dia gaste mas",
    }

    _LARGEST_EXPENSE_TERMS = {
        "cual fue mi gasto mas grande",
        "cual fue mi mayor gasto",
        "gasto mas grande",
        "mayor gasto individual",
        "compra mas cara",
        "mayor compra",
        "transaccion mas alta",
        "egreso mas grande",
    }

    _TOP_EXPENSE_CATEGORY_TERMS = {
        "cual es la categoria con mas gastos",
        "categoria con mas gastos",
        "en que categoria gasto mas",
        "categoria donde mas gasto",
    }

    _HIGHEST_EXPENSE_MONTH_TERMS = {
        "que mes gaste mas",
        "cual fue el mes que mas gaste",
        "mes con mas gastos",
        "mes donde mas gaste",
        "en que mes gaste mas",
    }

    _RECENT_EXPENSE_TERMS = {
        "ultimos gastos",
        "gastos recientes",
        "ultimas compras",
        "compras recientes",
        "ultimos movimientos",
        "movimientos recientes",
        "ultimas transacciones",
        "transacciones recientes",
        "que compre recientemente",
        "que gaste recientemente",
        "mostrame mis ultimos gastos",
        "mostrar mis ultimos gastos",
    }

    _FINANCIAL_CALC_TERMS = {
        "interes", "descuento", "rebaja", "bonificacion", "rendimiento",
        "rentabilidad", "tasa", "impuesto", "iva", "aumento", "incremento", "recargo", "pbi",
    }

    _FINANCIAL_DOMAIN_TERMS = {
        "finanzas", "financiero", "financiera", "dinero", "presupuesto", "ingreso",
        "gasto", "deuda", "ahorro", "credito", "prestamo", "inversion", "impuesto",
        "salario", "sueldo", "cuota", "interes", "descuento", "precio", "costo",
        "economia", "situacion", "perfil", "riesgo", "resumen", "puntaje", "meta",
        "objetivo",
        "ipc", "inflacion", "deflacion",
        "pbi", "pib", "producto bruto interno", "producto interno bruto",
        "recesion", "estanflacion", "tipo de cambio", "devaluacion",
        "accion", "acciones", "bono", "bonos",
        "cedear", "cedears", "etf",
        "plazo fijo", "fondo comun", "fondo comun de inversion",
        "diversificacion",
        "tna", "tea", "cft",
        "interes simple", "interes compuesto",
        "activo", "pasivo", "patrimonio", "liquidez",
        "flujo de caja", "fondo de emergencia",
        "tarjeta de credito", "tarjeta de debito",
        "cbu", "cvu", "alias",
        "iva", "ganancias", "bienes personales",
    }

    _OUT_OF_SCOPE_TERMS = {
        "mundial", "futbol", "partido", "clima", "temperatura", "receta",
        "pelicula", "serie", "videojuego", "noticias", "presidente",
    }

    _ANALYTICAL_TERMS = {
        "analiza", "analisis", "explica", "por que", "opina", "opinion",
        "mejorar", "recomienda", "recomendacion", "prioridad", "deberia",
        "resolver", "salir", "reducir", "pagar", "saldar", "liquidar", "cancelar",
        "desendeudar", "desendeudarme", "recortar", "disminuir", "controlar",
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

        if (
            re.search(r"(?<!\w)hol+a+(?!\w)", normalized)
            and not self._contains_any(normalized, self._FINANCIAL_DOMAIN_TERMS)
        ):
            return IntentResult(Intent.GREETING, matched_terms=("hola",))

        has_money = self.has_monetary_amount(text)
        has_math = bool(self._MATH_PATTERN.search(text))
        has_financial_calculation = self._contains_any(normalized, self._FINANCIAL_CALC_TERMS)

        if has_math or has_financial_calculation:
            if has_money and (has_financial_calculation or "%" in text):
                return IntentResult(Intent.FINANCIAL_CALCULATION)
            if has_math:
                return IntentResult(Intent.NON_FINANCIAL_CALCULATION)

        # Una consulta que combina varios ejes financieros pide una visión
        # integral, aunque también incluya un saludo o términos individuales.
        topic_groups = (
            {"ingreso", "ingresos", "sueldo", "salario"},
            {"gasto", "gastos", "consumo", "egreso"},
            {"ahorro", "ahorros", "ahorrar"},
            {"deuda", "deudas", "prestamo", "credito"},
        )
        matched_topic_groups = sum(
            1 for group in topic_groups if self._contains_any(normalized, group)
        )
        if matched_topic_groups >= 2 and self._contains_any(
            normalized,
            {"analiza", "analisis", "compara", "comparar", "resumen", "situacion"},
        ):
            return IntentResult(
                intent=Intent.FULL_ANALYSIS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=("multiple_financial_topics",),
            )

        # Una petición explícita de resumen debe conservar esa intención,
        # incluso si menciona la situación financiera general.
        summary_terms = next(
            terms for intent, terms in self._TERMS if intent == Intent.SUMMARY
        )
        matched_summary = tuple(
            term for term in summary_terms if self._contains_term(normalized, term)
        )
        if matched_summary:
            return IntentResult(
                intent=Intent.SUMMARY,
                mode=QueryMode.ANALYTICAL,
                matched_terms=matched_summary,
            )

        # Las frases explícitas de análisis completo deben prevalecer sobre
        # saludos como "hola" o "buenas" presentes al inicio.
        full_analysis_terms = next(
            terms for intent, terms in self._TERMS if intent == Intent.FULL_ANALYSIS
        )
        matched_full_analysis = tuple(
            term for term in full_analysis_terms if self._contains_term(normalized, term)
        )
        if matched_full_analysis:
            return IntentResult(
                intent=Intent.FULL_ANALYSIS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=matched_full_analysis,
            )

        # Las consultas sobre "mi perfil" deben usar los datos reales del usuario,
        # no una definición educativa genérica.
        if self._contains_any(normalized, {"mi perfil", "perfil financiero actual", "mi riesgo financiero"}):
            return IntentResult(
                intent=Intent.PROFILE,
                mode=QueryMode.ANALYTICAL,
                matched_terms=("perfil financiero",),
            )

        if self._is_financial_education(normalized):
            return IntentResult(Intent.FINANCIAL_EDUCATION)

        # "Cómo aumentar ingresos" solicita orientación; no debe confundirse
        # con una consulta directa sobre el monto de ingresos registrado.
        income_advice = tuple(
            term
            for term in self._INCOME_ADVICE_TERMS
            if self._contains_term(normalized, term)
        )
        if income_advice:
            return IntentResult(
                intent=Intent.RECOMMENDATIONS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=income_advice,
            )

        # Pedir formas de reducir gastos requiere orientación personalizada,
        # no devolver únicamente el total mensual registrado.
        expense_reduction = tuple(
            term
            for term in self._EXPENSE_REDUCTION_TERMS
            if self._contains_term(normalized, term)
        )
        if expense_reduction:
            return IntentResult(
                intent=Intent.RECOMMENDATIONS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=expense_reduction,
            )

        # Pedir un plan para salir de deudas requiere recomendaciones,
        # mientras que preguntar cuánto se debe conserva la intención directa.
        debt_advice = tuple(
            term
            for term in self._DEBT_ADVICE_TERMS
            if self._contains_term(normalized, term)
        )
        if debt_advice:
            return IntentResult(
                intent=Intent.RECOMMENDATIONS,
                mode=QueryMode.ANALYTICAL,
                matched_terms=debt_advice,
            )

        # Las preguntas sobre quién creó o programó el asistente se resuelven
        # de forma interna, sin enviar la consulta al modelo de lenguaje.
        creator_terms = tuple(
            term
            for term in self._CREATOR_TERMS
            if self._contains_term(normalized, term)
        )
        if creator_terms:
            return IntentResult(
                intent=Intent.CREATOR_INFO,
                mode=QueryMode.DIRECT,
                matched_terms=creator_terms,
            )

        # Consultas puntuales sobre transacciones: deben evaluarse antes de
        # la intención genérica EXPENSES para no devolver el promedio mensual.
        expense_detail_rules = (
            (Intent.HIGHEST_EXPENSE_DAY, self._HIGHEST_EXPENSE_DAY_TERMS),
            (Intent.LARGEST_EXPENSE, self._LARGEST_EXPENSE_TERMS),
            (Intent.TOP_EXPENSE_CATEGORY, self._TOP_EXPENSE_CATEGORY_TERMS),
            (Intent.HIGHEST_EXPENSE_MONTH, self._HIGHEST_EXPENSE_MONTH_TERMS),
        )
        for specific_intent, terms in expense_detail_rules:
            matched = tuple(
                term for term in terms if self._contains_term(normalized, term)
            )
            if matched:
                return IntentResult(
                    intent=specific_intent,
                    mode=QueryMode.DIRECT,
                    matched_terms=matched,
                )

        # Las consultas por gastos recientes deben evaluarse antes de la regla
        # genérica de gastos para no devolver solamente el promedio mensual.
        recent_expenses = tuple(
            term
            for term in self._RECENT_EXPENSE_TERMS
            if self._contains_term(normalized, term)
        )
        if recent_expenses:
            return IntentResult(
                intent=Intent.RECENT_EXPENSES,
                mode=QueryMode.DIRECT,
                matched_terms=recent_expenses,
            )

        # Las preguntas sobre dónde se concentra el gasto requieren categorías
        # y análisis, no solo devolver el total mensual.
        expense_analysis = tuple(
            term
            for term in self._EXPENSE_ANALYSIS_TERMS
            if self._contains_term(normalized, term)
        )
        if expense_analysis:
            return IntentResult(
                intent=Intent.EXPENSES,
                mode=QueryMode.ANALYTICAL,
                matched_terms=expense_analysis,
            )

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

        social_intents = {Intent.GREETING, Intent.THANKS, Intent.FAREWELL}
        ordered_terms = (
            tuple(item for item in self._TERMS if item[0] not in social_intents)
            + tuple(item for item in self._TERMS if item[0] in social_intents)
        )
        for intent, terms in ordered_terms:
            matched = tuple(term for term in terms if self._contains_term(normalized, term))
            if matched:
                mode = (
                    QueryMode.ANALYTICAL
                    if intent in {Intent.INCOME, Intent.EXPENSES, Intent.DEBT, Intent.SAVINGS, Intent.SCORE, Intent.PROFILE}
                    and self._contains_any(normalized, self._ANALYTICAL_TERMS)
                    else QueryMode.DIRECT
                )
                return IntentResult(intent=intent, mode=mode, matched_terms=matched)

        if self._contains_any(normalized, self._OUT_OF_SCOPE_TERMS):
            return IntentResult(Intent.OUT_OF_SCOPE)

        # Una frase ambigua que no coincide con las capacidades conocidas
        # recibe una guía para reformularla.
        return IntentResult(Intent.UNKNOWN)

    def _is_financial_education(self, normalized: str) -> bool:
        starters = {
            "que es",
            "que significa",
            "explicame",
            "como funciona",
            "para que sirve",
            "cual es la diferencia",
        }
        is_definition_question = self._contains_any(normalized, starters)
        is_general_which_question = (
            self._contains_term(normalized, "cual es")
            and re.search(r"\bcual es (?:mi|mis)\b", normalized) is None
        )
        return (
            is_definition_question or is_general_which_question
        ) and self._contains_any(normalized, self._FINANCIAL_DOMAIN_TERMS)

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
