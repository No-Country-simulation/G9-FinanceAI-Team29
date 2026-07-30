import re
import unicodedata


class QueryNormalizer:
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
        value = re.sub(r"\s+", " ", value)
        return value.strip()
