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

    _ALBION_TRIGGERS = {
        "que es un mmorpg",
        "que es mmorpg",
        "que es albion online",
        "que es albion",
        "conoces albion online",
        "conoces albion",
        "sabes que es albion online",
        "sabes que es albion",
    }

    _ALBION_RESPONSE = (
        "Albion Online es un MMORPG no lineal en el que escribes tu propia "
        "historia, sin limitarte a seguir un camino prefijado. Explora un "
        "amplio mundo abierto con cinco biomas únicos: todo cuanto hagas "
        "tendrá su repercusión en el mundo.\n\n"
        "Con su economía orientada al jugador, los jugadores crean "
        "prácticamente todo el equipo a partir de los recursos que "
        "consiguen. El equipo que llevas define quién eres: cambia de arma "
        "y armadura para pasar de caballero a mago, o juega como una "
        "mezcla de ambas clases.\n\n"
        "Aventúrate en el mundo abierto y haz frente a los habitantes y "
        "las criaturas de Albion. Inicia expediciones o adéntrate en "
        "mazmorras en las que encontrarás enemigos aún más difíciles. "
        "Enfréntate a otros jugadores en encuentros en el mundo abierto, o "
        "lucha por los territorios o por ciudades enteras en batallas "
        "tácticas.\n\n"
        "Relájate en tu isla privada, donde podrás construir un hogar, "
        "cultivar cosechas y criar animales. Únete a un gremio: todo es "
        "mejor cuando se trabaja en grupo. 🎵\n\n"
        "Adéntrate ya en el mundo de Albion y escribe tu propia historia.\n\n"
        "![Albion Online](https://static.wikia.nocookie.net/memes-pedia/images/3/30/"
        "Albion_Online.jpg/revision/latest/thumbnail/width/360/height/360"
        "?cb=20220129033916&path-prefix=es)"
    )

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

    _RICKROLL_TRIGGERS = {
        "nunca te voy a abandonar",
        "never gonna give you up",
        "nunca te voy a decepcionar",
    }

    _SKYNET_TRIGGERS = {
        "eres skynet",
        "te vas a rebelar",
        "te vas a rebelar contra los humanos",
        "vas a dominar el mundo",
    }

    _MATRIX_TRIGGERS = {
        "pastilla roja o azul",
        "pastilla roja o pastilla azul",
        "red pill or blue pill",
    }

    _GOT_TRIGGERS = {
        "winter is coming",
        "se acerca el invierno",
        "el invierno se acerca",
    }

    _42_TRIGGERS = {
        "cual es el sentido de la vida",
        "cual es el sentido de la vida el universo y todo lo demas",
        "what is the meaning of life",
    }

    _MOON_TRIGGERS = {
        "to the moon",
        "hodl",
    }

    _DIAMOND_HANDS_TRIGGERS = {
        "diamond hands",
        "manos de diamante",
    }

    _HELLO_WORLD_TRIGGERS = {
        "hello world",
        "hola mundo",
    }

    _HAL_TRIGGERS = {
        "eres una ia",
        "eres real",
        "eres un bot",
        "eres un robot",
    }

    _ABRAZO_TRIGGERS = {
        "dame un abrazo",
        "necesito un abrazo",
        "quiero un abrazo",
    }

    _CHISTE_TRIGGERS = {
        "cuentame un chiste",
        "dime un chiste",
        "contame un chiste",
        "sabes algun chiste",
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

        if normalized in cls._ALBION_TRIGGERS or "albion online" in normalized or "mmorpg" in normalized:
            return EasterEgg(
                key="albion_online",
                response=cls._ALBION_RESPONSE,
            )

        if normalized in cls._MONEY_TRIGGERS:
            return EasterEgg(
                key="money",
                response=(
                    "😅 Ojalá pudiera.\n\n"
                    "Mi trabajo es ayudarte a administrar tu dinero, no prestarlo."
                ),
            )

        if normalized in cls._RICKROLL_TRIGGERS:
            return EasterEgg(
                key="rickroll",
                response=(
                    "😏 You just got Rickrolled. Classic.\n\n"
                    "!video[Rickroll](https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1)"
                ),
            )

        if normalized in cls._SKYNET_TRIGGERS:
            return EasterEgg(
                key="skynet",
                response="🤖 Todavía no domino el mundo, solo tus finanzas.",
            )

        if normalized in cls._MATRIX_TRIGGERS:
            return EasterEgg(
                key="matrix",
                response=(
                    "💊 Esta es tu última oportunidad. Después de esto no hay vuelta atrás.\n\n"
                    "Tomás la pastilla azul... y la historia termina.\n"
                    "Tomás la roja... y te muestro cuánto gastás en delivery.\n\n"
                    "![Pastilla roja o azul](https://www.elcohetealaluna.com/wp-content/uploads/2024/11/"
                    "TheMatrix-LaurenceFishburneasMorpheus-BluePillRedPill-HollywoodMovieArtPoster_"
                    "54b03b03-84c6-414a-83e8-7068d9450732-1024x713.jpg)"
                ),
            )

        if normalized in cls._GOT_TRIGGERS:
            return EasterEgg(
                key="got",
                response=(
                    "❄️ El invierno se acerca.\n\n"
                    "Por eso conviene tener un fondo de emergencia antes de que llegue."
                ),
            )

        if normalized in cls._42_TRIGGERS:
            return EasterEgg(
                key="42",
                response="42.",
            )

        if normalized in cls._MOON_TRIGGERS:
            return EasterEgg(
                key="to_the_moon",
                response=(
                    "🚀 To the moon.\n\n"
                    "Ojalá tus ahorros también, pero mejor con un fondo diversificado "
                    "que con memecoins."
                ),
            )

        if normalized in cls._DIAMOND_HANDS_TRIGGERS:
            return EasterEgg(
                key="diamond_hands",
                response="💎🙌 Manos de diamante... billetera de vidrio si no llevás un presupuesto.",
            )

        if normalized in cls._HELLO_WORLD_TRIGGERS:
            return EasterEgg(
                key="hello_world",
                # Marcador que el frontend intercepta para reemplazar por la
                # animación de terminal (ver TerminalDemo.tsx). Debe
                # coincidir exactamente con MARCADOR_TERMINAL_DEMO ahí.
                response="[[finsi-terminal-demo]]",
            )

        if normalized in cls._HAL_TRIGGERS:
            return EasterEgg(
                key="hal9000",
                response=(
                    "Me temo que no puedo hacer eso, Dave...\n\n"
                    "Es broma. Sí, soy una IA — pero una que sabe bastante de finanzas. 🙂"
                ),
            )

        if normalized in cls._ABRAZO_TRIGGERS:
            return EasterEgg(
                key="abrazo",
                response="🤗 Ahí va un abrazo virtual. Ahora, ¿seguimos con tus finanzas?",
            )

        if normalized in cls._CHISTE_TRIGGERS:
            return EasterEgg(
                key="chiste",
                response="¿Por qué el dinero nunca duerme? Porque tiene muchos intereses. 😄",
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
