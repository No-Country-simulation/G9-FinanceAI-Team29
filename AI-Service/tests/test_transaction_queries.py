from datetime import date

from app.services.agent.transaction_queries import TransactionQueryEngine


TX = [
    {"tipo": "INGRESO", "monto": 100000, "fecha": "2026-08-01", "categoria": "Sueldo", "descripcion": "Sueldo", "medioPago": "Transferencia"},
    {"tipo": "GASTO", "monto": 10000, "fecha": "2026-08-01", "categoria": "Comida", "descripcion": "Supermercado", "medioPago": "Débito"},
    {"tipo": "GASTO", "monto": 30000, "fecha": "2026-08-02", "categoria": "Comida", "descripcion": "Restaurante", "medioPago": "Crédito"},
    {"tipo": "GASTO", "monto": 5000, "fecha": "2026-07-15", "categoria": "Transporte", "descripcion": "Sube", "medioPago": "Débito"},
    {"tipo": "INGRESO", "monto": 90000, "fecha": "2026-07-01", "categoria": "Sueldo", "descripcion": "Sueldo", "medioPago": "Transferencia"},
]


def ask(question: str):
    result = TransactionQueryEngine.answer(question, TX, today=date(2026, 8, 2))
    assert result is not None
    return result


def test_max_expense_day():
    result = ask("¿Qué día tuve más gastos?")
    assert result.action == "expenses_max_day"
    assert "02/08/2026" in result.content
    assert "$30.000,00" in result.content


def test_month_expenses():
    result = ask("¿Cuánto gasté este mes?")
    assert "$40.000,00" in result.content


def test_top_category():
    result = ask("¿En qué categoría gasto más?")
    assert "Comida" in result.content


def test_max_purchase():
    result = ask("¿Cuál fue mi compra más cara?")
    assert "Restaurante" in result.content


def test_income_month():
    result = ask("¿Cuánto ingresé este mes?")
    assert "$100.000,00" in result.content


def test_savings_month():
    result = ask("¿Cuánto ahorré este mes?")
    assert "$60.000,00" in result.content


def test_month_comparison():
    result = ask("¿Gasté más este mes que el anterior?")
    assert "aumentaron" in result.content


def test_monthly_overview():
    result = ask("¿Cómo estuvieron mis finanzas este mes?")
    assert "$100.000,00" in result.content
    assert "$40.000,00" in result.content


def test_projection():
    result = ask("Si sigo así, ¿cómo voy a terminar el mes?")
    assert result.action == "month_projection"


def test_today_actions():
    result = TransactionQueryEngine.answer(
        "¿Qué debería hacer hoy?", TX, today=date(2026, 8, 2), user_name="Linth"
    )
    assert result is not None
    assert "Linth" in result.content
    assert "1." in result.content


