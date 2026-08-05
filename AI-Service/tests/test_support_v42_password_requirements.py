from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.product_knowledge import ProductKnowledgeResponder

EMAIL = "support@example.com"


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose("USR1", question, previous, EMAIL)


def assert_full_requirements(content: str):
    assert "Muy fuerte" in content
    assert "8 caracteres" in content
    assert "mayúscula" in content
    assert "minúscula" in content
    assert "número" in content
    assert "símbolo" in content
    assert "Términos y condiciones" in content
    assert "Política de privacidad" in content


def test_rejected_password_shows_full_requirements():
    first = diagnose("no puedo cambiar mi contraseña")
    result = diagnose("1", first.content)
    assert result is not None
    assert_full_requirements(result.content)
    assert "¿La contraseña cumple todos estos requisitos?" in result.content


def test_short_password_error_shows_full_requirements():
    first = diagnose("no puedo cambiar mi contraseña")
    second = diagnose("3", first.content)
    result = diagnose("La contraseña debe tener al menos 8 caracteres", second.content)
    assert result is not None
    assert result.solved
    assert_full_requirements(result.content)


def test_direct_question_about_password_requirements():
    result = diagnose("qué requisitos necesita la contraseña")
    assert result is not None
    assert_full_requirements(result.content)


def test_product_knowledge_password_requirements():
    result = ProductKnowledgeResponder.answer("cómo debe ser la contraseña")
    assert result is not None
    assert_full_requirements(result.content)
