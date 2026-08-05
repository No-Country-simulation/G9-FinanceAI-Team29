from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.normalizer import SupportQueryNormalizer

EMAIL = "support@example.com"

def diagnose(q, prev=None):
    return GuidedSupportDiagnosis.diagnose("USR1", q, prev, EMAIL)

def test_typo_csv_is_understood():
    assert SupportQueryNormalizer.normalize("no pedo cargr mi cvs") == "no puedo cargar mi csv"
    result = diagnose("no pedo cargr mi cvs")
    assert result is not None and "qué ocurre exactamente" in result.content.lower()

def test_new_csv_topic_cancels_password_waiting_state():
    prev = "Copia el mensaje exacto que aparece al guardar la nueva contraseña."
    result = diagnose("no puedo cargar mi csv", prev)
    assert result is not None
    assert "importación" in result.content.lower()
    assert "cambio de contraseña" not in result.content.lower()

def test_referral_closes_pending_state_and_offers_more_help():
    result = diagnose("error interno", "Copia el mensaje exacto que aparece al guardar la nueva contraseña.")
    assert result is not None and result.escalate
    assert "¿Puedo ayudarte con algo más?" in result.content
    follow = diagnose("no puedo cargar mi csv", result.content)
    assert follow is not None and "qué ocurre exactamente" in follow.content.lower()

def test_neutral_latam_output():
    result = diagnose("no puedo cargar mi csv")
    assert result is not None
    forbidden = ("podés", "copiá", "revisá", "incluí", "respondeme", "guardá")
    assert not any(word in result.content.lower() for word in forbidden)
