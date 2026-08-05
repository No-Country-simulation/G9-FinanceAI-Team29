from pathlib import Path

from app.services.support.diagnosis import GuidedSupportDiagnosis

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def test_csv_requirements_yes_does_not_jump_to_password_flow():
    first = diagnose("no puedo subir mi csv")
    second = diagnose("2", first.content)
    third = diagnose("error al cargar csv", second.content)
    fourth = diagnose("sí", third.content)

    assert fourth is not None
    assert "contraseña cumple" not in fourth.content.lower()
    assert "archivo cumple todos los requisitos" in fourth.content.lower()
    assert "no puede importarse" in fourth.content.lower()
    assert fourth.route != "support_password_requirements_confirmation"


def test_password_requirements_yes_still_uses_password_flow():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("1", first.content)
    third = diagnose("sí", second.content)

    assert third is not None
    assert "contraseña cumple" in third.content.lower()


def test_frontend_centers_support_buttons_below_message():
    frontend = Path(__file__).parents[2] / "frontend/src/pages/Ai/AsistenteIA.tsx"
    source = frontend.read_text(encoding="utf-8")

    assert 'mt-3 flex w-full items-center justify-center gap-3' in source
    assert 'flex max-w-[80%] flex-col' in source
