import re
import unicodedata


class QueryNormalizer:
    _WORD_ALIASES = {
        "anterio": "anterior",
        "anterir": "anterior",
        "antreior": "anterior",
    }

    _LATAM_MONEY_ALIASES = {
        "guita": "plata", "lana": "plata", "feria": "plata",
        "varo": "plata", "varos": "plata", "lucas": "plata",
        "mangos": "plata", "plata": "plata", "billete": "plata",
    }
    """Normaliza forma y acentos sin interpretar ni corregir palabras."""

    _ALLOWED_PATTERN = re.compile(r"[^\w\s%$+x×*/÷.\-,√]")

    @classmethod
    def normalize(cls, text: str) -> str:
        if not isinstance(text, str):
            raise ValueError("La pregunta debe ser texto.")

        value = unicodedata.normalize("NFD", text.strip().lower())
        value = "".join(
            character
            for character in value
            if unicodedata.category(character) != "Mn"
        )
        value = cls._ALLOWED_PATTERN.sub(" ", value)
        value = re.sub(r"\s+", " ", value).strip()
        words = [
            cls._LATAM_MONEY_ALIASES.get(
                cls._WORD_ALIASES.get(word, word),
                cls._WORD_ALIASES.get(word, word),
            )
            for word in value.split()
        ]
        return " ".join(words)
