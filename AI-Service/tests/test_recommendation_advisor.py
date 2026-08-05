from app.services.agent.recommendation_advisor import RecommendationAdvisor


def build(profile: str, diagnosis: str, action: str, objective: str) -> str:
    return RecommendationAdvisor.build({
        "perfil financiero": profile,
        "diagnostico": diagnosis,
        "accion sugerida": action,
        "objetivo": objective,
    })


def test_high_expenses_formats_money_percent_and_profile() -> None:
    result = build(
        "En riesgo.",
        "Los gastos representan el 86.4 por ciento de los ingresos. Educación es la categoría de mayor consumo, con USD 12,172.71.",
        "Revisar primero los movimientos de Educación y buscar una reducción gradual del 5% al 10%, sin afectar necesidades esenciales.",
        "Llevar gradualmente los gastos totales por debajo del 75 por ciento de los ingresos.",
    )
    assert "en riesgo" in result
    assert "86.4%" in result
    assert "$12,172.71" in result
    assert "75%" in result
    assert "USD" not in result
    assert "por ciento" not in result
    assert ".." not in result


def test_medium_savings_does_not_talk_about_categories() -> None:
    result = build(
        "En observación.",
        "La capacidad de ahorro actual es del 16.4 por ciento de los ingresos.",
        "Aumentar el porcentaje reservado en pasos pequeños y sostenerlo durante varios meses.",
        "Avanzar gradualmente hacia un ahorro cercano al 20 por ciento de los ingresos.",
    )
    assert "en observación" in result
    assert "16.4%" in result
    assert "20%" in result
    assert "categoría señalada" not in result
    assert "movimientos que componen" not in result


def test_negative_savings_prioritizes_recovery_before_automation() -> None:
    result = build(
        "En riesgo.",
        "La capacidad de ahorro estimada es del -3.4 por ciento de los ingresos.",
        "Separar una parte de cada ingreso apenas se recibe y automatizar el ahorro cuando sea posible.",
        "Alcanzar primero un ahorro mensual equivalente al 10 por ciento de los ingresos.",
    )
    assert "-3.4%" in result
    assert "Antes de automatizar el ahorro" in result
    assert "recuperar un balance mensual positivo" in result
    assert "categoría señalada" not in result


def test_strong_savings_focuses_on_organization() -> None:
    result = build(
        "Saludable.",
        "La capacidad de ahorro estimada es del 56.3 por ciento de los ingresos.",
        "Separar el ahorro destinado a emergencias del ahorro para metas de mediano o largo plazo.",
        "Construir o mantener un fondo de emergencia equivalente a entre 3 y 6 meses de gastos esenciales.",
    )
    assert "perfil financiero es saludable" in result
    assert "56.3%" in result
    assert "organizar el ahorro" in result
    assert "categoría señalada" not in result


def test_debt_uses_debt_specific_guidance() -> None:
    result = build(
        "En observación.",
        "Las obligaciones mensuales representan el 38.0 por ciento de los ingresos.",
        "Ordenar las deudas por costo financiero y evitar nuevas obligaciones.",
        "Reducir gradualmente las cuotas por debajo del 30 por ciento de los ingresos.",
    )
    assert "38.0%" in result
    assert "tasas, costos totales y plazos" in result
    assert "plan de reducción de deuda" in result
