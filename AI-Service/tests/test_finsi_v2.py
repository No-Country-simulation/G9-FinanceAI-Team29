from app.services.agent.intent import Intent, IntentDetector
from app.services.support.intent import SupportIntentDetector
from app.services.support.product_knowledge import (
    ProductKnowledgeResponder,
)


def test_product_rules() -> None:
    questions = (
        "Como te llamas",
        "Sos una IA",
        "Sos ChatGPT",
        "Como cierro sesion",
        "Como cierro sesion en todos los dispositivos",
        "Como exporto mis datos en PDF",
        "Que formatos puedo exportar",
        "Como elimino una meta",
        "Como modifico una meta",
        "Que columnas necesita",
        "Cual es el formato de fecha",
        "Cuanto puede pesar",
        "Para que sirve Analisis",
    )
    for question in questions:
        assert (
            ProductKnowledgeResponder.answer(question)
            is not None
        ), question


def test_financial_intents() -> None:
    detector = IntentDetector()

    assert detector.detect("Cuanto debo") == Intent.DEBT
    assert (
        detector.detect("Que deberia mejorar")
        == Intent.RECOMMENDATIONS
    )
    assert (
        detector.detect("Que revisarias primero")
        == Intent.RECOMMENDATIONS
    )
    assert (
        detector.detect("Como reduzco mis gastos")
        == Intent.RECOMMENDATIONS
    )


def test_support_context_protection() -> None:
    assert SupportIntentDetector.is_clear_financial_query(
        "Cual es mi score financiero"
    )
    assert not SupportIntentDetector.is_support_follow_up(
        "Que deberia mejorar",
        "Vamos a revisar que ocurre con la contrasena.",
    )
