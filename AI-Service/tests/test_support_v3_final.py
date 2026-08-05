from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector
from app.services.support.normalizer import SupportQueryNormalizer


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose(
        usuario_id="USR_TEST",
        question=question,
        previous_answer=previous,
        support_email="support@example.com",
    )


def test_csv_typo_starts_checklist():
    assert SupportQueryNormalizer.normalize("no pedo cargar mi cvs") == "no puedo cargar mi csv"
    result = diagnose("no pedo cargar mi cvs")
    assert result is not None
    assert result.route == "support_csv_triage"


def test_password_new_topic_after_csv_referral_starts_password_triage():
    previous = "Este caso necesita una revisión del equipo. Ir a la página de Soporte. CSV."
    result = diagnose("no puedo cambiar mi contraseña", previous)
    assert result is not None
    assert result.route == "support_password_triage"
    assert "1. La nueva contraseña" in result.content


def test_password_error_follow_up_asks_exact_message():
    previous = (
        "Vamos a revisar qué ocurre con la contraseña: 1. La nueva contraseña es rechazada. "
        "2. No aparece la opción. 3. Aparece un mensaje de error al guardar. "
        "4. No puedo iniciar sesión."
    )
    result = diagnose("me tira error", previous)
    assert result is not None
    assert result.route == "support_password_exact_error"
    assert "mensaje exacto" in result.content.casefold()


def test_password_number_three_asks_exact_message():
    previous = (
        "Vamos a revisar qué ocurre con la contraseña: 1. La nueva contraseña es rechazada. "
        "2. No aparece la opción para cambiarla. 3. Aparece un mensaje de error al guardar. "
        "4. No puedo iniciar sesión."
    )
    result = diagnose("3", previous)
    assert result is not None
    assert result.route == "support_password_exact_error"


def test_referral_uses_internal_support_page_without_old_mail_text():
    result = diagnose("error interno")
    # error interno puede ser capturado por el agente como crítico; probamos el helper directo
    referral = GuidedSupportDiagnosis._support_page_referral("Necesita revisión.")
    assert "](/soporte)" in referral.content
    assert "Contactar por correo" not in referral.content


def test_dashboard_unknown_transactions_is_support():
    assert SupportIntentDetector.is_critical_support_query(
        "el dashboard muestra transacciones que no hice"
    )


def test_password_unknown_exact_error_does_not_restart_menu():
    previous = (
        "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña. "
        "Si indica que debe tener al menos 8 caracteres o que las contraseñas no coinciden, puedo ayudarte."
    )
    result = diagnose("No se pudo cambiar tu contraseña", previous)
    assert result is not None
    assert result.escalate is True
    assert result.route == "support_page_referral"
    assert "Vamos a revisar qué ocurre" not in result.content
    assert "](/soporte)" in result.content


def test_password_known_exact_error_is_solved():
    previous = "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña."
    result = diagnose("La contraseña debe tener al menos 8 caracteres", previous)
    assert result is not None
    assert result.route == "support_password_too_short"
    assert result.solved is True
