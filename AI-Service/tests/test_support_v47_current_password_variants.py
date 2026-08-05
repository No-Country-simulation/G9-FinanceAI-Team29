from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def assert_direct_solution(question: str):
    assert SupportIntentDetector.is_support_query(question)
    result = diagnose(question)
    assert result is not None
    assert result.solved
    assert result.route == "support_current_password_incorrect"
    assert "¿Olvidaste tu contraseña?" in result.content
    assert "Vamos a revisar qué ocurre" not in result.content


def test_invalid_current_key_spanish():
    assert_direct_solution("Clave actual inválida")


def test_invalid_current_password_english():
    assert_direct_solution("Invalid current password")


def test_wrong_current_password_english():
    assert_direct_solution("Wrong current password")


def test_current_password_is_incorrect_english():
    assert_direct_solution("Current password is incorrect")


def test_invalid_current_password_inside_active_flow():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    third = diagnose("Invalid current password", second.content)

    assert third is not None
    assert third.solved
    assert third.route == "support_current_password_incorrect"
    assert "Este caso requiere una revisión" not in third.content
