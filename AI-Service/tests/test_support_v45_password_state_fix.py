from app.services.support.diagnosis import GuidedSupportDiagnosis

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def test_current_password_incorrect_is_resolved_directly():
    result = diagnose("La contraseña actual es incorrecta")
    assert result is not None
    assert result.solved
    assert result.route == "support_current_password_incorrect"
    assert "¿Olvidaste tu contraseña?" in result.content
    assert "Vamos a revisar qué ocurre" not in result.content


def test_current_password_variant_is_resolved_directly():
    result = diagnose("Contraseña actual incorrecta")
    assert result is not None
    assert result.solved
    assert result.route == "support_current_password_incorrect"


def test_current_password_error_while_waiting_is_resolved():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    third = diagnose("La contraseña actual es incorrecta", second.content)
    assert third is not None
    assert third.solved
    assert third.route == "support_current_password_incorrect"
    assert "Vamos a revisar qué ocurre" not in third.content


def test_rejected_password_yes_escalates_instead_of_restarting():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("1", first.content)
    assert "¿La contraseña cumple todos estos requisitos?" in second.content

    third = diagnose("sí", second.content)
    assert third is not None
    assert third.escalate
    assert "/soporte" in third.content
    assert "¿Puedo ayudarte con algo más?" in third.content
    assert "Vamos a revisar qué ocurre" not in third.content


def test_rejected_password_no_returns_requirements_fix():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("1", first.content)
    third = diagnose("no", second.content)
    assert third is not None
    assert third.solved
    assert third.route == "support_password_requirements_fix"
    assert "Muy fuerte" in third.content
    assert "Corrige los requisitos pendientes" in third.content


def test_new_topic_still_cancels_password_confirmation():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("1", first.content)
    third = diagnose("no puedo cargar mi csv", second.content)
    assert third is not None
    assert "Vamos a revisar la importación" in third.content
    assert "contraseña" not in third.content.lower()
