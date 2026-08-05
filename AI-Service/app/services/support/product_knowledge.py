from __future__ import annotations

from dataclasses import dataclass

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class ProductKnowledgeResult:
    content: str
    route: str
    topic: str


class ProductKnowledgeResponder:
    """Respuestas determinísticas sobre las pantallas reales de FinSightAI.

    Evita que el LLM invente rutas, botones o capacidades. Las reglas se basan
    en la interfaz de la versión presentada en el hackathon.
    """

    @classmethod
    def answer(cls, question: str) -> ProductKnowledgeResult | None:
        q = SupportQueryNormalizer.normalize(question)
        if not q:
            return None

        # Acceso y cuenta
        if cls._has(
            q,
            "requisitos de la contrasena",
            "que requisitos necesita la contrasena",
            "como debe ser la contrasena",
            "que debe tener la contrasena",
            "que contrasena tengo que poner",
            "que clave tengo que poner",
            "como crear una contrasena segura",
            "que necesita mi contrasena",
        ):
            return cls._result(
                "password_requirements",
                "Para que la contraseña alcance una seguridad **Muy fuerte**, debe incluir:\n\n"
                "- Al menos **8 caracteres**.\n"
                "- Una letra **mayúscula** (`A-Z`).\n"
                "- Una letra **minúscula** (`a-z`).\n"
                "- Un número (`0-9`).\n"
                "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
                "Además, la contraseña y su confirmación deben coincidir exactamente. "
                "Si estás creando una cuenta, también debes aceptar los **Términos y condiciones** "
                "y la **Política de privacidad**.\n\n"
                "Por seguridad, no escribas ni compartas tu contraseña en este chat.",
            )

        if cls._has(q, "cambiar mi contrasena", "cambiar contrasena", "actualizar contrasena"):
            return cls._result(
                "password_change",
                "Para cambiar tu contraseña con la sesión iniciada, entra en **Mi cuenta** y, "
                "en la sección **Seguridad**, selecciona **Cambiar contraseña**.\n\n"
                "La nueva contraseña debe alcanzar una seguridad **Muy fuerte** e incluir:\n\n"
                "- Al menos **8 caracteres**.\n"
                "- Una letra **mayúscula** (`A-Z`).\n"
                "- Una letra **minúscula** (`a-z`).\n"
                "- Un número (`0-9`).\n"
                "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
                "La contraseña y su confirmación deben coincidir exactamente. "
                "Si no recuerdas la contraseña o no puedes iniciar sesión, usa "
                "**¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión.\n\n"
                "Por seguridad, no escribas ni compartas tu contraseña en este chat.",
            )

        if cls._has(q, "olvide mi contrasena", "recuperar contrasena", "restablecer contrasena"):
            return cls._result(
                "password_recovery",
                "Desde la pantalla de inicio de sesión, selecciona **¿Olvidaste tu contraseña?**, ingresa tu correo y sigue el enlace de recuperación. Revisa también spam o correo no deseado.\n\n"
                "Si el mensaje no llega o el enlace falla, usa **Contactar por correo** en Soporte.",
            )

        if cls._has(q, "cerrar sesion en todos", "cerrar todas las sesiones", "otros dispositivos"):
            return cls._result(
                "close_sessions",
                "Entra en **Mi cuenta** y desplázate hasta **Zona de peligro**. Allí puedes usar **Cerrar sesiones** para cerrar tu sesión en este y en los demás dispositivos.",
            )

        if cls._has(q, "eliminar cuenta", "dar de baja mi cuenta", "baja de cuenta"):
            return cls._result(
                "delete_account",
                "Entra en **Mi cuenta**, desplázate hasta **Zona de peligro** y selecciona **Eliminar cuenta**. La cuenta pasa al estado `ELIMINADO` y los datos financieros se conservan según el flujo actual de la aplicación.",
            )

        if cls._has(q, "editar perfil", "cambiar nombre", "cambiar apellido", "actualizar perfil"):
            return cls._result(
                "edit_profile",
                "Entra en **Mi cuenta** y selecciona **Editar**, arriba a la derecha. Desde ahí puedes actualizar los datos personales disponibles en tu perfil.",
            )

        # Exportaciones e informes
        if cls._has(q, "descargar informe pdf", "exportar pdf", "bajar informe pdf"):
            return cls._result(
                "export_pdf",
                "Entra en **Mi cuenta** y, en **Informe financiero**, selecciona **Descargar informe PDF**. También existen opciones de exportación en otras pantallas, pero ese botón descarga el resumen de tus principales indicadores.",
            )

        if cls._has(q, "exportar movimientos csv", "descargar movimientos csv", "exportar transacciones"):
            return cls._result(
                "export_transactions",
                "Puedes exportar los movimientos desde **Mi cuenta** con **Exportar movimientos CSV** o desde **Transacciones** usando el botón **Exportar**.",
            )

        if cls._has(q, "compartir informe", "como comparto", "compartir reporte"):
            return cls._result(
                "share_report",
                "Entra en **Mi cuenta** y, dentro de **Informe financiero**, selecciona **Compartir informe**.",
            )

        # CSV
        if cls._has(q, "como importar", "como importo", "importar csv", "cargar csv", "subir csv", "importar movimientos"):
            return cls._result(
                "import_csv",
                "Abre **Importar CSV** desde el menú lateral. Selecciona **Seleccionar CSV**, elige un archivo de hasta 5 MB y después presioná **Procesar CSV**.\n\n"
                "Las columnas requeridas son: `fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`. En la misma pantalla puedes usar **Descargar plantilla de ejemplo**.",
            )

        if cls._has(
            q,
            "que columnas necesita el csv",
            "que columnas debe tener el csv",
            "columnas obligatorias del csv",
        ):
            return cls._result(
                "csv_columns",
                "El archivo CSV debe incluir estas columnas obligatorias: "
                "`fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`. "
                "Los encabezados deben conservar esos nombres.",
            )

        if cls._has(
            q,
            "que formato debe tener la fecha",
            "que formato debe tener la fecha del csv",
            "formato de fecha del csv",
            "como escribir la fecha en el csv",
        ):
            return cls._result(
                "csv_date_format",
                "La columna `fecha` debe contener fechas válidas. Se recomienda usar el formato "
                "`AAAA-MM-DD`, por ejemplo `2026-08-05`.",
            )

        if cls._has(
            q,
            "tamano maximo del csv",
            "cuanto puede pesar el csv",
            "peso maximo del csv",
        ):
            return cls._result(
                "csv_max_size",
                "El archivo CSV puede pesar como máximo **5 MB**.",
            )

        if cls._has(
            q,
            "que significa recurrente",
            "columna recurrente",
            "como completar recurrente",
        ):
            return cls._result(
                "csv_recurrent",
                "La columna `recurrente` indica si el movimiento se repite periódicamente. "
                "Acepta valores como `Sí/No`, `true/false` o `1/0`.",
            )

        if cls._has(q, "columnas csv", "formato csv", "plantilla csv", "requisitos csv"):
            return cls._result(
                "csv_format",
                "El archivo debe tener estas columnas: `fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`. Debe ser un CSV real, pesar como máximo 5 MB y usar montos mayores que cero; `tipo` indica si es `Ingreso` o `Gasto`.",
            )

        # Transacciones
        if cls._has(q, "ver transacciones", "ver movimientos", "donde estan mis movimientos"):
            return cls._result(
                "transactions_view",
                "Entra en **Transacciones** desde el menú lateral. Allí puedes ver fecha, descripción, categoría, tipo y monto de cada movimiento.",
            )

        if cls._has(q, "filtrar ingresos", "solo ingresos", "filtrar gastos", "solo gastos"):
            return cls._result(
                "transactions_filters",
                "En **Transacciones**, usa los botones **Todos**, **Ingreso** o **Gasto** de la parte superior para filtrar el listado.",
            )

        # Metas
        if cls._has(q, "crear meta", "creo una meta", "nueva meta", "como hago una meta", "agregar meta"):
            return cls._result(
                "create_goal",
                "Entra en **Metas**. En **Nueva meta**, completá el nombre, el tipo, el monto objetivo en $ y la fecha. La descripción es opcional. Después selecciona **Crear meta**.",
            )

        if cls._has(q, "no tengo metas", "sin metas activas", "meta activa"):
            return cls._result(
                "goals_empty",
                "Si todavía no tenés metas activas, la pantalla **Metas** muestra el formulario **Nueva meta** para crear la primera y comenzar a medir el progreso.",
            )

        # Recomendaciones
        if cls._has(q, "prioridad alta", "prioridad media", "que significa sugerencia"):
            return cls._result(
                "recommendation_priority",
                "En **Recomendaciones**, **Prioridad Alta** señala el aspecto más urgente, **Prioridad Media** indica una mejora importante y **Sugerencia** propone una acción conveniente de menor urgencia. Puedes usar **Preguntar a Finsi sobre esto** para pedir una explicación más detallada.",
            )

        if cls._has(q, "como se generan las recomendaciones", "de donde salen las recomendaciones", "que son las recomendaciones"):
            return cls._result(
                "recommendations",
                "Las recomendaciones se generan a partir de tu perfil financiero, ingresos, gastos, capacidad de ahorro y endeudamiento. Se muestran ordenadas por prioridad en la pantalla **Recomendaciones**.",
            )

        # Análisis
        if cls._has(q, "como uso analisis", "analizar finanzas", "pantalla analisis", "hacer analisis"):
            return cls._result(
                "analysis",
                "Entra en **Análisis**, revisa o completá **Ingreso Mensual**, **Nivel de Endeudamiento** y **Frecuencia de Ahorro**, y selecciona **Analizar Finanzas**. El resultado aparece en el panel derecho y luego puede exportarse.",
            )

        # Dashboard e indicadores
        if cls._has(q, "que muestra dashboard", "para que sirve dashboard", "pantalla principal"):
            return cls._result(
                "dashboard",
                "El **Dashboard** resume tu perfil financiero, ingresos, gastos, balance, gastos mensuales, categorías, capacidad de ahorro, nivel de endeudamiento, últimas transacciones y recomendaciones.",
            )

        if cls._has(q, "capacidad de ahorro", "ahorro estimado"):
            return cls._result(
                "savings_capacity",
                "La **Capacidad de Ahorro** estima qué porcentaje de tus ingresos queda disponible después de considerar los gastos registrados. En el Dashboard se muestra como porcentaje y monto estimado.",
            )

        if cls._has(q, "nivel de endeudamiento", "endeudamiento alto"):
            return cls._result(
                "debt_level",
                "El **Nivel de Endeudamiento** representa qué proporción de tus ingresos se destina a deudas. FinSightAI muestra como referencia: recomendado hasta 30%, riesgo medio entre 30% y 50%, y riesgo alto por encima de 50%.",
            )

        if cls._has(q, "perfil en riesgo", "estoy en riesgo", "que significa en riesgo"):
            return cls._result(
                "risk_profile",
                "La clasificación **En riesgo** indica que uno o más indicadores necesitan atención, por ejemplo un endeudamiento elevado, gastos altos o una capacidad de ahorro insuficiente. Revisa **Recomendaciones** para ver qué conviene priorizar.",
            )

        if cls._has(q, "frecuencia de ahorro", "que significa nunca"):
            return cls._result(
                "saving_frequency",
                "La **Frecuencia de Ahorro** resume con qué regularidad tu perfil registra capacidad de ahorro. Si aparece **Nunca**, significa que con los datos actuales no se observa ahorro mensual positivo de forma habitual.",
            )

        # Asistente y soporte
        if cls._has(q, "que podes hacer", "como me ayudas", "funciones de fins", "funciones de finsi"):
            return cls._result(
                "assistant_capabilities",
                "Puedo ayudarte a entender gastos, ingresos, ahorro, endeudamiento y tu perfil financiero; también puedo explicar las pantallas y funciones reales de FinSightAI. Para problemas técnicos, el chat de **Soporte** intenta resolverlos y, si no alcanza, te deriva al correo del equipo.",
            )

        if cls._has(q, "contactar soporte", "mandar mail", "correo de soporte", "hablar con soporte"):
            return cls._result(
                "support_contact",
                "Entra en **Soporte** y selecciona **Contactar por correo**. El equipo TwentyNineDevs recibe las consultas en `g9latamteam29@gmail.com` y la pantalla informa un tiempo estimado de respuesta de 24 a 48 horas hábiles.",
            )

        return None

    @staticmethod
    def _has(text: str, *terms: str) -> bool:
        return any(term in text for term in terms)

    @staticmethod
    def _result(topic: str, content: str) -> ProductKnowledgeResult:
        return ProductKnowledgeResult(
            content=content,
            route=f"support_product_{topic}",
            topic=topic,
        )
