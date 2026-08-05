import importlib.util
from pathlib import Path

import pandas as pd


def _load_profile_module():
    path = Path(__file__).resolve().parents[1] / "app" / "profile.py"
    spec = importlib.util.spec_from_file_location("profile_recommendations_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_structured_recommendations_are_actionable():
    profile = _load_profile_module()
    row = pd.Series({
        "ratio_gasto_ingreso_calculado": 0.86,
        "ratio_deuda_ingreso_calculado": 0.10,
        "ratio_ahorro_ingreso_calculado": 0.04,
        "cantidad_recurrentes": 5,
    })
    recs = profile.generar_recomendaciones(
        row,
        [{"categoria": "Vivienda", "monto": 1200, "porcentaje": 42}],
        "En observación",
    )
    assert recs[0]["prioridad"] == "alta"
    assert all(recs[0][field] for field in ("titulo", "diagnostico", "accion", "objetivo"))
    assert "Vivienda" in recs[0]["pregunta_finsi"]
    assert "asesor financiero" in recs[0]["advertencia"]


def test_latam_money_aliases_route_correctly():
    from app.services.agent.intent import IntentDetector, Intent

    detector = IntentDetector()
    assert detector.detect("donde se me va la feria") == Intent.EXPENSES
    assert detector.detect("cuanta lana me ingreso") == Intent.INCOME
