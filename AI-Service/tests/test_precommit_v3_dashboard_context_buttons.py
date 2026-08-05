from pathlib import Path

from app.services.agent.normalizer import QueryNormalizer
from app.services.support.diagnosis import GuidedSupportDiagnosis

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def dashboard_menu() -> str:
    result = diagnose("Mi dashboard está mal")
    assert result is not None
    return result.content


def test_dashboard_option_one_escalates_as_unrecognized_transactions():
    result = diagnose("1", dashboard_menu())
    assert result is not None
    assert result.escalate
    assert "no importes ni elimines movimientos" in result.content
    assert "¿Puedo ayudarte con algo más?" in result.content


def test_dashboard_option_two_returns_empty_dashboard_steps():
    result = diagnose("2", dashboard_menu())
    assert result is not None
    assert result.solved
    assert result.route == "support_dashboard_empty"
    assert "Actualiza la página" in result.content


def test_dashboard_option_three_requests_mismatch_detail():
    result = diagnose("3", dashboard_menu())
    assert result is not None
    assert result.route == "support_dashboard_totals_detail"
    assert "ingresos, gastos, balance" in result.content


def test_dashboard_option_four_requests_exact_error():
    result = diagnose("4", dashboard_menu())
    assert result is not None
    assert result.route == "support_dashboard_waiting_error"
    assert "Copia el mensaje exacto" in result.content


def test_anterio_typo_is_normalized():
    assert QueryNormalizer.normalize("y el anterio") == "y el anterior"


def test_frontend_renders_support_buttons_inline():
    frontend = Path(__file__).parents[2] / "frontend/src/pages/Ai/AsistenteIA.tsx"
    source = frontend.read_text(encoding="utf-8")
    assert "ultimoMensajeAsistenteId" in source
    assert '/¿Puedo ayudarte con algo más\\?/i.test(message.text)' in source
    assert 'onClick={() => responderSoporte("sí")}' in source
    assert 'onClick={() => responderSoporte("no")}' in source
