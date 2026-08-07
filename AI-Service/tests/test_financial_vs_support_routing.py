from app.services.support.product_knowledge import ProductKnowledgeResponder


def test_personal_savings_question_is_not_product_navigation() -> None:
    assert ProductKnowledgeResponder.answer("¿Cómo puedo ahorrar más?") is None


def test_personal_debt_question_is_not_generic_product_knowledge() -> None:
    assert (
        ProductKnowledgeResponder.answer(
            "¿Cuál es mi nivel de endeudamiento?"
        )
        is None
    )


def test_debt_definition_is_still_explained() -> None:
    result = ProductKnowledgeResponder.answer(
        "¿Qué significa nivel de endeudamiento?"
    )
    assert result is not None
    assert result.topic == "debt_level"


def test_savings_definition_is_still_explained() -> None:
    result = ProductKnowledgeResponder.answer(
        "¿Qué es la capacidad de ahorro?"
    )
    assert result is not None
    assert result.topic == "savings_capacity"
