from datetime import date

from app.services.agent.transaction_queries import TransactionQueryEngine

TODAY = date(2026, 8, 20)
TX = [
    {"tipo": "INGRESO", "monto": 200000, "fecha": "2026-08-01", "categoria": "Sueldo", "descripcion": "Sueldo agosto", "medio_pago": "Transferencia bancaria", "recurrente": "Sí"},
    {"tipo": "INGRESO", "monto": 25000, "fecha": "2026-08-10", "categoria": "Otros ingresos", "descripcion": "Trabajo independiente", "medio_pago": "Transferencia bancaria", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 30000, "fecha": "2026-08-02", "categoria": "Alimentación", "descripcion": "Supermercado", "medio_pago": "Tarjeta de débito", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 15000, "fecha": "2026-08-05", "categoria": "Entretenimiento", "descripcion": "Cine", "medio_pago": "Tarjeta de crédito", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 50000, "fecha": "2026-08-12", "categoria": "Alimentación", "descripcion": "Restaurante", "medio_pago": "Tarjeta de crédito", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 10000, "fecha": "2026-08-15", "categoria": "Transporte", "descripcion": "SUBE", "medio_pago": "Tarjeta de débito", "recurrente": "Sí"},
    {"tipo": "GASTO", "monto": 12000, "fecha": "2026-08-03", "categoria": "Servicios", "descripcion": "Internet", "medio_pago": "Tarjeta de crédito", "recurrente": "Sí"},
    {"tipo": "INGRESO", "monto": 180000, "fecha": "2026-07-01", "categoria": "Sueldo", "descripcion": "Sueldo julio", "medio_pago": "Transferencia bancaria", "recurrente": "Sí"},
    {"tipo": "GASTO", "monto": 22000, "fecha": "2026-07-02", "categoria": "Alimentación", "descripcion": "Supermercado", "medio_pago": "Tarjeta de débito", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 30000, "fecha": "2026-07-10", "categoria": "Transporte", "descripcion": "Taxi", "medio_pago": "Tarjeta de crédito", "recurrente": "No"},
    {"tipo": "GASTO", "monto": 5000, "fecha": "2025-08-10", "categoria": "Impuestos", "descripcion": "Impuesto", "medio_pago": "Transferencia bancaria", "recurrente": "No"},
]

SUPPORTED = [
    "¿Cuánto gasté hoy?", "¿Cuánto gasté esta semana?", "¿Cuánto gasté este mes?",
    "¿Cuánto gasté este año?", "¿Cuánto gasté el mes pasado?",
    "¿Cuánto gasto en promedio por mes?", "¿Cuánto gasto por día?",
    "¿Qué día tuve más gastos?", "¿Qué día gasté menos?",
    "¿Cuál fue mi compra más cara?", "¿Cuál fue mi compra más barata?",
    "¿Cuál fue el gasto más reciente?", "¿En qué categoría gasto más?",
    "¿Cuál es mi segunda categoría con más gastos?", "¿Cuánto gasté en comida?",
    "¿Cuánto gasté en transporte?", "¿Gasté más este mes que el anterior?",
    "¿Gasté más este año que el pasado?", "¿Qué categoría aumentó más?",
    "¿Qué categoría reduje más?", "¿Cuál fue mi mes con más gastos?",
    "¿Cuál fue mi mes con menos gastos?", "¿Qué día de la semana gasto más?",
    "¿Qué día de la semana gasto menos?", "¿Qué medio de pago uso más?",
    "¿Cuántas compras hice este mes?", "¿Cuántos gastos tuve esta semana?",
    "¿Tengo gastos recurrentes?", "¿Cuánto ingresé este mes?",
    "¿Cuánto ingresé este año?", "¿Cuánto ingresé hoy?",
    "¿Cuánto ingresé esta semana?", "¿Cuál fue mi mayor ingreso?",
    "¿Cuál fue mi último ingreso?", "¿Cuál fue mi ingreso promedio?",
    "¿Mis ingresos crecieron?", "¿Qué mes tuve más ingresos?",
    "¿Qué mes tuve menos ingresos?", "¿Mis ingresos son estables?",
    "¿Cuál es mi principal fuente de ingresos?", "¿Cuánto ahorré este mes?",
    "¿Cuánto ahorré este año?", "¿Qué mes ahorré más?",
    "¿Qué mes ahorré menos?", "¿Estoy ahorrando más que antes?",
    "¿Qué porcentaje de mis ingresos ahorro?", "¿Cómo está mi salud financiera?",
    "¿Estoy gastando demasiado?", "¿Mis gastos son sostenibles?",
    "¿Qué puedo mejorar?", "¿Qué gastos podría reducir?",
    "¿Dónde estoy perdiendo más dinero?", "¿Qué categoría debería controlar?",
    "¿Estoy viviendo por encima de mis posibilidades?", "¿Cuál fue mi mejor mes?",
    "¿Cuál fue mi peor mes?", "¿Cuál fue mi promedio de gastos?",
    "¿Cuál fue mi promedio de ingresos?", "¿Cuál fue mi balance promedio?",
    "¿Cuál fue mi mayor ahorro?", "¿Cuál fue mi mayor déficit?",
    "¿Qué hice financieramente este mes?", "¿Qué pasó el mes pasado?",
    "¿Cómo cerré el año pasado?", "¿Qué movimientos tuve ayer?",
    "¿Qué movimientos tuve esta semana?", "¿Qué movimientos tuve hoy?",
    "¿Cómo estuvieron mis finanzas este mes?", "Si sigo así, ¿cómo voy a terminar el mes?",
    "¿Detectaste gastos inusuales?", "¿Qué debería hacer hoy?",
]

UNSUPPORTED_BY_DATASET = [
    "¿Qué deuda vence primero?",
    "¿En qué horario suelo gastar?",
    "¿Qué suscripciones tengo?",
    "¿Cuánto gasto en suscripciones?",
    "¿Qué porcentaje representa mi sueldo?",
    "¿Cuánto ingresé por trabajos extra?",
    "¿Cuánto me falta para mi meta?",
    "¿En cuánto tiempo llegaré a mi meta?",
]

def test_supported_catalog_is_handled():
    missing = [q for q in SUPPORTED if TransactionQueryEngine.answer(q, TX, today=TODAY, analysis={"perfilFinanciero": "Saludable", "score": 80}) is None]
    assert not missing, missing

def test_dataset_unsupported_queries_are_not_claimed_by_transaction_engine():
    wrongly_claimed = [q for q in UNSUPPORTED_BY_DATASET if TransactionQueryEngine.answer(q, TX, today=TODAY) is not None]
    assert not wrongly_claimed, wrongly_claimed
