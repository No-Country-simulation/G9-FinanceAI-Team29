from app.services.support.agent import SupportAgent
from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector
from app.services.support.product_knowledge import ProductKnowledgeResponder


def test_product_knowledge_uses_real_account_name() -> None:
    result = ProductKnowledgeResponder.answer("¿Cómo cambio mi contraseña?")
    assert result is not None
    assert "Mi cuenta" in result.content
    assert "Mi Perfil" not in result.content
    assert "Cambiar contraseña" in result.content


def test_login_follow_up_does_not_repeat_change_password_answer() -> None:
    previous = (
        "Si recordás tu contraseña actual, entrá en Mi cuenta y tocá Cambiar contraseña. "
        "¿El problema es que no podés iniciar sesión?"
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="no puedo iniciar sesion",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_login_diagnosis"
    assert "¿Olvidaste tu contraseña?" in result.content
    assert "Prueba" in result.content


def test_repeated_login_problem_escalates_to_mail() -> None:
    previous = (
        "Si no podés iniciar sesión, verificá el correo y usá ¿Olvidaste tu contraseña?. "
        "Si ya hiciste estos pasos y todavía no podés entrar, respondeme sigue igual."
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="sigue igual ya hice eso",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.escalate is True
    assert "/soporte" in result.content
    assert "¿Puedo ayudarte con algo más?" in result.content


def test_product_screen_questions_are_support_queries() -> None:
    assert SupportIntentDetector.is_support_query("¿Cómo creo una meta?")
    assert SupportIntentDetector.is_support_query("¿Qué significa mi nivel de endeudamiento?")
    assert SupportIntentDetector.is_support_query("¿Qué muestra el dashboard?")


def test_typo_tolerance_for_password() -> None:
    result = ProductKnowledgeResponder.answer("como canvio mi contarseña")
    assert result is not None
    assert result.topic == "password_change"


def test_product_knowledge_csv_exact_columns() -> None:
    result = ProductKnowledgeResponder.answer("como importo un cvs")
    assert result is not None
    assert "fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente" in result.content
    assert "5 MB" in result.content


def test_generic_support_problem_starts_triage() -> None:
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="no anda",
        previous_answer=None,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_general_triage"
    assert "Inicio de sesión" in result.content
    assert "Importar CSV" in result.content


def test_repeated_generic_problem_after_support_answer_escalates() -> None:
    previous = (
        "Probá actualizar el Dashboard y verificá que tus datos aparezcan. "
        "Si sigue igual, avisame."
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="ya hice eso y sigue igual",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.escalate is True
    assert "/soporte" in result.content
    assert "¿Puedo ayudarte con algo más?" in result.content


def test_generic_csv_error_asks_full_requirements_before_escalating() -> None:
    previous = (
        "Entiendo: aparece un error durante la importación. Para identificar la causa necesito "
        "el mensaje exacto. Copiá y pegá el texto completo del error."
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="Error al cargar archivo CSV",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_csv_triage"
    assert "¿Qué ocurre exactamente?" in result.content
    assert result.escalate is False


def test_csv_requirements_confirmed_redirects_to_support_page() -> None:
    previous = (
        "Confirmemos que el archivo cumple todos estos requisitos: máximo 5 MB; "
        "fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente. "
        "¿El archivo cumple todos estos requisitos? Respondeme sí o no."
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="sí",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_page_referral"
    assert result.escalate is True
    assert "/soporte" in result.content
    assert "Ir a la página de Soporte" in result.content
    assert "mailto:" not in result.content


def test_csv_requirements_not_met_tells_user_to_fix_file() -> None:
    previous = (
        "Confirmemos que el archivo cumple todos estos requisitos: máximo 5 MB; "
        "fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente. "
        "¿El archivo cumple todos estos requisitos? Respondeme sí o no."
    )
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="no",
        previous_answer=previous,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_csv_requirements_fix"
    assert result.escalate is False
    assert "corrige" in result.content
    assert "5 MB" in result.content
