from pathlib import Path

from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.intent import SupportIntentDetector
from app.services.support.knowledge_base import SupportKnowledgeBase
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
    docs = Path(__file__).parents[1] / "app" / "services" / "support" / "docs"
    knowledge = SupportKnowledgeBase(docs)
    password = knowledge.search("donde cambio la contraseña")
    csv = knowledge.search("importar csv movimientos", min_score=0.01)
    export = knowledge.search("exportar pdf informe", min_score=0.01)
    assert password and any("Mi cuenta" in item.content for item in password)
    assert csv and any("Importar CSV" in item.content for item in csv)
    assert export and any("Exportar" in item.content for item in export)
