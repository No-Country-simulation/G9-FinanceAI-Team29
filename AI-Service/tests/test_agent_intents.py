from app.services.agent.intent import Intent, IntentDetector


def test_simple_greetings_are_detected() -> None:
    detector = IntentDetector()
    assert detector.detect("Holi") == Intent.GREETING
    assert detector.detect("¡Holaaaa!") == Intent.GREETING
    assert detector.detect("Buen día") == Intent.GREETING
    assert detector.detect("Hola, ¿cómo estás?") == Intent.GREETING


def test_greeting_with_financial_question_keeps_financial_intent() -> None:
    detector = IntentDetector()
    assert detector.detect("Hola, ¿en qué gasto más?") == Intent.EXPENSES
    assert detector.detect("Buenas, analiza mis finanzas") == Intent.FULL_ANALYSIS


def test_financial_intents() -> None:
    detector = IntentDetector()
    assert detector.detect("¿Cuánto ingreso por mes?") == Intent.INCOME
    assert detector.detect("¿Mi deuda es preocupante?") == Intent.DEBT
    assert detector.detect("¿Cuánto puedo ahorrar?") == Intent.SAVINGS
    assert detector.detect("¿Cuál es mi puntaje?") == Intent.SCORE
    assert detector.detect("Dame recomendaciones") == Intent.RECOMMENDATIONS


def test_unknown_intent() -> None:
    detector = IntentDetector()
    assert detector.detect("Cuéntame un chiste") == Intent.UNKNOWN


def test_multiple_financial_topics_use_full_analysis() -> None:
    detector = IntentDetector()
    assert (
        detector.detect("Compara mis ingresos, gastos y ahorro")
        == Intent.FULL_ANALYSIS
    )
