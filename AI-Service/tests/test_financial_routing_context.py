from datetime import date

from app.services.agent.transaction_queries import TransactionQueryEngine


TRANSACTIONS = [
    {
        "fecha": "2026-07-03",
        "monto": 100,
        "tipo": "GASTO",
        "descripcion": "Supermercado",
        "categoria": "Alimentación",
        "medio_pago": "Tarjeta",
        "recurrente": False,
    },
    {
        "fecha": "2026-07-10",
        "monto": 500,
        "tipo": "GASTO",
        "descripcion": "Alquiler julio",
        "categoria": "Vivienda",
        "medio_pago": "Transferencia",
        "recurrente": True,
    },
    {
        "fecha": "2026-08-26",
        "monto": 1299,
        "tipo": "GASTO",
        "descripcion": "Notebook",
        "categoria": "Tecnología",
        "medio_pago": "Tarjeta",
        "recurrente": False,
    },
]


def test_financial_questions_are_candidates_before_support():
    questions = (
        "¿Cuál fue mi gasto más grande?",
        "¿En qué categoría gasto más?",
        "¿Cuánto gasté en julio de 2026?",
        "¿Qué día gasté más en julio?",
        "¿Cuánto gasté este mes?",
    )
    assert all(
        TransactionQueryEngine.is_financial_query_candidate(question)
        for question in questions
    )


def test_max_day_respects_explicit_month():
    result = TransactionQueryEngine.answer(
        "¿Qué día gasté más en julio?",
        TRANSACTIONS,
        today=date(2026, 8, 26),
    )
    assert result is not None
    assert "10/07/2026" in result.content
    assert "26/08/2026" not in result.content


def test_movement_follow_up_uses_previous_date():
    result = TransactionQueryEngine.answer(
        "¿Qué movimiento fue ese?",
        TRANSACTIONS,
        today=date(2026, 8, 26),
        previous_answer=(
            "El día que más gastaste fue el 10/07/2026: "
            "$500,00 en 1 movimiento en julio de 2026."
        ),
    )
    assert result is not None
    assert "Alquiler julio" in result.content
    assert "10/07/2026" in result.content


def test_previous_month_keeps_expense_total_context():
    result = TransactionQueryEngine.answer(
        "¿Y el mes pasado?",
        TRANSACTIONS,
        today=date(2026, 8, 26),
        previous_answer="Gastaste $1.299,00 este mes en 1 movimiento.",
    )
    assert result is not None
    assert "julio de 2026" in result.content
    assert "$600,00" in result.content
