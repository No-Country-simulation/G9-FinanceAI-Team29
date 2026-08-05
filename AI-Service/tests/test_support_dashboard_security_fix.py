from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def assert_unrecognized_routes_to_support(question: str, previous: str | None = None):
    assert SupportIntentDetector.is_critical_support_query(question)
    result = diagnose(question, previous)
    assert result is not None
    assert result.escalate
    assert "/soporte" in result.content
    assert "no importes ni elimines" in result.content
    assert "mensaje de contraseña" not in result.content.lower()
    assert "promedio" not in result.content.lower()


def test_transactions_not_mine():
    assert_unrecognized_routes_to_support("Hay transacciones que no hice")


def test_movements_not_recognized_after_password_flow():
    previous = "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña."
    assert_unrecognized_routes_to_support("Hay movimientos que no reconozco", previous)


def test_expenses_never_made_are_not_financial_statistics():
    assert_unrecognized_routes_to_support("Veo gastos que nunca hice")


def test_purchases_not_made_are_recognized():
    assert_unrecognized_routes_to_support("Hay compras que no hice")


def test_dashboard_unknown_expenses_overrides_csv_context():
    previous = "La carga termina, pero no aparecen movimientos."
    assert_unrecognized_routes_to_support("El dashboard muestra gastos que no hice", previous)


def test_generic_dashboard_problem_has_own_triage():
    previous = "Entiendo: la carga termina, pero después no ves los movimientos."
    result = diagnose("Mi dashboard está mal", previous)
    assert result is not None
    assert result.route == "support_dashboard_triage"
    assert "Dashboard" in result.content
    assert "importación" not in result.content.lower()
