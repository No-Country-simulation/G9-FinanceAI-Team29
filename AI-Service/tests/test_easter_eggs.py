import asyncio
from unittest.mock import patch

import pytest

from app.services.agent.easter_eggs import EasterEggResponder
from app.services.agent.service import FinSightAgentService


@pytest.mark.parametrize(
    ("question", "key", "expected"),
    [
        ("Nietzsche y el nihilismo?", "yahoo_respuestas", "pa k kieres saber eso jaja saludos"),
        ("Nietzche y el nihilismo", "yahoo_respuestas", "pa k kieres saber eso jaja saludos"),
        ("Hello therE", "hello_there", "General Kenobi."),
        (
            "arriba arriba abajo abajo izquierda derecha izquierda derecha A B",
            "konami",
            "Código Konami detectado",
        ),
        ("↑ ↑ ↓ ↓ ← → ← → B A", "konami", "Código Konami detectado"),
        ("¿Qué opinas de Star Wars?", "star_wars", "Do or do not"),
        ("¿Me puedes prestar plata?", "money", "Ojalá pudiera"),
    ],
)
def test_easter_egg_variants(question: str, key: str, expected: str):
    result = EasterEggResponder.match(question)

    assert result is not None
    assert result.key == key
    assert expected in result.response


@pytest.mark.parametrize(
    "question",
    [
        "cuánto gasté este año",
        "tengo un préstamo",
        "quiero ahorrar plata",
        "qué es el nihilismo",
        "hola",
    ],
)
def test_normal_queries_are_not_captured(question: str):
    assert EasterEggResponder.match(question) is None


def test_service_returns_before_existing_pipeline():
    service = FinSightAgentService.__new__(FinSightAgentService)

    with patch.object(
        FinSightAgentService,
        "_prepare_query",
        side_effect=AssertionError("El pipeline existente no debe ejecutarse."),
    ):
        response = asyncio.run(
            service.chat(
                usuario_id="USR1",
                question="Hello there",
                previous_answer=None,
            )
        )

    assert response.content == "General Kenobi."
    assert response.model == "easter-egg"
    assert response.metadata["intent"] == "easter_egg"
    assert response.metadata["save_history"] is False
    assert response.metadata["update_context"] is False


def test_easter_egg_preserves_hidden_financial_marker():
    marker = (
        "<!-- finsi-financial-context metric=income granularity=year "
        "year=2025 month=none position=none -->"
    )
    service = FinSightAgentService.__new__(FinSightAgentService)

    response = asyncio.run(
        service.chat(
            usuario_id="USR1",
            question="Hello there",
            previous_answer=f"Ingresaste $10.000 en 2025.\n\n{marker}",
        )
    )

    assert response.content.startswith("General Kenobi.")
    assert marker in response.content
    assert response.metadata["update_context"] is False
