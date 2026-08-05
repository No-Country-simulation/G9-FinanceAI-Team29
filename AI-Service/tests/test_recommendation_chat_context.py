from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent.service import FinSightAgentService


RECOMMENDATION_PROMPT = """Perfil financiero: En riesgo.

Diagnóstico: Los gastos representan el 86.4 por ciento de los ingresos. Educación es la categoría de mayor consumo, con USD 12,172.71.

Acción sugerida: Revisar primero los movimientos de Educación y buscar una reducción gradual del 5% al 10%, sin afectar necesidades esenciales.

Objetivo: Llevar gradualmente los gastos totales por debajo del 75 por ciento de los ingresos.

Continúa desde esta recomendación, usa mis datos financieros actuales y no me pidas que repita el contexto.
"""


@pytest.mark.asyncio
async def test_recommendation_context_bypasses_transaction_summary() -> None:
    service = FinSightAgentService()
    service.llm.generate = AsyncMock()

    with patch("app.services.agent.service.fetch_user_transactions") as transactions:
        response = await service.chat("USR1005", RECOMMENDATION_PROMPT)

    transactions.assert_not_called()
    service.llm.generate.assert_not_awaited()
    assert response.provider == "internal"
    assert response.metadata["route"] == "recommendation_context"
    assert response.metadata["recommendation_origin"] is True
    assert response.metadata["intent"] == "recommendations"
    assert "perfil financiero se encuentra en riesgo" in response.content
    assert "Educación" in response.content
    assert "86.4%" in response.content
    assert "$12,172.71" in response.content
    assert "USD" not in response.content
    assert ".." not in response.content
    assert "asesor financiero" in response.content
    assert "Este mes registraste" not in response.content
