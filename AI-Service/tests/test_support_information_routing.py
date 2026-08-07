import pytest

from app.services.support.intent import SupportIntentDetector
from app.services.support.product_knowledge import ProductKnowledgeResponder


@pytest.mark.parametrize(
    "question",
    [
        "¿Dónde cambio mi contraseña?",
        "¿Cómo recupero mi contraseña?",
        "¿Cómo importo un CSV?",
        "¿Cómo descargo el informe PDF?",
        "¿Dónde exporto mis movimientos?",
        "¿Cómo comparto mi informe?",
        "¿Dónde veo mis transacciones?",
        "¿Cómo creo una meta?",
        "¿Qué muestra el dashboard?",
        "¿Qué significa perfil en riesgo?",
    ],
)
def test_information_questions_do_not_start_support_diagnosis(question: str) -> None:
    assert SupportIntentDetector.is_information_query(question)


@pytest.mark.parametrize(
    "question",
    [
        "No puedo cambiar mi contraseña",
        "No recibo el correo de recuperación",
        "No puedo importar un CSV",
        "Error al descargar el informe PDF",
        "No carga el dashboard",
        "No aparecen mis transacciones",
        "No puedo crear una meta",
    ],
)
def test_real_problems_still_start_support(question: str) -> None:
    assert not SupportIntentDetector.is_information_query(question)
    assert SupportIntentDetector.is_support_query(question)


def test_password_navigation_has_deterministic_answer() -> None:
    result = ProductKnowledgeResponder.answer("¿Dónde cambio mi contraseña?")
    assert result is not None
    assert result.route == "support_product_password_change"
    assert "Mi cuenta" in result.content


def test_password_recovery_navigation_has_deterministic_answer() -> None:
    result = ProductKnowledgeResponder.answer("¿Cómo recupero mi contraseña?")
    assert result is not None
    assert result.route == "support_product_password_recovery"
    assert "Olvidaste tu contraseña" in result.content
