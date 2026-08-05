from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose(
        usuario_id="test-user",
        question=question,
        previous_answer=previous,
        support_email="support@example.com",
    )


def test_csv_typo_starts_requirements_flow():
    result = diagnose("no puedo cargr mi cvs")
    assert result is not None
    assert result.route == "support_csv_triage"


def test_csv_unknown_error_can_go_to_internal_support_page():
    first = diagnose("no puedo cargar mi csv")
    second = diagnose("2", first.content)
    result = diagnose("error xyz-845", second.content)
    assert result is not None
    assert result.escalate is True
    assert "/soporte" in result.content
    assert "mailto:" not in result.content


def test_password_accepts_number_and_known_error():
    first = diagnose("no puedo cambiar mi contrasena")
    assert first.route == "support_password_triage"
    second = diagnose("3", first.content)
    assert second.route == "support_password_exact_error"
    third = diagnose("las contrasenas no coinciden", second.content)
    assert third.route == "support_password_mismatch"
    assert third.solved is True


def test_password_unknown_error_goes_to_support_without_loop():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("me tira error", first.content)
    third = diagnose("error xyz 481", second.content)
    assert third.escalate is True
    assert "/soporte" in third.content


def test_unrecognized_transactions_are_critical_support():
    question = "el dashbord muestra transaciones q no ise"
    assert SupportIntentDetector.is_critical_support_query(question)
    result = diagnose(question)
    assert result is not None
    assert result.escalate is True
    assert "/soporte" in result.content


def test_solved_flow_accepts_no():
    solved = diagnose("No se pudo leer la columna Fecha")
    closed = diagnose("no", solved.content)
    assert closed.route == "support_conversation_closed"
