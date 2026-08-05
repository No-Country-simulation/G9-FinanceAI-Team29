from pathlib import Path

from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector
from app.services.support.product_knowledge import ProductKnowledgeResponder

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def test_password_problem_is_support_query():
    assert SupportIntentDetector.is_support_query("no puedo cambiar mi contraseña")


def test_password_problem_starts_triage():
    result = diagnose("no puedo cambiar mi contraseña")
    assert result is not None
    assert result.route == "support_password_triage"
    assert "1. La nueva contraseña es rechazada" in result.content
    assert "3. Aparece un mensaje de error al guardar" in result.content


def test_option_three_requests_exact_error_and_lists_rules():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    assert second is not None
    assert second.route == "support_password_exact_error"
    assert "Copia el mensaje exacto" in second.content
    assert "8 caracteres" in second.content
    assert "mayúscula" in second.content
    assert "minúscula" in second.content
    assert "símbolo" in second.content


def test_internal_error_after_option_three_escalates():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    third = diagnose("Error interno", second.content)
    assert third is not None
    assert third.escalate
    assert "/soporte" in third.content
    assert "¿Puedo ayudarte con algo más?" in third.content
    assert "Vamos a revisar qué ocurre" not in third.content


def test_known_short_password_error_is_solved():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    third = diagnose("La contraseña debe tener al menos 8 caracteres", second.content)
    assert third is not None
    assert third.solved
    assert "Muy fuerte" in third.content
    assert "mayúscula" in third.content
    assert "símbolo" in third.content


def test_informational_change_password_has_full_requirements():
    result = ProductKnowledgeResponder.answer("cómo cambiar contraseña")
    assert result is not None
    assert result.topic == "password_change"
    assert "Muy fuerte" in result.content
    assert "8 caracteres" in result.content
    assert "mayúscula" in result.content
    assert "minúscula" in result.content
    assert "símbolo" in result.content


def test_router_checks_support_before_product_knowledge():
    service_file = Path(__file__).parents[1] / "app/services/agent/service.py"
    source = service_file.read_text(encoding="utf-8")
    support_index = source.index(
        "explicit_support_query = SupportIntentDetector.is_support_query"
    )
    product_index = source.index("product_knowledge = (")
    assert support_index < product_index
    assert "if explicit_support_query" in source
