from pathlib import Path

from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def test_current_password_error_is_support_query():
    assert SupportIntentDetector.is_support_query("La contraseña actual es incorrecta")


def test_current_password_short_variant_is_support_query():
    assert SupportIntentDetector.is_support_query("Contraseña actual incorrecta")


def test_current_password_english_variant_is_support_query():
    assert SupportIntentDetector.is_support_query("Invalid current password")


def test_current_password_wrong_variant_is_support_query():
    assert SupportIntentDetector.is_support_query("Wrong current password")


def test_current_password_error_has_direct_solution():
    result = diagnose("La contraseña actual es incorrecta")
    assert result is not None
    assert result.solved
    assert result.route == "support_current_password_incorrect"
    assert "¿Olvidaste tu contraseña?" in result.content
    assert "Vamos a revisar qué ocurre" not in result.content


def test_main_router_contains_support_detector():
    service_file = Path(__file__).parents[1] / "app/services/agent/service.py"
    source = service_file.read_text(encoding="utf-8")
    assert "SupportIntentDetector.is_support_query" in source
    assert "support_agent.answer" in source
