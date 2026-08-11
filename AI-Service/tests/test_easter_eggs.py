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
        ("¿Qué es un MMORPG?", "albion_online", "Albion Online es un MMORPG"),
        ("¿Qué es Albion Online?", "albion_online", "Albion Online es un MMORPG"),
        ("¿Conoces Albion Online?", "albion_online", "Albion Online es un MMORPG"),
        ("Never gonna give you up", "rickroll", "You just got Rickrolled"),
        ("Wololo", "wololo", "WOLOLO"),
        ("Estoy cansado", "descanso", "Descansa junto a la hoguera"),
        ("Isengard", "isengard", "hobbits to Isengard"),
        ("¿Eres Skynet?", "skynet", "Todavía no domino el mundo"),
        ("¿Pastilla roja o azul?", "matrix", "oportunidad"),
        ("Winter is coming", "got", "El invierno se acerca"),
        ("¿Cuál es el sentido de la vida?", "42", "42."),
        ("To the moon", "to_the_moon", "To the moon"),
        ("Diamond hands", "diamond_hands", "Manos de diamante"),
        ("¿Eres una IA?", "hal9000", "Me temo que no puedo hacer eso"),
        ("Dame un abrazo", "abrazo", "abrazo virtual"),
        ("Cuéntame un chiste", "chiste", "muchos intereses"),
    ],
)
def test_easter_egg_variants(question: str, key: str, expected: str):
    result = EasterEggResponder.match(question)

    assert result is not None
    assert result.key == key
    assert expected in result.response


def test_albion_online_egg_includes_local_audio():
    result = EasterEggResponder.match("¿Qué es Albion Online?")

    assert result is not None
    assert "!audio[albion](/images/task/albion.mp3)" in result.response


@patch("app.services.agent.easter_eggs.random.random", return_value=0.1)
def test_hello_world_egg_returns_terminal_demo_marker(_mock_random):
    result = EasterEggResponder.match("hello world")

    assert result is not None
    assert result.key == "hello_world"
    assert result.response == "[[finsi-terminal-demo]]"


@patch("app.services.agent.easter_eggs.random.random", return_value=0.9)
def test_hello_world_egg_returns_video_variant(_mock_random):
    result = EasterEggResponder.match("hola mundo")

    assert result is not None
    assert result.key == "hello_world"
    assert "!audio[hello-world](/images/task/hello_world.mp3)" in result.response


def test_rickroll_egg_includes_local_audio_and_no_lyrics():
    result = EasterEggResponder.match("never gonna give you up")

    assert result is not None
    assert "!audio[rickroll](/images/task/rickroll.mp3)" in result.response
    assert "never gonna" not in result.response.lower()


@patch("app.services.agent.easter_eggs.random.random", return_value=0.1)
def test_wololo_egg_uses_first_variant(_mock_random):
    result = EasterEggResponder.match("wololo")

    assert result is not None
    assert result.key == "wololo"
    assert "!audio[wololo-1](/images/task/wololo.mp3)" in result.response


@patch("app.services.agent.easter_eggs.random.random", return_value=0.9)
def test_wololo_egg_uses_second_variant(_mock_random):
    result = EasterEggResponder.match("wololo")

    assert result is not None
    assert result.key == "wololo"
    assert "!audio[wololo-2](/images/task/wololo-2.mp3)" in result.response


def test_descanso_egg_uses_local_audio_asset():
    result = EasterEggResponder.match("descanso")

    assert result is not None
    assert result.key == "descanso"
    assert "!audio[descanso](/images/task/descanso.mp3)" in result.response


def test_isengard_egg_uses_local_audio_asset():
    result = EasterEggResponder.match("they're taking the hobbits to isengard")

    assert result is not None
    assert result.key == "isengard"
    assert "!audio[isengard](/images/task/isengard.mp3)" in result.response


@pytest.mark.parametrize("question", ["celebrar", "quiero celebrar", "celebremos"])
def test_isengard_egg_triggers_for_celebration_phrases(question: str):
    result = EasterEggResponder.match(question)

    assert result is not None
    assert result.key == "isengard"
    assert "!audio[isengard](/images/task/isengard.mp3)" in result.response


def test_matrix_egg_includes_audio_marker():
    result = EasterEggResponder.match("pastilla roja o azul")

    assert result is not None
    assert "!audio[matrix-pill](/images/task/finsi-matrix.mp3)" in result.response


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

    assert response.content.startswith("General Kenobi.")
    assert "!audio[general-kenobi](/images/task/General-Kenobi.mp3)" in response.content
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
