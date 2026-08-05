import re


from app.services.support.normalizer import SupportQueryNormalizer


class SupportIntentDetector:
    """Detecta consultas sobre el uso o fallos de la aplicación.

    Es deliberadamente conservador para no desviar preguntas financieras al
    soporte técnico.
    """

    _CRITICAL_PATTERNS = (
        r"\b(dashboard|pantalla principal)\b.*\b(transacciones?|movimientos?|datos)\b.*\b(no hice|no reconozco|no son mios|no son mias|ajenos?)\b",
        r"\b(transacciones?|movimientos?|datos)\b.*\b(no hice|no reconozco|no son mios|no son mias|ajenos?)\b",
        r"\b(transacciones?|movimientos?|datos|gastos?|ingresos?|compras?|consumos?|cargos?)\b.*\b(no (?:son|es) m[ií]os?|no hice|nunca hice|no reconozco|desconozco|no autorice|ajenos?|otra persona)\b",
        r"\b(no hice|nunca hice|no reconozco|desconozco|no autorice|no (?:son|es) m[ií]os?)\b.*\b(transacciones?|movimientos?|datos|gastos?|ingresos?|compras?|consumos?|cargos?)\b",
        r"\b(cuenta comprometida|me hackearon|hackearon mi cuenta|acceso no autorizado|robaron mi cuenta)\b",
        r"\b(perdi|perd[ií])\b.*\b(transacciones?|movimientos?|datos)\b",
        r"\b(error 500|error interno|database timeout|nullreference|server error)\b",
    )

    _STRONG_PATTERNS = (
        r"\b(no puedo|no me deja|no funciona|no anda|fall[ao]|error|problema)\b.*\b(csv|pdf|informe|archivo|import|export|descarg|subir|cargar|login|sesion|contrase|perfil|cuenta|dashboard|meta|registro|boton|pantalla)\b",
        r"\b(csv|pdf|informe|archivo|import|export|descarg|subir|cargar|login|sesion|contrase|perfil|cuenta|dashboard|meta|registro|boton|pantalla)\b.*\b(no puedo|no me deja|no funciona|no anda|fall[ao]|error|problema|cero|vacio|rechaz)\b",
        r"\b(como|donde|que|para que)\b.*\b(importar|exportar|descargar|cambiar contrase|editar perfil|dar de baja|eliminar cuenta|compartir informe|iniciar sesion|registrarme|crear meta|dashboard|transacciones|analisis|recomendaciones|endeudamiento|capacidad de ahorro|frecuencia de ahorro)\b",
        r"\b(monto debe ser mayor que cero|archivo fue rechazado|ai-service|ventanas emergentes|popup|correo de soporte)\b",
        r"\b(dar de baja|eliminar cuenta|cerrar cuenta)\b",
        r"\b(dashboard|pantalla principal)\b.*\b(transacciones?|movimientos?|datos)\b.*\b(no hice|no reconozco|incorrectos?|ajenos?|otra persona)\b",
        r"\b(no puedo|error|falla|problema)\b.*\b(crear|guardar|cambiar|restablecer)\b.*\b(contrasena|clave|password|meta)\b",
        r"\b(la )?(contrasena|clave) actual (es )?(incorrecta|invalida|erronea)\b",
        r"\b(invalid|wrong|incorrect) current contrasena\b",
        r"\bcurrent contrasena (is )?(incorrect|invalid|wrong)\b",
    )

    _PRODUCT_PATTERNS = (
        r"\b(como|donde)\b.*\b(creo|crear|importo|importar|exporto|exportar|cambio|cambiar|elimino|eliminar|comparto|compartir)\b.*\b(meta|csv|pdf|contrasena|cuenta|perfil|movimientos|informe)\b",
        r"\b(que|para que)\b.*\b(significa|muestra|sirve|son|hace)\b.*\b(dashboard|endeudamiento|capacidad de ahorro|frecuencia de ahorro|en riesgo|recomendaciones|prioridad alta|prioridad media|sugerencia)\b",
        r"\b(dashboard|transacciones|importar csv|analisis|recomendaciones|metas|mi cuenta|mi perfil|asistente ia|soporte)\b.*\b(como|que|donde|para que|funciona|sirve|muestra)\b",
    )

    _PRODUCT_PATTERNS = (
        r"\b(como|donde)\b.*\b(creo|crear|importo|importar|exporto|exportar|cambio|cambiar|elimino|eliminar|comparto|compartir)\b.*\b(meta|csv|pdf|contrasena|cuenta|perfil|movimientos|informe)\b",
        r"\b(que|para que)\b.*\b(significa|muestra|sirve|son|hace)\b.*\b(dashboard|endeudamiento|capacidad de ahorro|frecuencia de ahorro|en riesgo|recomendaciones|prioridad alta|prioridad media|sugerencia)\b",
        r"\b(dashboard|transacciones|importar csv|analisis|recomendaciones|metas|mi cuenta|mi perfil|asistente ia|soporte)\b.*\b(como|que|donde|para que|funciona|sirve|muestra)\b",
    )

    _APP_TERMS = {
        "finsight", "finsightai", "csv", "pdf", "dashboard", "inicio de sesion",
        "iniciar sesion", "login", "registro", "registrarme", "contraseña",
        "contrasena", "editar perfil", "mi cuenta", "dar de baja", "cuenta eliminada",
        "exportar movimientos", "compartir informe", "descargar informe", "importar archivo",
        "cargar archivo", "archivo", "perfil calculado", "preview", "vista previa", "ai-service",
        "transacciones", "analisis", "recomendaciones", "metas", "mi perfil", "mi cuenta",
        "capacidad de ahorro", "endeudamiento", "frecuencia de ahorro", "en riesgo",
    }

    _FOLLOW_UP_MARKERS = (
        "respóndeme con el numero",
        "que pasa cuando tocas",
        "descargar informe pdf",
        "importacion csv",
        "ventanas emergentes",
        "contactar soporte",
        "problema es que",
        "cual de estas situaciones",
        "copiame el mensaje de error",
        "cantidad de movimientos mayor que cero",
        "respóndeme si o no",
        "respóndeme si",
        "ahora aparecen los movimientos",
        "con eso seguimos al proximo paso",
        "vamos a revisar que ocurre con la contrasena",
        "mensaje exacto que aparece",
        "aparece un mensaje de error al guardar",
        "puedo ayudarte con algo mas",
    )

    _SUPPORT_WORDS = {
        "error", "falla", "fallo", "problema", "ayuda", "funciona", "anda", "cargar",
        "importar", "exportar", "descargar", "descarga", "rechazado", "rechaza", "aparece", "muestra",
        "guardar", "guardado", "boton", "pantalla", "como", "donde", "cambiar", "editar",
        "responde", "respuesta",
    }

    @classmethod
    def is_critical_support_query(cls, text: str) -> bool:
        normalized = cls._normalize(text)
        return bool(normalized) and any(
            re.search(pattern, normalized) for pattern in cls._CRITICAL_PATTERNS
        )

    @classmethod
    def is_support_query(cls, text: str) -> bool:
        normalized = cls._normalize(text)
        if not normalized:
            return False
        if cls.is_critical_support_query(normalized):
            return True
        if any(re.search(pattern, normalized) for pattern in cls._STRONG_PATTERNS):
            return True
        if any(re.search(pattern, normalized) for pattern in cls._PRODUCT_PATTERNS):
            return True
        app_hits = sum(1 for term in cls._APP_TERMS if term in normalized)
        support_hits = sum(1 for term in cls._SUPPORT_WORDS if term in normalized)
        return app_hits >= 1 and support_hits >= 1


    @classmethod
    def is_support_follow_up(cls, text: str, previous_answer: str | None) -> bool:
        """Reconoce respuestas breves que continúan un diagnóstico técnico.

        Una respuesta como ``se abre una ventana en blanco`` puede no mencionar
        PDF ni FinSightAI. El contexto técnico está en la respuesta anterior del
        asistente, por eso se evalúan ambos mensajes antes de volver al flujo
        financiero.
        """
        if not previous_answer:
            return False

        current = cls._normalize(text)
        previous = cls._normalize(previous_answer)
        if not current or not previous:
            return False

        previous_is_support = (
            any(marker in previous for marker in cls._FOLLOW_UP_MARKERS)
            or cls.is_support_query(previous)
        )
        if not previous_is_support:
            return False

        # En un diagnóstico ya iniciado, cualquier respuesta breve o una
        # descripción típica de fallo debe permanecer en soporte.
        follow_up_terms = (
            "ventana", "blanco", "vacio", "nada", "no abre", "no aparece",
            "sigue igual", "ya probe", "error", "cero", "rechazado",
            "1", "2", "3", "4",
        )
        return len(current.split()) <= 18 or any(term in current for term in follow_up_terms)

    @staticmethod
    def _normalize(text: str) -> str:
        return SupportQueryNormalizer.normalize(text)
