from datetime import date

from app.services.agent.service import FinSightAgentService
from app.services.agent.transaction_queries import TransactionQueryEngine


TX = [
    {"fecha": "2026-07-10", "descripcion": "Supermercado", "monto": 200, "tipo": "GASTO", "categoria": "Alimentación"},
    {"fecha": "2026-07-10", "descripcion": "Taxi", "monto": 50, "tipo": "GASTO", "categoria": "Transporte"},
    {"fecha": "2026-07-20", "descripcion": "Cena", "monto": 100, "tipo": "GASTO", "categoria": "Alimentación"},
    {"fecha": "2026-08-01", "descripcion": "Alquiler", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
    {"fecha": "2026-08-26", "descripcion": "Notebook", "monto": 1299, "tipo": "GASTO", "categoria": "Tecnología"},
]


def test_max_day_respects_explicit_month():
    result = TransactionQueryEngine.answer(
        "que dia gaste mas en julio 2026", TX, today=date(2026, 8, 3)
    )
    assert result is not None
    assert "10/07/2026" in result.content
    assert "$250,00" in result.content
    assert "26/08/2026" not in result.content


def test_contextual_movement_lists_the_movements_from_previous_day():
    previous = "El día que más gastaste fue el 10/07/2026: $250,00 en 2 movimientos."
    result = TransactionQueryEngine.answer(
        "que movimiento fue ese", TX, today=date(2026, 8, 3), previous_answer=previous
    )
    assert result is not None
    assert "Supermercado" in result.content
    assert "Taxi" in result.content


def test_short_month_follow_up_keeps_expense_total_operation():
    previous = "Gastaste $350,00 en julio de 2026 en 3 movimientos."
    result = TransactionQueryEngine.answer(
        "y agosto?", TX, today=date(2026, 8, 3), previous_answer=previous
    )
    assert result is not None
    assert "agosto de 2026" in result.content
    assert "$950,00" in result.content
    assert "$1.299,00" not in result.content


def test_current_date_uses_supplied_local_date():
    result = TransactionQueryEngine.answer(
        "que dia es hoy", [], today=date(2026, 8, 3)
    )
    assert result is not None
    assert "lunes 3 de agosto de 2026" in result.content


def test_timezone_fallback_is_safe():
    resolved = FinSightAgentService._today_for_time_zone("Zona/Inexistente")
    assert isinstance(resolved, date)
