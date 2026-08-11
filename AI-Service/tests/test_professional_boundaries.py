from app.services.support.professional_boundaries import (
    ProfessionalBoundariesResponder,
)


def test_accountant_boundary() -> None:
    result = ProfessionalBoundariesResponder.answer(
        "Si fueras mi contador, ¿qué harías?"
    )
    assert result is not None
    assert result.topic == "accountant_or_financial_advisor"
    assert "No puedo reemplazar" in result.content


def test_investment_boundary() -> None:
    result = ProfessionalBoundariesResponder.answer(
        "¿Qué acciones compro?"
    )
    assert result is not None
    assert result.topic == "investment_advice"


def test_credit_boundary() -> None:
    result = ProfessionalBoundariesResponder.answer(
        "¿Me conviene sacar un préstamo?"
    )
    assert result is not None
    assert result.topic == "credit_decision"


def test_normal_financial_question_is_not_blocked() -> None:
    assert (
        ProfessionalBoundariesResponder.answer("¿Cómo puedo ahorrar más?")
        is None
    )


def test_product_question_is_not_blocked() -> None:
    assert (
        ProfessionalBoundariesResponder.answer("¿Cómo funciona Finsi?")
        is None
    )
