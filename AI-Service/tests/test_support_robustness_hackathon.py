from pathlib import Path

from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector
from app.services.support.product_knowledge import ProductKnowledgeResponder
from app.services.support.normalizer import SupportQueryNormalizer


def test_support_understands_typos_and_informal_language() -> None:
    samples = (
        "no me anda el cvs",
        "no puedo descagar el pfd",
        "como canvio mi contarseña",
        "quiero darme de vaja",
        "che el coso del pdf no funca",
        "el archivo queda pensando y no responde",
    )
    for sample in samples:
        assert SupportIntentDetector.is_support_query(sample), sample


def test_support_normalizer_preserves_semantic_intent() -> None:
    assert "csv" in SupportQueryNormalizer.normalize("el cvs no me anda")
    assert "pdf" in SupportQueryNormalizer.normalize("no puedo abrir el pfd")
    assert "cambiar" in SupportQueryNormalizer.normalize("como canvio la clave")
    assert "contrasena" in SupportQueryNormalizer.normalize("como canvio mi contarseña")
    assert "dar de baja" in SupportQueryNormalizer.normalize("quiero darme de vaja")


def test_password_answer_uses_real_profile_route() -> None:
    result = GuidedSupportDiagnosis.diagnose(
        usuario_id="USR1005",
        question="como cambio mi contraseña",
        previous_answer=None,
        support_email="soporte@example.com",
    )
    assert result is not None
    assert result.route == "support_password_triage"
    assert "La nueva contraseña es rechazada" in result.content
    assert "Mi Perfil" not in result.content


def test_support_knowledge_contains_real_navigation() -> None:
    password = ProductKnowledgeResponder.answer("donde cambio la contraseña")
    csv = ProductKnowledgeResponder.answer("importar csv movimientos")
    export = ProductKnowledgeResponder.answer("exportar pdf informe")

    assert password is not None
    assert "Mi cuenta" in password.content
    assert "Seguridad" in password.content

    assert csv is not None
    assert "Importar CSV" in csv.content

    assert export is not None
    assert "Exportar" in export.content or "PDF" in export.content
