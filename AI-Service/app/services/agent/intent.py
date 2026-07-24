import re
import unicodedata
from enum import StrEnum


class Intent(StrEnum):
    GREETING = "greeting"
    THANKS = "thanks"
    FAREWELL = "farewell"
    CAPABILITIES = "capabilities"
    PRIVACY_RESTRICTED = "privacy_restricted"
    SECURITY_RESTRICTED = "security_restricted"
    INCOME = "income"
    EXPENSES = "expenses"
    DEBT = "debt"
    SAVINGS = "savings"
    SCORE = "score"
    PROFILE = "profile"
    RECOMMENDATIONS = "recommendations"
    FULL_ANALYSIS = "full_analysis"
    UNKNOWN = "unknown"


class IntentDetector:
    """Clasifica consultas sin utilizar datos financieros del usuario."""

    _INTENT_TERMS: tuple[tuple[Intent, set[str]], ...] = (
        (
            Intent.FULL_ANALYSIS,
            {
                # Análisis explícito
                "analiza mis finanzas",
                "analizar mis finanzas",
                "analizame las finanzas",
                "analiza mi economia",
                "analizar mi economia",
                "analizame economicamente",
                "analiza mi situacion",
                "analizar mi situacion",
                "analizame mi situacion",
                "analisis financiero",
                "analisis de mis finanzas",
                "analisis de mi economia",
                "analisis de mi situacion",
                "analisis general",
                "analisis completo",
                "evaluacion financiera",
                "evaluacion de mis finanzas",
                "evaluame financieramente",
                "evaluar mis finanzas",
                "diagnostico financiero",
                "panorama financiero",
                "balance financiero",

                # Estado financiero
                "mi estado",
                "estado financiero",
                "mi estado financiero",
                "estado de mis finanzas",
                "estado general",
                "estado general de mis finanzas",
                "estado de mi economia",
                "mi situacion",
                "mi situacion financiera",
                "situacion financiera",
                "situacion economica",
                "mi situacion economica",
                "mi economia",
                "mis finanzas",
                "salud de mis finanzas",

                # Preguntas sobre cómo está
                "como estoy",
                "como ando",
                "como vengo",
                "como voy",
                "como me encuentro",
                "como estoy financieramente",
                "como estoy economicamente",
                "como ando financieramente",
                "como ando economicamente",
                "como vienen mis finanzas",
                "como van mis finanzas",
                "como estan mis finanzas",
                "como esta mi economia",
                "como va mi economia",
                "como esta mi situacion",
                "como esta mi situacion financiera",
                "como es mi situacion financiera",
                "que tal estan mis finanzas",
                "que tal esta mi economia",
                "estoy bien financieramente",
                "estoy bien economicamente",
                "estoy mal financieramente",
                "estoy mal economicamente",

                # Solicitudes de resumen
                "dame un resumen",
                "dame mi resumen",
                "dame un resumen financiero",
                "quiero un resumen",
                "quiero mi resumen",
                "resumen financiero",
                "resumen de mis finanzas",
                "resumen de mi situacion",
                "resumen de mi economia",
                "resumime mis finanzas",
                "resumi mis finanzas",
                "mostrame un resumen",
                "mostrar resumen financiero",
                "vista general",
                "vision general",
                "vision global",
                "panorama general",

                # Órdenes y solicitudes frecuentes
                "decime mi estado",
                "dime mi estado",
                "mostrame mi estado",
                "muestra mi estado",
                "indicame mi estado",
                "informame mi estado",
                "explicame mi estado",
                "contame mi estado",
                "revisa mi estado",
                "revisame las finanzas",
                "revisa mis finanzas",
                "revisa mi situacion",
                "revisame mi situacion",
                "quiero saber mi estado",
                "quisiera saber mi estado",
                "necesito saber mi estado",
                "quiero conocer mi estado",
                "quiero ver mi estado",
                "quiero saber como estoy",
                "quisiera saber como estoy",
                "necesito saber como estoy",
                "quiero conocer mi situacion",
                "quiero ver mi situacion",
                "mostrame como estoy",
                "decime como estoy",
                "dime como estoy",
                "explicame como estoy",
                "contame como estoy",
                "decime como vienen mis finanzas",
                "quiero revisar mis finanzas",
                "quiero ver mis finanzas",
                "mostrame mis finanzas",
            },
        ),
        (
            Intent.RECOMMENDATIONS,
            {
                "recomendacion",
                "recomendaciones",
                "recomendame",
                "recomiendame",
                "sugerencia",
                "sugerencias",
                "sugerime",
                "sugiereme",
                "que deberia mejorar",
                "que puedo mejorar",
                "que tengo que mejorar",
                "que me conviene mejorar",
                "que deberia hacer",
                "que puedo hacer",
                "que tengo que hacer",
                "que me conviene hacer",
                "que hago",
                "como puedo mejorar",
                "como mejorar",
                "como ordeno mis finanzas",
                "como organizar mis finanzas",
                "como manejar mejor mi dinero",
                "ayudame a mejorar",
                "ayudame con mis finanzas",
                "dame consejos",
                "dame un consejo",
                "consejo",
                "consejos",
                "por donde empiezo",
                "cual es el siguiente paso",
                "cuales son los proximos pasos",
                "que cambios puedo hacer",
                "que cambios deberia hacer",
            },
        ),
        (
            Intent.EXPENSES,
            {
                "gasto",
                "gastos",
                "gaste",
                "gastando",
                "cuanto gasto",
                "cuanto estoy gastando",
                "mis gastos",
                "ver mis gastos",
                "mostrar mis gastos",
                "mostrame mis gastos",
                "dime mis gastos",
                "decime mis gastos",
                "analiza mis gastos",
                "revisa mis gastos",
                "consumo",
                "consumos",
                "mis consumos",
                "egreso",
                "egresos",
                "salidas de dinero",
                "categoria",
                "categorias",
                "categoria de gasto",
                "categorias de gastos",
                "transaccion",
                "transacciones",
                "movimiento",
                "movimientos",
                "en que gasto",
                "en que estoy gastando",
                "en que gaste",
                "donde gasto",
                "donde se va mi dinero",
                "a donde se va mi dinero",
                "gasto principal",
                "gastos principales",
                "mayor gasto",
                "gasto mas grande",
                "categoria principal",
                "distribucion de gastos",
                "detalle de gastos",
                "historial de gastos",
            },
        ),
        (
            Intent.INCOME,
            {
                "ingreso",
                "ingresos",
                "mis ingresos",
                "ver mis ingresos",
                "mostrar mis ingresos",
                "mostrame mis ingresos",
                "decime mis ingresos",
                "dime mis ingresos",
                "analiza mis ingresos",
                "revisa mis ingresos",
                "cuanto gano",
                "cuanto estoy ganando",
                "cuanto cobro",
                "cuanto recibo",
                "cuanto ingresa",
                "ganancia",
                "ganancias",
                "entrada de dinero",
                "entradas de dinero",
                "dinero que entra",
                "fuente de ingreso",
                "fuentes de ingreso",
                "ingreso mensual",
                "sueldo",
                "salario",
                "detalle de ingresos",
                "historial de ingresos",
            },
        ),
        (
            Intent.DEBT,
            {
                "deuda",
                "deudas",
                "mi deuda",
                "mis deudas",
                "ver mis deudas",
                "mostrar mis deudas",
                "mostrame mis deudas",
                "decime mis deudas",
                "dime mis deudas",
                "analiza mis deudas",
                "revisa mis deudas",
                "cuanto debo",
                "cuanto estoy debiendo",
                "estoy endeudado",
                "estoy muy endeudado",
                "nivel de deuda",
                "nivel de endeudamiento",
                "endeudamiento",
                "ratio de deuda",
                "porcentaje de deuda",
                "peso de la deuda",
                "cuotas",
                "mis cuotas",
                "obligaciones financieras",
                "compromisos financieros",
                "pago de deuda",
                "pagos de deuda",
                "capacidad de pago",
            },
        ),
        (
            Intent.SAVINGS,
            {
                "ahorro",
                "ahorros",
                "mis ahorros",
                "ahorrar",
                "cuanto ahorro",
                "cuanto estoy ahorrando",
                "estoy ahorrando",
                "capacidad de ahorro",
                "porcentaje de ahorro",
                "nivel de ahorro",
                "tasa de ahorro",
                "ahorro mensual",
                "dinero ahorrado",
                "dinero disponible",
                "saldo disponible",
                "margen disponible",
                "margen de ahorro",
                "puedo ahorrar",
                "cuanto puedo ahorrar",
                "ver mis ahorros",
                "mostrar mis ahorros",
                "mostrame mis ahorros",
                "analiza mis ahorros",
                "revisa mis ahorros",
            },
        ),
        (
            Intent.SCORE,
            {
                "puntaje",
                "mi puntaje",
                "puntaje financiero",
                "score",
                "mi score",
                "score financiero",
                "calificacion financiera",
                "puntuacion financiera",
                "nota financiera",
                "resultado financiero",
                "cuantos puntos tengo",
                "cual es mi puntaje",
                "cual es mi score",
                "mostrame mi puntaje",
                "decime mi puntaje",
                "explicame mi puntaje",
                "como se calcula mi puntaje",
            },
        ),
        (
            Intent.PROFILE,
            {
                "perfil",
                "mi perfil",
                "perfil financiero",
                "mi perfil financiero",
                "tipo de perfil",
                "que perfil tengo",
                "cual es mi perfil",
                "mostrame mi perfil",
                "decime mi perfil",
                "explicame mi perfil",
                "clasificacion financiera",
                "mi clasificacion",
                "nivel de riesgo",
                "mi nivel de riesgo",
                "riesgo financiero",
                "riesgo de mis finanzas",
                "salud financiera",
                "mi salud financiera",
                "finanzas saludables",
                "soy saludable financieramente",
                "estoy en riesgo",
                "que tan riesgosa es mi situacion",
            },
        ),
    )

    # Reconoce órdenes y preguntas generales aunque no coincidan de manera
    # exacta con una frase del vocabulario anterior.
    _FULL_ANALYSIS_PATTERNS: tuple[str, ...] = (
        r"\b(?:decime|dime|mostrame|muestra|indicame|informame|explicame|"
        r"contame|revisa|revisame|analiza|analizame|evalua|evaluame)\b"
        r".*\b(?:estado|situacion|finanzas|economia|panorama|resumen)\b",

        r"\b(?:quiero|quisiera|necesito|me gustaria)\b"
        r".*\b(?:saber|conocer|ver|revisar|entender|analizar)\b"
        r".*\b(?:estado|situacion|finanzas|economia|panorama|resumen)\b",

        r"\bcomo\b.*\b(?:estoy|ando|vengo|voy)\b"
        r"(?:.*\b(?:financieramente|economicamente|finanzas|economia)\b)?",

        r"\bcomo\b.*\b(?:estan|van|vienen)\b"
        r".*\b(?:mis finanzas|mis cuentas|mis numeros)\b",

        r"\bcomo\b.*\b(?:esta|va|viene)\b"
        r".*\b(?:mi economia|mi situacion|mi estado financiero)\b",

        r"\b(?:mi|el)\b.*\b(?:estado|situacion)\b"
        r"(?:.*\b(?:financiero|financiera|economico|economica)\b)?",

        r"\b(?:resumen|analisis|evaluacion|panorama|balance|vision)\b"
        r".*\b(?:financiero|financiera|finanzas|economia|general|completo)\b",

        r"^(?:mi estado|mi situacion|mis finanzas|mi economia)$",
    )

    @staticmethod
    def normalize(text: str) -> str:
        normalized = unicodedata.normalize(
            "NFD",
            text.strip().lower(),
        )
        normalized = "".join(
            character
            for character in normalized
            if unicodedata.category(character) != "Mn"
        )
        normalized = re.sub(r"[^\w\s]", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized.strip()

    @classmethod
    def detect(cls, text: str) -> Intent:
        question = cls.normalize(text)

        if not question:
            return Intent.UNKNOWN

        if cls._is_only_greeting(question):
            return Intent.GREETING

        exact_intents = {
            Intent.THANKS: {
                "gracias",
                "muchas gracias",
                "mil gracias",
                "gracias por la ayuda",
                "perfecto gracias",
                "entendido gracias",
                "de acuerdo gracias",
                "muy bien gracias",
                "genial gracias",
            },
            Intent.FAREWELL: {
                "adios",
                "hasta luego",
                "hasta pronto",
                "nos vemos",
                "chau",
                "chao",
                "bye",
            },
            Intent.CAPABILITIES: {
                "que puedes hacer",
                "que podes hacer",
                "como puedes ayudarme",
                "como podes ayudarme",
                "en que puedes ayudarme",
                "en que podes ayudarme",
                "para que sirves",
                "que funciones tienes",
                "que hace finsight",
                "que hace finsight ai",
                "como funciona finsight",
                "como funciona finsight ai",
                "ayuda",
            },
        }

        for intent, messages in exact_intents.items():
            if question in messages:
                return intent

        if cls._matches_full_analysis_pattern(question):
            return Intent.FULL_ANALYSIS

        matches: list[Intent] = []

        for intent, terms in cls._INTENT_TERMS:
            if cls._contains_any(question, terms):
                matches.append(intent)

        if not matches:
            return Intent.UNKNOWN

        # Una consulta que combina varios temas financieros requiere una visión
        # global para que el contexto no omita información necesaria.
        specific_matches = {
            intent
            for intent in matches
            if intent
            not in {
                Intent.FULL_ANALYSIS,
                Intent.RECOMMENDATIONS,
            }
        }

        if (
            Intent.FULL_ANALYSIS in matches
            or len(specific_matches) >= 2
        ):
            return Intent.FULL_ANALYSIS

        return matches[0]

    @classmethod
    def _matches_full_analysis_pattern(
        cls,
        question: str,
    ) -> bool:
        return any(
            re.search(pattern, question) is not None
            for pattern in cls._FULL_ANALYSIS_PATTERNS
        )

    @staticmethod
    def _contains_any(
        question: str,
        terms: set[str],
    ) -> bool:
        for term in terms:
            pattern = rf"(?<!\w){re.escape(term)}(?!\w)"

            if re.search(pattern, question):
                return True

        return False

    @staticmethod
    def _is_only_greeting(question: str) -> bool:
        greeting_patterns = (
            r"hola+",
            r"holi+s*",
            r"buenas*",
            r"buen dia",
            r"buenos dias",
            r"buena tarde",
            r"buenas tardes",
            r"buena noche",
            r"buenas noches",
            r"hey+",
            r"hi+",
            r"hello+",
            r"saludos",
        )
        courtesy_patterns = (
            r"como estas",
            r"como te encuentras",
            r"que tal",
            r"todo bien",
            r"como va",
            r"espero que estes bien",
        )

        greeting_group = "|".join(greeting_patterns)
        courtesy_group = "|".join(courtesy_patterns)

        pattern = (
            rf"^(?:{greeting_group})"
            rf"(?:\s+(?:{courtesy_group}))?$"
        )

        return re.fullmatch(pattern, question) is not None