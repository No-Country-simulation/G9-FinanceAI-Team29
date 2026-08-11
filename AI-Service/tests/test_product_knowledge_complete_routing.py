from unittest.mock import AsyncMock

import pytest

from app.services.agent.service import FinSightAgentService
from app.services.support.product_knowledge import ProductKnowledgeResponder


@pytest.mark.parametrize(
    ("question", "topic"),
    [
        ("Que es TwentyNineDevs", "about_team"),
        ("twentyninedevs", "about_team"),
        ("Quienes son TwentyNineDevs", "about_team"),
        ("Como funciona la IA", "assistant_capabilities"),
        ("Como funciona Finsi", "assistant_capabilities"),
        ("Que significa perfil en observacion", "observation_profile"),
        ("Que significa perfil saludable", "healthy_profile"),
        ("Como activo la autenticacion en dos pasos", "two_factor_unavailable"),
        ("Como cambio mi PIN", "pin_unavailable"),
        ("Donde veo mis sesiones activas", "sessions_list_unavailable"),
    ],
)
def test_product_knowledge_recognizes_real_questions(question: str, topic: str):
    result = ProductKnowledgeResponder.answer(question)
    assert result is not None
    assert result.topic == topic


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("question", "route"),
    [
        ("Que es TwentyNineDevs", "support_product_about_team"),
        ("twentyninedevs", "support_product_about_team"),
        ("Como funciona la IA", "support_product_assistant_capabilities"),
        ("Como funciona Finsi", "support_product_assistant_capabilities"),
    ],
)
async def test_agent_routes_short_product_questions_before_unknown(question: str, route: str):
    service = FinSightAgentService()
    service.llm.generate = AsyncMock(side_effect=AssertionError("No debe invocar al LLM"))
    response = await service.chat(usuario_id="USR1000", question=question)
    assert response.provider == "internal"
    assert response.metadata["route"] == route


@pytest.mark.asyncio
async def test_explicit_goal_problem_still_routes_to_support():
    service = FinSightAgentService()
    response = await service.chat(usuario_id="USR1000", question="No puedo crear una meta")
    assert response.metadata["route"] == "support_goal_create_triage"
    assert "¿Qué ocurre" in response.content
