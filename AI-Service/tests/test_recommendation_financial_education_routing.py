from unittest.mock import AsyncMock

import pytest

from app.services.agent.service import FinSightAgentService


@pytest.mark.asyncio
async def test_financial_education_bypasses_stale_support_follow_up():
    service = FinSightAgentService()
    service.llm.generate = AsyncMock()
    service.llm.generate.return_value.content = "Explicación educativa"
    service.llm.generate.return_value.provider = "test"
    service.llm.generate.return_value.metadata = {}

    response = await service.chat(
        usuario_id="USR1000",
        question="¿Qué es el interés compuesto?",
        previous_answer="Vamos a revisar el problema técnico. ¿Puedo ayudarte con algo más?",
    )

    assert response.provider == "test"
    assert response.metadata["intent"] == "financial_education"
    assert response.metadata["route"] == "llm_without_context"
    assert response.metadata["used_financial_context"] is False
    service.llm.generate.assert_awaited_once()
