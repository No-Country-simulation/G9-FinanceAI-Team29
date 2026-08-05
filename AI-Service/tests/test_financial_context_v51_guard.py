from datetime import date
import re
import sys
import types
import unicodedata
from pathlib import Path

normalizer_module = types.ModuleType("app.services.agent.normalizer")
class QueryNormalizer:
    @staticmethod
    def normalize(value):
        text = unicodedata.normalize("NFD", value or "")
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9$%]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()
normalizer_module.QueryNormalizer = QueryNormalizer
sys.modules.setdefault("app.services.agent.normalizer", normalizer_module)

from app.services.agent.transaction_queries import TransactionQueryEngine

TX = [
 {"fecha":"2026-06-10","monto":1000,"tipo":"Ingreso","descripcion":"Sueldo","categoria":"Sueldo"},
 {"fecha":"2025-06-10","monto":900,"tipo":"Ingreso","descripcion":"Sueldo","categoria":"Sueldo"},
 {"fecha":"2024-06-10","monto":800,"tipo":"Ingreso","descripcion":"Sueldo","categoria":"Sueldo"},
 {"fecha":"2026-06-11","monto":500,"tipo":"Gasto","descripcion":"Curso","categoria":"Educación"},
 {"fecha":"2025-06-11","monto":400,"tipo":"Gasto","descripcion":"Casa","categoria":"Vivienda"},
]
TODAY=date(2026,7,1)
def ask(q, prev=None): return TransactionQueryEngine.answer(q,TX,today=TODAY,previous_answer=prev)

def marker(answer):
    return TransactionQueryEngine._CONTEXT_PATTERN.search(answer.content).group(0)

def test_income_year_context_survives_noise_response():
    current=ask("cual es la suma total de mis ingresos este año")
    previous=ask("y el año anterior",current.content)
    filler="No pude interpretar ese mensaje. Puedes continuar.\n\n"+marker(previous)
    older=ask("y el año anterior",filler)
    assert "2024" in older.content
    assert "Ingresaste" in older.content
    assert "$800,00" in older.content

def test_expense_context_never_becomes_income_or_reverse():
    current=ask("cual es la suma total de mis gastos este año")
    filler="No pude interpretar ese mensaje.\n\n"+marker(current)
    previous=ask("y el año anterior",filler)
    assert "Gastaste" in previous.content
    assert "2025" in previous.content

def test_month_context_survives_noise():
    june=ask("cuanto ingrese en junio")
    filler="Mensaje accidental.\n\n"+marker(june)
    may=ask("y el anterior",filler)
    assert "mayo de 2026" in may.content
    assert "Ingresaste" in may.content

def test_rank_context_survives_noise():
    first=ask("cual es mi categoria con mas gastos")
    filler="Mensaje accidental.\n\n"+marker(first)
    second=ask("y la segunda",filler)
    assert "número 2" in second.content

def test_service_contains_context_guard_before_prepare_query():
    source=(Path(__file__).parents[1]/"app/services/agent/service.py").read_text(encoding="utf-8")
    guard=source.index("preserved_context = self._financial_context_marker")
    prepare=source.index("query = self._prepare_query(question)")
    assert guard < prepare
    assert '"gracias"' not in source[source.index("def _is_context_noise"):source.index("def _is_follow_up")]
