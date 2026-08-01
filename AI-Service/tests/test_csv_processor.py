from app.services.csv_processor import CSVValidationError, process_user_csv


def test_process_csv_generates_user_and_usd_transactions():
    content = (
        "fecha,descripcion,monto,tipo,categoria,medio_pago,recurrente\n"
        "2026-07-01,Sueldo,3000,INGRESO,Salario,Transferencia,Si\n"
        "2026-07-02,Supermercado,500,GASTO,Alimentacion,Tarjeta,No\n"
        "2026-07-03,Cuota,300,GASTO,Prestamos,Debito,Si\n"
    ).encode()

    result = process_user_csv(content, "USR1001")

    assert result.usuario["usuario_id"] == "USR1001"
    assert result.usuario["ingreso_mensual"] == 3000.0
    assert result.usuario["gasto_mensual_promedio"] == 500.0
    assert result.usuario["deuda_mensual"] == 300.0
    assert result.usuario["ahorro_mensual_estimado"] == 2200.0
    assert all(tx["moneda"] == "USD" for tx in result.transacciones)
    assert all(tx["origen"] == "CSV" for tx in result.transacciones)


def test_rejects_missing_columns():
    content = "fecha,monto\n2026-07-01,10\n".encode()

    try:
        process_user_csv(content, "USR1001")
    except CSVValidationError as error:
        assert "Faltan columnas obligatorias" in error.errors[0]
    else:
        raise AssertionError("Se esperaba CSVValidationError")
