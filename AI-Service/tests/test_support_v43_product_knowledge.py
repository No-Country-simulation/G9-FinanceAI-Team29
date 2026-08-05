from pathlib import Path

from app.services.support.product_knowledge import ProductKnowledgeResponder


def assert_password_requirements(content: str):
    assert "Muy fuerte" in content
    assert "8 caracteres" in content
    assert "mayúscula" in content
    assert "minúscula" in content
    assert "número" in content
    assert "símbolo" in content


def test_password_requirements_are_deterministic():
    result = ProductKnowledgeResponder.answer("qué requisitos necesita la contraseña")
    assert result is not None
    assert result.topic == "password_requirements"
    assert_password_requirements(result.content)


def test_password_requirement_variant():
    result = ProductKnowledgeResponder.answer("qué clave tengo que poner")
    assert result is not None
    assert_password_requirements(result.content)


def test_csv_columns_are_deterministic():
    result = ProductKnowledgeResponder.answer("qué columnas necesita el csv")
    assert result is not None
    assert result.topic == "csv_columns"
    assert "`fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`" in result.content


def test_csv_date_format_is_deterministic():
    result = ProductKnowledgeResponder.answer("qué formato debe tener la fecha del csv")
    assert result is not None
    assert "AAAA-MM-DD" in result.content


def test_csv_max_size_is_deterministic():
    result = ProductKnowledgeResponder.answer("cuánto puede pesar el csv")
    assert result is not None
    assert "5 MB" in result.content


def test_product_knowledge_route_precedes_intent_detection():
    service_file = Path(__file__).parents[1] / "app/services/agent/service.py"
    source = service_file.read_text(encoding="utf-8")
    product_index = source.index("product_knowledge = (")
    early_intent_index = source.index("early_intent = self.intent_detector.detect_result")
    assert product_index < early_intent_index


def test_unknown_fallback_is_neutral_spanish():
    service_file = Path(__file__).parents[1] / "app/services/agent/service.py"
    source = service_file.read_text(encoding="utf-8")
    assert "si quieres revisar" in source
    assert "si querés revisar" not in source
