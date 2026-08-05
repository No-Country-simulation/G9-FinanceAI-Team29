from datetime import date
import re
import sys
import types
import unicodedata

# El ZIP es un parche y no contiene todo el proyecto. Este stub reproduce la
# normalización necesaria para probar el motor en aislamiento.
normalizer_module = types.ModuleType("app.services.agent.normalizer")

class QueryNormalizer:
    @staticmethod
    def normalize(value: str | None) -> str:
        text = unicodedata.normalize("NFD", value or "")
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9$%]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

normalizer_module.QueryNormalizer = QueryNormalizer
sys.modules.setdefault("app.services.agent.normalizer", normalizer_module)

from app.services.agent.transaction_queries import TransactionQueryEngine


TRANSACTIONS = [
    {"fecha": "2026-06-10", "monto": 1000, "tipo": "Ingreso", "descripcion": "Sueldo junio", "categoria": "Sueldo"},
    {"fecha": "2026-05-10", "monto": 900, "tipo": "Ingreso", "descripcion": "Sueldo mayo", "categoria": "Sueldo"},
    {"fecha": "2026-04-10", "monto": 800, "tipo": "Ingreso", "descripcion": "Sueldo abril", "categoria": "Sueldo"},
    {"fecha": "2025-06-10", "monto": 700, "tipo": "Ingreso", "descripcion": "Sueldo 2025", "categoria": "Sueldo"},
    {"fecha": "2026-06-11", "monto": 500, "tipo": "Gasto", "descripcion": "Curso", "categoria": "Educación"},
    {"fecha": "2026-05-11", "monto": 400, "tipo": "Gasto", "descripcion": "Alquiler", "categoria": "Vivienda"},
    {"fecha": "2026-04-11", "monto": 300, "tipo": "Gasto", "descripcion": "Supermercado", "categoria": "Alimentación"},
    {"fecha": "2025-05-11", "monto": 200, "tipo": "Gasto", "descripcion": "Viaje", "categoria": "Transporte"},
    {"fecha": "2026-03-11", "monto": 100, "tipo": "Gasto", "descripcion": "Medicamento", "categoria": "Salud"},
]
TODAY = date(2026, 7, 1)


def ask(question: str, previous: str | None = None):
    return TransactionQueryEngine.answer(
        question,
        TRANSACTIONS,
        today=TODAY,
        previous_answer=previous,
    )


def test_income_specific_month_then_previous_month():
    june = ask("cuanto ingrese en junio")
    assert june is not None
    assert "junio de 2026" in june.content
    assert "$1.000,00" in june.content

    may = ask("y el anterior", june.content)
    assert may is not None
    assert "mayo de 2026" in may.content
    assert "$900,00" in may.content

    april = ask("y el anterior", may.content)
    assert april is not None
    assert "abril de 2026" in april.content
    assert "$800,00" in april.content


def test_income_year_follow_up_previous_year():
    current = ask("cual es la suma total de mis ingresos este año")
    assert current is not None
    assert "2026" in current.content

    previous = ask("y el año anterior", current.content)
    assert previous is not None
    assert "2025" in previous.content
    assert "$700,00" in previous.content


def test_expense_year_follow_up_previous_year():
    current = ask("cual es la suma total de mis gastos este año")
    assert current is not None
    assert "2026" in current.content

    previous = ask("y el año anterior", current.content)
    assert previous is not None
    assert "2025" in previous.content
    assert "$200,00" in previous.content


def test_direct_specific_year_queries():
    expense = ask("cuanto gaste en 2025")
    assert expense is not None
    assert "2025" in expense.content
    assert "$200,00" in expense.content

    income = ask("cuanto ingrese en 2025")
    assert income is not None
    assert "2025" in income.content
    assert "$700,00" in income.content


def test_category_ranking_follow_ups():
    first = ask("cual es mi categoria con mas gastos")
    assert first is not None
    assert "Educación" in first.content

    second = ask("y la segunda", first.content)
    assert second is not None
    assert "número 2" in second.content
    assert "Vivienda" in second.content

    third = ask("y la tercera", second.content)
    assert third is not None
    assert "número 3" in third.content
    assert "Alimentación" in third.content
