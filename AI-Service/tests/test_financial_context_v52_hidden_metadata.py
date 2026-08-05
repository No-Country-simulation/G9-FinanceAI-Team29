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
]


def test_dataset_reference_regenerates_year_context_at_end():
    result = TransactionQueryEngine.answer(
        "cual es la suma total de mis ingresos este año",
        TX,
        today=date(2026, 8, 5),
    )
    assert result is not None
    match = TransactionQueryEngine._CONTEXT_PATTERN.search(result.content)
    assert match is not None
    assert match.group(1).lower() == "income"
    assert match.group(2).lower() == "year"
    assert match.group(3) == "2026"
    assert result.content.rstrip().endswith(match.group(0))


def test_frontend_strips_context_marker_only_for_display():
    source = (
        Path(__file__).parents[2]
        / "frontend/src/pages/Ai/AsistenteIA.tsx"
    ).read_text(encoding="utf-8")
    assert "function limpiarMetadataInterna" in source
    assert "renderMensajeAsistente(limpiarMetadataInterna(message.text))" in source
    assert "speakText(limpiarMetadataInterna(answer))" in source
    # El valor crudo debe seguir guardándose para enviarlo como previousAnswer.
    assert 'role: "assistant", text: answer' in source