def test_colloquial_highest_expense_day_is_supported():
    transactions = [
        {"fecha": "2026-01-02", "descripcion": "Alquiler", "monto": 2800, "tipo": "GASTO", "categoria": "Vivienda"},
        {"fecha": "2026-01-02", "descripcion": "Comida", "monto": 200, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-01-03", "descripcion": "Transporte", "monto": 100, "tipo": "GASTO", "categoria": "Transporte"},
    ]
    result = TransactionQueryEngine.answer("que dia gaste mas", transactions, today=date(2026, 8, 2))
    assert result is not None
    assert result.action == "expenses_max_day"
    assert "02/01/2026" in result.content
    assert "$3.000,00" in result.content


def test_relative_months_use_latest_dataset_month_when_current_month_has_no_data():
    transactions = [
        {"fecha": "2025-12-10", "descripcion": "Diciembre", "monto": 500, "tipo": "GASTO", "categoria": "Servicios"},
        {"fecha": "2026-01-02", "descripcion": "Alquiler", "monto": 2800, "tipo": "GASTO", "categoria": "Vivienda"},
        {"fecha": "2026-01-05", "descripcion": "Comida", "monto": 200, "tipo": "GASTO", "categoria": "Alimentación"},
    ]
    current = TransactionQueryEngine.answer("cuanto gaste este mes", transactions, today=date(2026, 8, 2))
    previous = TransactionQueryEngine.answer("cuanto gaste el mes pasado", transactions, today=date(2026, 8, 2))
    assert current is not None and "enero de 2026" in current.content and "$3.000,00" in current.content
    assert previous is not None
    assert "No tuviste gastos registrados en julio de 2026" in previous.content
    assert "Tu último gasto fue $200,00" in previous.content
    assert "05/01/2026" in previous.content


def test_previous_calendar_month_without_expenses_reports_latest_expense():
    from datetime import date
    from app.services.agent.transaction_queries import TransactionQueryEngine

    transactions = [
        {
            "fecha": "2026-01-02",
            "descripcion": "Pago alquiler",
            "monto": 2800,
            "tipo": "GASTO",
            "categoria": "Vivienda",
            "medio_pago": "Transferencia",
            "recurrente": True,
        }
    ]

    result = TransactionQueryEngine.answer(
        "cuanto gaste el mes pasado",
        transactions,
        today=date(2026, 8, 3),
    )

    assert result is not None
    assert "No tuviste gastos registrados en julio de 2026" in result.content
    assert "Tu último gasto fue $2.800,00" in result.content
    assert "02/01/2026" in result.content


def test_previous_calendar_month_with_expenses_reports_total():
    from datetime import date
    from app.services.agent.transaction_queries import TransactionQueryEngine

    transactions = [
        {
            "fecha": "2026-07-10",
            "descripcion": "Supermercado",
            "monto": 100,
            "tipo": "GASTO",
            "categoria": "Alimentación",
            "medio_pago": "Débito",
            "recurrente": False,
        },
        {
            "fecha": "2026-07-15",
            "descripcion": "Transporte",
            "monto": 50,
            "tipo": "GASTO",
            "categoria": "Transporte",
            "medio_pago": "Efectivo",
            "recurrente": False,
        },
    ]

    result = TransactionQueryEngine.answer(
        "cuanto gaste el mes pasado",
        transactions,
        today=date(2026, 8, 3),
    )

    assert result is not None
    assert "Gastaste $150,00 en julio de 2026 en 2 movimientos" in result.content


def test_highest_expense_day_can_be_filtered_by_previous_month():
    transactions = [
        {"fecha": "2026-07-10", "descripcion": "Supermercado", "monto": 100, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-07-10", "descripcion": "Taxi", "monto": 50, "tipo": "GASTO", "categoria": "Transporte"},
        {"fecha": "2026-07-20", "descripcion": "Alquiler", "monto": 120, "tipo": "GASTO", "categoria": "Vivienda"},
        {"fecha": "2026-08-02", "descripcion": "Notebook", "monto": 900, "tipo": "GASTO", "categoria": "Tecnología"},
    ]
    result = TransactionQueryEngine.answer(
        "cual fue el dia que gaste mas el mes pasado",
        transactions,
        today=date(2026, 8, 3),
    )
    assert result is not None
    assert result.action == "expenses_max_day"
    assert "10/07/2026" in result.content
    assert "$150,00" in result.content
    assert "el mes pasado" in result.content
    assert "02/08/2026" not in result.content


def test_in_what_did_i_spend_yesterday_lists_yesterday_expenses():
    transactions = [
        {"fecha": "2026-08-02", "descripcion": "Alquiler agosto", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
        {"fecha": "2026-08-02", "descripcion": "Café", "monto": 5, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-01", "descripcion": "Supermercado", "monto": 100, "tipo": "GASTO", "categoria": "Alimentación"},
    ]
    result = TransactionQueryEngine.answer(
        "en que gaste ayer",
        transactions,
        today=date(2026, 8, 3),
    )
    assert result is not None
    assert result.action == "expenses_period_detail"
    assert "$955,00" in result.content
    assert "Alquiler agosto" in result.content
    assert "Café" in result.content
    assert "Supermercado" not in result.content


def test_relative_query_catalog_expansion():
    transactions = [
        {"fecha": "2026-07-10", "descripcion": "Supermercado julio", "monto": 100, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-07-10", "descripcion": "Taxi julio", "monto": 50, "tipo": "GASTO", "categoria": "Transporte"},
        {"fecha": "2026-08-18", "descripcion": "Farmacia", "monto": 40, "tipo": "GASTO", "categoria": "Salud"},
        {"fecha": "2026-08-24", "descripcion": "Netflix", "monto": 20, "tipo": "GASTO", "categoria": "Entretenimiento"},
        {"fecha": "2026-08-25", "descripcion": "Restaurante", "monto": 80, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-26", "descripcion": "Notebook", "monto": 1299, "tipo": "GASTO", "categoria": "Tecnología"},
        {"fecha": "2026-08-20", "descripcion": "Freelance", "monto": 420, "tipo": "INGRESO", "categoria": "Otros ingresos"},
        {"fecha": "2026-08-01", "descripcion": "Sueldo", "monto": 3200, "tipo": "INGRESO", "categoria": "Sueldo"},
    ]
    questions = [
        "¿En qué gasté hoy?",
        "¿En qué gasté ayer?",
        "¿En qué gasté esta semana?",
        "¿En qué gasté el mes pasado?",
        "¿Qué compré este mes?",
        "¿Qué movimientos tuve hoy?",
        "¿Qué movimientos tuve esta semana?",
        "¿Cuál fue mi compra más cara este mes?",
        "¿En qué categoría gasté más este mes?",
        "¿Cuáles fueron mis últimos cinco movimientos?",
        "¿Cuándo cobré por última vez?",
        "¿Qué día hice más compras el mes pasado?",
        "¿Qué gastos tuve el 10 de julio?",
        "¿Qué movimientos tuve el 20/08/2026?",
        "¿Qué ingresos tuve este mes?",
        "¿Cuál fue mi mayor ingreso este mes?",
        "¿Cuántas compras hice la semana pasada?",
    ]
    missing = [
        q for q in questions
        if TransactionQueryEngine.answer(q, transactions, today=date(2026, 8, 26)) is None
    ]
    assert not missing, missing


def test_period_specific_answers_do_not_mix_dates():
    transactions = [
        {"fecha": "2026-07-10", "descripcion": "Supermercado julio", "monto": 100, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-25", "descripcion": "Restaurante", "monto": 80, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-26", "descripcion": "Notebook", "monto": 1299, "tipo": "GASTO", "categoria": "Tecnología"},
    ]
    last_month = TransactionQueryEngine.answer(
        "¿Cuál fue mi compra más cara el mes pasado?", transactions, today=date(2026, 8, 26)
    )
    assert last_month is not None
    assert "Supermercado julio" in last_month.content
    assert "Notebook" not in last_month.content

    exact = TransactionQueryEngine.answer(
        "¿Qué gastos tuve el 10 de julio?", transactions, today=date(2026, 8, 26)
    )
    assert exact is not None
    assert "Supermercado julio" in exact.content
    assert "Notebook" not in exact.content


def test_latest_five_movements_are_listed():
    transactions = [
        {"fecha": f"2026-08-{day:02d}", "descripcion": f"Movimiento {day}", "monto": day, "tipo": "GASTO", "categoria": "Otros"}
        for day in range(1, 8)
    ]
    result = TransactionQueryEngine.answer(
        "¿Cuáles fueron mis últimos cinco movimientos?", transactions, today=date(2026, 8, 7)
    )
    assert result is not None
    assert result.action == "movements_latest_five"
    assert "Movimiento 7" in result.content
    assert "Movimiento 3" in result.content
    assert "Movimiento 2" not in result.content


def test_day_before_yesterday_accepts_separated_and_joined_variants():
    transactions = [
        {"fecha": "2026-08-01", "descripcion": "Supermercado", "monto": 125, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-02", "descripcion": "Alquiler", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
    ]

    for question in ("cuanto gaste anteayer", "cuanto gaste antes de ayer", "cuanto gaste antesdeayer"):
        result = TransactionQueryEngine.answer(question, transactions, today=date(2026, 8, 3))
        assert result is not None, question
        assert result.action == "expenses_total_day_before_yesterday", question
        assert "$125,00" in result.content, question
        assert "anteayer" in result.content.lower(), question


def test_single_movement_uses_singular_noun():
    transactions = [
        {"fecha": "2026-08-02", "descripcion": "Alquiler", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
    ]
    result = TransactionQueryEngine.answer("cuanto gaste ayer", transactions, today=date(2026, 8, 3))
    assert result is not None
    assert "1 movimiento" in result.content
    assert "1 movimientos" not in result.content


def test_contextual_previous_day_after_anteayer():
    transactions = [
        {"fecha": "2026-07-31", "descripcion": "Farmacia", "monto": 75, "tipo": "GASTO", "categoria": "Salud"},
        {"fecha": "2026-08-01", "descripcion": "Supermercado", "monto": 125, "tipo": "GASTO", "categoria": "Alimentación"},
        {"fecha": "2026-08-02", "descripcion": "Alquiler", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
    ]

    result = TransactionQueryEngine.answer(
        "¿Y el día anterior a ese?",
        transactions,
        today=date(2026, 8, 3),
        previous_answer="Gastaste $125,00 anteayer en 1 movimiento.",
    )

    assert result is not None
    assert result.action == "expenses_specific_date_total"
    assert "31/07/2026" in result.content
    assert "$75,00" in result.content


def test_contextual_previous_day_uses_explicit_date_from_previous_answer():
    transactions = [
        {"fecha": "2026-08-19", "descripcion": "Transporte", "monto": 20, "tipo": "GASTO", "categoria": "Transporte"},
        {"fecha": "2026-08-20", "descripcion": "Internet", "monto": 48, "tipo": "GASTO", "categoria": "Servicios"},
    ]

    result = TransactionQueryEngine.answer(
        "¿Y un día antes?",
        transactions,
        today=date(2026, 8, 26),
        previous_answer="Gastaste $48,00 el 20/08/2026 en 1 movimiento.",
    )

    assert result is not None
    assert "19/08/2026" in result.content
    assert "$20,00" in result.content


def test_contextual_next_day_is_supported():
    transactions = [
        {"fecha": "2026-08-02", "descripcion": "Alquiler", "monto": 950, "tipo": "GASTO", "categoria": "Vivienda"},
        {"fecha": "2026-08-03", "descripcion": "Comida", "monto": 30, "tipo": "GASTO", "categoria": "Alimentación"},
    ]

    result = TransactionQueryEngine.answer(
        "¿Y al día siguiente?",
        transactions,
        today=date(2026, 8, 3),
        previous_answer="Gastaste $950,00 el 02/08/2026 en 1 movimiento.",
    )

    assert result is not None
    assert "03/08/2026" in result.content
    assert "$30,00" in result.content


def test_specific_month_expense_total_uses_requested_month_not_average():
    result = TransactionQueryEngine.answer(
        "cuanto fue mi gasto en julio 2026",
        TX,
        today=date(2026, 8, 2),
    )
    assert result is not None
    assert result.action == "expenses_specific_month_total"
    assert "$5.000,00" in result.content
    assert "julio de 2026" in result.content
    assert "promedio" not in result.content.casefold()


def test_contextual_month_confirmation():
    result = TransactionQueryEngine.answer(
        "eso es de julio?",
        TX,
        today=date(2026, 8, 2),
        previous_answer="Gastaste $5.000,00 en julio de 2026 en 1 movimiento.",
    )
    assert result is not None
    assert result.action == "contextual_month_confirmation"
    assert "Sí" in result.content
    assert "julio de 2026" in result.content
