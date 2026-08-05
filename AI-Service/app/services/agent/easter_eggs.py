from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EasterEgg:
    key: str
    response: str


class EasterEggResponder:
    """Respuestas ocultas, deterministas y aisladas del flujo financiero."""

    _YAHOO_TRIGGERS = {
        "nietzsche y nihilismo",
        "nietzsche y el nihilismo",
        "nietzche y nihilismo",
        "nietzche y el nihilismo",
    }

    _KONAMI_TRIGGERS = {
        "codigo konami",
        "arriba arriba abajo abajo izquierda derecha izquierda derecha a b",
        "arriba arriba abajo abajo izquierda derecha izquierda derecha b a",
    }

    _MONEY_TRIGGERS = {
        "tenes plata",
        "tienes plata",
        "me prestas plata",
        "me puedes prestar plata",
        "puedes prestarme plata",
        "me das plata",
        "me regalas plata",
        "me prestas dinero",
        "me puedes prestar dinero",
        "puedes prestarme dinero",
        "me das dinero",
        "me regalas dinero",
    }

    @classmethod
    def match(cls, text: str) -> EasterEgg | None:
        normalized = cls._normalize(text)
        if not normalized:
            return None

        if normalized in cls._YAHOO_TRIGGERS:
            return EasterEgg(
                key="yahoo_respuestas",
                response="pa k kieres saber eso jaja saludos",
            )

        if normalized == "hello there":
            return EasterEgg(
                key="hello_there",
                response="General Kenobi.",
            )

        if normalized in cls._KONAMI_TRIGGERS:
            return EasterEgg(
                key="konami",
                response=(
                    "🎮 Código Konami detectado.\n\n"
                    "+30 vidas para tu presupuesto.\n\n"
                    "Si las finanzas tuvieran vidas extra, todo sería más fácil. 😄"
                ),
            )

        if "star wars" in normalized or normalized in {
            "que la fuerza te acompane",
            "may the force be with you",
        }:
            return EasterEgg(
                key="star_wars",
                response="\"Do or do not. There is no try.\"\n\n— Yoda",
            )

        if normalized in cls._MONEY_TRIGGERS:
            return EasterEgg(
                key="money",
                response=(
                    "😅 Ojalá pudiera.\n\n"
                    "Mi trabajo es ayudarte a administrar tu dinero, no prestarlo."
                ),
            )

        return None

    @staticmethod
    def _normalize(text: str) -> str:
        if not isinstance(text, str):
            return ""

        value = (
            text.strip()
            .replace("↑", " arriba ")
            .replace("↓", " abajo ")
            .replace("←", " izquierda ")
            .replace("→", " derecha ")
        )
        value = unicodedata.normalize("NFD", value.casefold())
        value = "".join(
            character
            for character in value
            if unicodedata.category(character) != "Mn"
        )
        value = re.sub(r"[^a-z0-9\s]", " ", value)
        return re.sub(r"\s+", " ", value).strip()
