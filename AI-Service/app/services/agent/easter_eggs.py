from __future__ import annotations

import random
import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class EasterEgg:
    key: str
    response: str


class EasterEggResponder:
    """Respuestas ocultas, deterministas y aisladas del flujo financiero."""

    _EXIT_TRIGGERS = {
        "exit",
    }

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
        "Adéntrate ya en el mundo de Albion y escribe tu propia historia."
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

    _WOLOLO_TRIGGERS = {
        "wololo",
        "wololoo",
        "wololooo",
        "wololoooo",
    }

    _DESCANSO_TRIGGERS = {
        "descanso",
        "descansar",
        "descansoo",
        "descansaar",
        "cansado",
        "cansada",
        "cansadoo",
        "cansadaa",
        "estoy cansado",
        "estoy cansada",
        "quiero descansar",
        "necesito descansar",
        "necesito un descanso",
        "quiero un descanso",
    }

    _ISENGARD_TRIGGERS = {
        "celebrar",
        "quiero celebrar",
        "vamos a celebrar",
        "celebremos",
        "isengard",
        "estan llevando a los hobbits a isengard",
        "they are taking the hobbits to isengard",
        "they re taking the hobbits to isengard",
        "theyre taking the hobbits to isengard",
        "taking the hobbits to isengard",
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
        "pildora roja o azul",
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

    _INFINITE_MONEY_TRIGGERS = {
           "infinite money glitch",
           "glitch de dinero infinito",
           "truco de dinero infinito",
           "truco para tener dinero infinito",
    }

    _MONGOLIA_SOUNDS = (
        "/images/task/tecnoMongol.mp3",
        "/images/task/canticoMongol.mp3",
    )

    _CTRL_Z_GASTOS_TRIGGERS = {
    # Forma principal
        "ctrl z mis gastos",
        "ctrl+z mis gastos",

    # Variantes naturales
        "ctrl z a mis gastos",
        "ctrl+z a mis gastos",
        "hacer ctrl z a mis gastos",
        "hacer ctrl+z a mis gastos",
        "puedo hacer ctrl z a mis gastos",
        "puedo hacer ctrl+z a mis gastos",

    # Sin espacios / tipeo rápido
        "ctrlz mis gastos",
        "ctrlz a mis gastos",

    # Typos frecuentes de ctrl
        "crtl z mis gastos",
        "crtl+z mis gastos",
        "crtl z a mis gastos",
        "crtl+z a mis gastos",

        "ctrrl z mis gastos",
        "ctrrl+z mis gastos",

    # Typos frecuentes de gastos
        "ctrl z mis gasto",
        "ctrl+z mis gasto",
        "ctrl z mis gastso",
        "ctrl+z mis gastso",
        "ctrl z mis gaastos",
        "ctrl+z mis gaastos",

    # Mezclas
        "crtl z mis gasto",
        "crtl+z mis gasto",
        "ctrlz mis gasto",
        "deshacer mis gastos",
        "desacer mis gastos",
    }

    _MEJORES_PRECIOS_TRIGGERS = {
    # Frases principales
        "como consigo mejores precios",
        "como puedo conseguir mejores precios",
        "como conseguir mejores precios",
        "donde consigo mejores precios",
        "donde puedo conseguir mejores precios",
        "como encuentro mejores precios",
        "como puedo encontrar mejores precios",
        "donde encuentro mejores precios",
        "donde puedo encontrar mejores precios",

        # Más barato / baratos
        "como consigo precios mas baratos",
        "como conseguir precios mas baratos",
        "como puedo conseguir precios mas baratos",
        "como encuentro precios mas baratos",
        "como puedo encontrar precios mas baratos",
        "donde encuentro precios mas baratos",
        "donde consigo precios mas baratos",
        "donde puedo conseguir precios mas baratos",
        "como compro mas barato",
        "como puedo comprar mas barato",
        "donde compro mas barato",
        "donde comprar mas barato",
        "como comprar barato",
        "donde comprar barato",

        # Pagar menos
        "como puedo pagar menos",
        "como pago menos",
        "como hago para pagar menos",
        "que hago para pagar menos",
        "como puedo gastar menos",
        "como hago para gastar menos",
        "quiero pagar menos",
        "quiero gastar menos",

        # Ahorrar comprando
        "como ahorro en mis compras",
        "como puedo ahorrar en mis compras",
        "como ahorrar en mis compras",
        "como hago para ahorrar en mis compras",
        "como puedo ahorrar comprando",
        "como ahorrar comprando",
        "como gasto menos en mis compras",
        "como gastar menos en mis compras",
        "como puedo gastar menos en compras",

        # Ofertas / descuentos
        "como consigo descuentos",
        "como conseguir descuentos",
        "donde consigo descuentos",
        "donde encuentro descuentos",
        "como encuentro descuentos",
        "como consigo ofertas",
        "como conseguir ofertas",
        "donde consigo ofertas",
        "donde encuentro ofertas",
        "como encuentro ofertas",
        "como encontrar buenas ofertas",
        "donde hay mejores ofertas",
        "donde hay mejores precios",

        # Precio / precios
        "como consigo un mejor precio",
        "como conseguir un mejor precio",
        "como encuentro un mejor precio",
        "donde consigo un mejor precio",
        "donde encuentro un mejor precio",
        "como puedo conseguir un mejor precio",
        "como puedo encontrar un mejor precio",

        # Formas coloquiales
        "como hago para conseguir mejores precios",
        "como hago para encontrar mejores precios",
        "como hago para comprar mas barato",
        "como hago para conseguir cosas mas baratas",
        "como consigo cosas mas baratas",
        "donde consigo cosas mas baratas",
        "como puedo comprar mas barato",
        "quiero conseguir mejores precios",
        "quiero comprar mas barato",
        "quiero ahorrar cuando compro",
        "quiero ahorrar en compras",

        # Typos frecuentes: "como"
        "cmo consigo mejores precios",
        "como consigo mejore precios",
        "como consigo mejor precios",
        "como consigo mejores presios",
        "como consigo mejores preios",
        "como consigo mejores precio",
        "como consigo mejores preicos",
        "como consigo mejores preccios",
        "como consigo mejroes precios",
        "como consigo mejoers precios",
        "como consgio mejores precios",
        "como conisgo mejores precios",
        "como consego mejores precios",
        "como consijo mejores precios",

        # Typos en conseguir
        "como puedo consegir mejores precios",
        "como puedo consguir mejores precios",
        "como puedo consiguir mejores precios",
        "como puedo consseguir mejores precios",
        "como puedo conseguir mejore precios",
        "como puedo conseguir mejores presios",

        # Typos en encontrar
        "como encuntro mejores precios",
        "como encuetro mejores precios",
        "como encuento mejores precios",
        "como encunetro mejores precios",
        "donde encuntro mejores precios",
        "donde encuento mejores precios",

        # Typos en barato
        "como consigo precios mas varatos",
        "como consigo precios mas bararos",
        "como consigo precios mas bartos",
        "como consigo precios mas baratso",
        "como compro mas varato",
        "como comprar mas varato",

        # Typos en ahorrar
        "como ahoro en mis compras",
        "como aorro en mis compras",
        "como ahoroo en mis compras",
        "como puedo ahorar en mis compras",
        "como puedo aorrar en mis compras",
        "como puedo ahorrrar en mis compras",

        # Typos en descuentos/ofertas
        "como consigo descuetos",
        "como consigo descunetos",
        "como consigo desuentos",
        "donde encuentro descuetos",
        "como consigo ofetas",
        "como consigo ofertsa",
        "donde encuentro ofetas",

        # Sin palabras que suelen omitirse al escribir rápido
        "conseguir mejores precios",
        "encontrar mejores precios",
        "mejores precios",
        "conseguir precios baratos",
        "encontrar precios baratos",
        "precios mas baratos",
        "comprar mas barato",
        "pagar menos",
        "gastar menos",
        "ahorrar en compras",
        "conseguir descuentos",
        "encontrar descuentos",
        "conseguir ofertas",
        "encontrar ofertas",
    }

    

    @classmethod
    def match(cls, text: str) -> EasterEgg | None:
        normalized = cls._normalize(text)
        if not normalized:
            return None

        if normalized in cls._EXIT_TRIGGERS:
            return EasterEgg(
                key="exit",
                response="👋 ¡Chau! Cerrando sesión…\n\n[[finsi-logout]]",
            )

        if normalized in cls._YAHOO_TRIGGERS:
            return EasterEgg(
                key="yahoo_respuestas",
                response="pa k kieres saber eso jaja saludos",
            )

        if normalized == "hello there":
            return EasterEgg(
                key="hello_there",
                response=("General Kenobi.\n\n" "!audio[general-kenobi](/images/task/General-Kenobi.mp3)"
        ),
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
              response=("\"Do or do not. There is no try.\"\n\n""— Yoda\n\n""!audio[yoda](/images/task/yoda.mp3)"
        ),
    )

        if normalized in cls._ALBION_TRIGGERS or "albion online" in normalized or "mmorpg" in normalized:
            return EasterEgg(
                key="albion_online",
                response=f"{cls._ALBION_RESPONSE}\n\n!audio[albion](/images/task/albion.mp3)",
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
                    "!audio[rickroll](/images/task/rickroll.mp3)"
                ),
            )

        if normalized in cls._WOLOLO_TRIGGERS:
            # Alterna al azar entre dos clips de wololo distintos.
            if random.random() < 0.5:
                response = (
                    "WOLOLO! Azul se vuelve rojo.\n\n"
                    "!audio[wololo-1](/images/task/wololo.mp3)"
                )
            else:
                response = (
                    "WOLOLO! Azul se vuelve rojo.\n\n"
                    "!audio[wololo-2](/images/task/wololo-2.mp3)"
                )

            return EasterEgg(key="wololo", response=response)

        if normalized in cls._DESCANSO_TRIGGERS:
            return EasterEgg(
                key="descanso",
                response=(
                    "Llevas un rato por aqui. Descansa junto a la hoguera.\n\n"
                    "!audio[descanso](/images/task/descanso.mp3)"
                ),
            )

        if normalized in cls._ISENGARD_TRIGGERS:
            return EasterEgg(
                key="isengard",
                response=(
                    "They are taking the hobbits to Isengard.\n\n"
                    "!audio[isengard](/images/task/isengard.mp3)"
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
                    "!audio[matrix-pill](/images/task/finsi-matrix.mp3)"
                ),
            )

        if normalized in cls._GOT_TRIGGERS:
            return EasterEgg(
                key="got",
                response=(
                    "❄️ El invierno se acerca.\n\n"
                    "Por eso conviene tener un fondo de emergencia antes de que llegue.\n\n"
                    "!audio[got-winter](/images/task/finsi-got.mp3)"
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
            # Alterna al azar entre dos formas de saludar: la animación de
            # terminal (ver TerminalDemo.tsx, marcador debe coincidir con
            # MARCADOR_TERMINAL_DEMO ahí) o el video/audio de hello_world.
            if random.random() < 0.5:
                response = "[[finsi-terminal-demo]]"
            else:
                response = (
                    "Hello, world! 👋\n\n"
                    "!audio[hello-world](/images/task/hello_world.mp3)"
                )

            return EasterEgg(key="hello_world", response=response)

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

        if cls._contains_word(normalized, "mongolia") or cls._contains_word(normalized, "mongol"):
            sonido = random.choice(cls._MONGOLIA_SOUNDS)
            bandera = (
                "!icon[Mongolia](https://images.emojiterra.com/google/noto-emoji/"
                "unicode-15/color/512px/1f1f2-1f1f3.png)"
            )
            return EasterEgg(
                key="mongolia",
                response=(
                    f"DE MONGOLIA SOY! {bandera}\n\n"
                    f"Монголчууд мандтугай, бид бүгдээрээ Монголчууд {bandera}\n\n"
                    f"!audio[mongolia]({sonido})"
                ),
            )
        if normalized in cls._INFINITE_MONEY_TRIGGERS:
           return EasterEgg(
                key="infinite_money",
                response=(
                    "💸 Infinite money glitch detectado...\n\n"
                    "❌ Parece que ya lo parchearon.\n\n"
                    "!audio[infinite-money](/images/task/infinite-money.mp3)"
               ),
            )

        if normalized in cls._CTRL_Z_GASTOS_TRIGGERS:
            return EasterEgg(
                key="ctrl_z_gastos",
                response=(
                    "⌨️ Intentando deshacer tus gastos...\n\n"
                    "❌ Parece que la vida real no tiene Ctrl+Z.\n\n"
                    "!audio[ctrl-z-gastos](/images/task/ctrl-z-gastos.mp3)"
               ),
            )

        if normalized in cls._MEJORES_PRECIOS_TRIGGERS:
            return EasterEgg(
                key="finsi_walking",
                response=(
                    "Caminando la calle, pero siempre con estilo... 😎\n\n"
                    "Nah, hablando en serio: tratá de buscar ofertas y comparar precios, "
                    "tanto en tiendas online como en locales físicos. A veces el mismo "
                    "producto puede tener diferencias importantes de precio según dónde "
                    "lo compres.\n\n"
                    "!audio[finsi-walking](/images/task/finsi-walking.mp3)"
        ),
    )
        
        

        return None

    @staticmethod
    def _contains_word(text: str, word: str) -> bool:
        return re.search(rf"(?<!\w){re.escape(word)}(?!\w)", text) is not None

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
