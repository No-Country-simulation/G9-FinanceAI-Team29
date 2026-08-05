from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher


class SupportQueryNormalizer:
    """Normaliza consultas técnicas informales y errores frecuentes.

    Es deliberadamente acotado al vocabulario de soporte de FinSightAI para no
    reescribir consultas financieras ni cambiar el significado del mensaje.
    """

    _PHRASE_REPLACEMENTS = {
        "no funca": "no funciona",
        "no funka": "no funciona",
        "no me funca": "no me funciona",
        "se rompio": "no funciona",
        "se queda pensando": "no responde",
        "se quedo pensando": "no responde",
        "se queda colgado": "no responde",
        "se quedo colgado": "no responde",
        "me tira error": "muestra error",
        "me da error": "muestra error",
        "el coso del pdf": "el pdf",
        "el coso del csv": "el csv",
        "archivo excel": "archivo csv",
        "planilla excel": "archivo csv",
        "cerrar mi cuenta": "dar de baja mi cuenta",
        "borrar mi cuenta": "dar de baja mi cuenta",
        "eliminar mi cuenta": "dar de baja mi cuenta",
        "darme de baja": "dar de baja mi cuenta",
        "darme de vaja": "dar de baja mi cuenta",
    }

    _WORD_REPLACEMENTS = {
        "cvs": "csv",
        "scv": "csv",
        "cvsx": "csv",
        "exel": "excel",
        "excell": "excel",
        "pfd": "pdf",
        "dpF": "pdf",
        "contrsena": "contrasena",
        "contasena": "contrasena",
        "contasena": "contrasena",
        "contasena": "contrasena",
        "contaseña": "contrasena",
        "contasena": "contrasena",
        "contarseña": "contrasena",
        "contrasenia": "contrasena",
        "password": "contrasena",
        "clave": "contrasena",
        "canviar": "cambiar",
        "cambair": "cambiar",
        "vaja": "baja",
        "vaton": "boton",
        "buton": "boton",
        "informe": "informe",
        "loguin": "login",
        "logueo": "login",
        "sesion": "sesion",
        "registrarce": "registrarse",
        "descagar": "descargar",
        "descaragar": "descargar",
        "desacargar": "descargar",
        "suvir": "subir",
        "subo": "subir",
        "subirlo": "subir",
        "cargarlo": "cargar",
        "importat": "importar",
        "inportar": "importar",
        "expotar": "exportar",
        "perfil": "perfil",
        "riego": "riesgo",
        "riezgo": "riesgo",
    }

    _SUPPORT_VOCABULARY = frozenset({
        "csv", "pdf", "excel", "archivo", "planilla", "importar", "exportar",
        "descargar", "cargar", "subir", "informe", "dashboard", "perfil",
        "cuenta", "contrasena", "password", "clave", "login", "sesion",
        "registro", "registrarse", "boton", "pantalla", "preview", "meta",
        "editar", "cambiar", "compartir", "eliminar", "baja", "error",
        "problema", "funciona", "anda", "rechazado", "vacio", "cero",
        "guardar", "guardado", "finsight", "finsightai", "ai-service",
    })

    _TOKEN_RE = re.compile(r"\b[^\W\d_]+(?:-[^\W\d_]+)*\b", re.UNICODE)

    @classmethod
    def normalize(cls, text: str) -> str:
        if not isinstance(text, str):
            return ""

        value = unicodedata.normalize("NFD", text.casefold())
        value = "".join(char for char in value if unicodedata.category(char) != "Mn")
        value = re.sub(r"[^a-z0-9\s_-]", " ", value)
        value = re.sub(r"\s+", " ", value).strip()

        for source, target in cls._PHRASE_REPLACEMENTS.items():
            value = re.sub(rf"\b{re.escape(source)}\b", target, value)

        def replace_token(match: re.Match[str]) -> str:
            word = match.group(0)
            direct = cls._WORD_REPLACEMENTS.get(word)
            if direct:
                return direct
            return cls._fuzzy_support_term(word)

        value = cls._TOKEN_RE.sub(replace_token, value)
        return re.sub(r"\s+", " ", value).strip()

    @classmethod
    def _fuzzy_support_term(cls, word: str) -> str:
        if len(word) < 4 or word in cls._SUPPORT_VOCABULARY:
            return word

        candidates = []
        for term in cls._SUPPORT_VOCABULARY:
            if abs(len(word) - len(term)) > 2:
                continue
            score = SequenceMatcher(None, word, term).ratio()
            candidates.append((term, score))

        if not candidates:
            return word

        candidates.sort(key=lambda item: item[1], reverse=True)
        best_term, best_score = candidates[0]
        second_score = candidates[1][1] if len(candidates) > 1 else 0.0

        minimum = 0.88 if len(word) <= 5 else 0.82
        if best_score >= minimum and best_score - second_score >= 0.06:
            return best_term
        return word
