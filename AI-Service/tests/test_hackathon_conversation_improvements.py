from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.rules_engine import FinancialRulesEngine
from app.services.agent.schemas import QueryMode


def test_increase_income_is_recommendations_not_direct_income() -> None:
    result = IntentDetector().detect_result("Como puedo aumentar mis ingresos?")
    assert result.intent == Intent.RECOMMENDATIONS
    assert result.mode == QueryMode.ANALYTICAL


def test_where_spending_more_is_analytical_expenses() -> None:
    result = IntentDetector().detect_result("Donde estoy gastando mas?")
    assert result.intent == Intent.EXPENSES
    assert result.mode == QueryMode.ANALYTICAL


def test_advisor_fact_for_significant_deficit() -> None:
    facts = FinancialRulesEngine.evaluate({
        "nivel_riesgo": "Moderado",
        "metricas": {
            "ingreso_mensual": 3000,
            "gasto_mensual_promedio": 2800,
            "deuda_mensual": 550,
            "ahorro_mensual_estimado": -350,
            "ratio_gasto_ingreso": 93.3,
            "ratio_deuda_ingreso": 18.3,
        },
    })
    assert any(f["code"] == "professional_advice_recommended" for f in facts)


def test_no_advisor_fact_for_healthy_finances() -> None:
    facts = FinancialRulesEngine.evaluate({
        "nivel_riesgo": "Bajo",
        "metricas": {
            "ingreso_mensual": 3000,
            "gasto_mensual_promedio": 1800,
            "deuda_mensual": 200,
            "ahorro_mensual_estimado": 1000,
            "ratio_gasto_ingreso": 60,
            "ratio_deuda_ingreso": 6.7,
            "ratio_ahorro_ingreso": 33.3,
        },
    })
    assert not any(f["code"] == "professional_advice_recommended" for f in facts)


def test_generate_more_income_is_recommendations() -> None:
    result = IntentDetector().detect_result("Como puedo generar mas ingresos?")
    assert result.intent == Intent.RECOMMENDATIONS
    assert result.mode == QueryMode.ANALYTICAL


def test_reduce_expenses_is_recommendations() -> None:
    result = IntentDetector().detect_result("Como puedo reducir mis gastos?")
    assert result.intent == Intent.RECOMMENDATIONS
    assert result.mode == QueryMode.ANALYTICAL


def test_get_out_of_debt_is_recommendations() -> None:
    result = IntentDetector().detect_result("Como puedo salir de deudas?")
    assert result.intent == Intent.RECOMMENDATIONS
    assert result.mode == QueryMode.ANALYTICAL
