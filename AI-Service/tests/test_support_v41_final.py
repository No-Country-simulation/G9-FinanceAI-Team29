from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.normalizer import SupportQueryNormalizer

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def test_csv_typo_starts_short_triage():
    assert SupportQueryNormalizer.normalize("no pedo cargr mi cvs") == "no puedo cargar mi csv"
    result = diagnose("no pedo cargr mi cvs")
    assert result is not None
    assert "¿Qué ocurre exactamente?" in result.content
    assert "1. El archivo es rechazado" in result.content


def test_csv_option_two_requests_exact_error():
    first = diagnose("no puedo cargar mi csv")
    second = diagnose("2", first.content)
    assert second is not None
    assert "mensaje exacto" in second.content.lower()


def test_known_csv_column_error_is_solved():
    first = diagnose("no puedo cargar mi csv")
    second = diagnose("2", first.content)
    third = diagnose("No se pudo leer la columna Fecha", second.content)
    assert third is not None
    assert third.solved
    assert "formato `AAAA-MM-DD`" in third.content
    assert "¿Puedo ayudarte con algo más?" in third.content


def test_unknown_csv_error_goes_to_requirements_then_support():
    first = diagnose("no puedo cargar mi csv")
    second = diagnose("2", first.content)
    third = diagnose("error al cargar csv", second.content)
    assert third is not None
    assert "¿El archivo cumple todos estos requisitos?" in third.content
    fourth = diagnose("sí", third.content)
    assert fourth is not None and fourth.escalate
    assert "/soporte" in fourth.content
    assert "¿Puedo ayudarte con algo más?" in fourth.content


def test_new_topic_after_referral_does_not_keep_old_state():
    referral = diagnose(
        "error interno",
        "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña.",
    )
    assert referral is not None and referral.escalate
    next_topic = diagnose("no puedo cargar mi csv", referral.content)
    assert next_topic is not None
    assert "¿Qué ocurre exactamente?" in next_topic.content
    assert "contraseña" not in next_topic.content.lower()


def test_output_is_neutral_latam():
    result = diagnose("no puedo cargar mi csv")
    assert result is not None
    forbidden = ("podés", "copiá", "revisá", "incluí", "respondeme", "guardá")
    assert not any(term in result.content.lower() for term in forbidden)
