from __future__ import annotations

from dataclasses import dataclass

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class ProductKnowledgeResult:
    content: str
    route: str
    topic: str


@dataclass(frozen=True)
class ProductKnowledgeRule:
    topic: str
    terms: tuple[str, ...]
    content: str


class ProductKnowledgeResponder:
    """Respuestas determinísticas sobre las funciones reales de FinSightAI.

    Las reglas se evalúan sobre el texto normalizado. Este módulo responde
    consultas informativas y evita que el LLM invente rutas o capacidades.
    Los reportes técnicos explícitos deben ser derivados previamente al
    diagnóstico por el orquestador.
    """

    _RULES: tuple[ProductKnowledgeRule, ...] = (
        ProductKnowledgeRule(
            topic="about_finsightai",
            terms=(
                "que es finsightai",
                "que es fin sight ai",
                "para que sirve finsightai",
                "para que sirve",
                "para que sirve?",
                "para que sirve finsi",
                "para que sirve finsight",
                "para que sirve finsightai",
                "que utilidad tiene",
                "que hace esta aplicacion",
                "para que sirve esta aplicacion",
                "que hace finsightai",
                "como funciona finsightai",
                "finsightai",
            ),
            content=(
                "FinSightAI es una plataforma de gestión financiera personal "
                "desarrollada por **TwentyNineDevs**. Ayuda a registrar y analizar "
                "ingresos, gastos, transacciones y metas, clasifica movimientos con "
                "inteligencia artificial y ofrece indicadores y recomendaciones para "
                "comprender mejor la situación financiera."
            ),
        ),
        ProductKnowledgeRule(
            topic="about_team",
            terms=(
                "quien te creo",
                "quienes te crearon",
                "quien te desarrollo",
                "quienes te desarrollaron",
                "quien te programo",
                "quienes te programaron",
                "quien hizo finsightai",
                "quienes hicieron finsightai",
                "que es twentyninedevs",
                "que es twenty nine devs",
                "quienes son twentyninedevs",
                "quienes son twenty nine devs",
                "twentyninedevs",
                "twenty nine devs",
            ),
            content=(
                "TwentyNineDevs es el equipo de desarrolladores que creó "
                "FinSightAI y también me creó a mí, Finsi. Trabajaron en conjunto "
                "para desarrollar esta aplicación y sus funciones de inteligencia "
                "artificial."
            ),
        ),
        ProductKnowledgeRule(
            topic="password_requirements",
            terms=(
                "requisitos de la contrasena",
                "que requisitos necesita la contrasena",
                "como debe ser la contrasena",
                "que debe tener la contrasena",
                "que contrasena tengo que poner",
                "que clave tengo que poner",
                "como crear una contrasena segura",
                "que necesita mi contrasena",
            ),
            content=(
                "Para que la contraseña alcance una seguridad **Muy fuerte**, debe incluir:\n\n"
                "- Al menos **8 caracteres**.\n"
                "- Una letra **mayúscula** (`A-Z`).\n"
                "- Una letra **minúscula** (`a-z`).\n"
                "- Un número (`0-9`).\n"
                "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
                "La contraseña y su confirmación deben coincidir exactamente. "
                "Si estás creando una cuenta, también debes aceptar los **Términos y condiciones** "
                "y la **Política de privacidad**.\n\n"
                "Por seguridad, no escribas ni compartas tu contraseña en este chat."
            ),
        ),
        ProductKnowledgeRule(
            topic="password_change",
            terms=(
                "cambiar mi contrasena",
                "cambiar contrasena",
                "actualizar contrasena",
                "donde cambio mi contrasena",
                "donde cambio la contrasena",
                "donde cambiar mi contrasena",
                "como cambio mi contrasena",
                "como cambiar mi contrasena",
            ),
            content=(
                "Para cambiar tu contraseña con la sesión iniciada, entra en "
                "**Mi cuenta** y, en la sección **Seguridad**, selecciona "
                "**Cambiar contraseña**.\n\n"
                "La nueva contraseña debe alcanzar una seguridad **Muy fuerte** e incluir:\n\n"
                "- Al menos **8 caracteres**.\n"
                "- Una letra **mayúscula** (`A-Z`).\n"
                "- Una letra **minúscula** (`a-z`).\n"
                "- Un número (`0-9`).\n"
                "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
                "La contraseña y su confirmación deben coincidir exactamente. "
                "Si no recuerdas la contraseña o no puedes iniciar sesión, usa "
                "**¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión.\n\n"
                "Por seguridad, no escribas ni compartas tu contraseña en este chat."
            ),
        ),
        ProductKnowledgeRule(
            topic="password_recovery",
            terms=(
                "olvide mi contrasena",
                "recuperar contrasena",
                "restablecer contrasena",
                "como recupero mi contrasena",
                "donde recupero mi contrasena",
                "como restablezco mi contrasena",
            ),
            content=(
                "Desde la pantalla de inicio de sesión, selecciona "
                "**¿Olvidaste tu contraseña?**, ingresa tu correo y sigue el enlace "
                "de recuperación. Revisa también spam o correo no deseado."
            ),
        ),
        ProductKnowledgeRule(
            topic="close_sessions",
            terms=(
                "cerrar sesion en todos",
                "cerrar todas las sesiones",
                "cerrar sesiones",
                "otros dispositivos",
            ),
            content=(
                "Entra en **Mi cuenta** y desplázate hasta **Zona de peligro**. "
                "Allí puedes usar **Cerrar sesiones** para cerrar tu sesión en este "
                "y en los demás dispositivos."
            ),
        ),
        ProductKnowledgeRule(
            topic="delete_account",
            terms=(
                "eliminar cuenta",
                "dar de baja mi cuenta",
                "baja de cuenta",
                "como elimino mi cuenta",
                "donde elimino mi cuenta",
            ),
            content=(
                "Entra en **Mi cuenta**, desplázate hasta **Zona de peligro** y "
                "selecciona **Eliminar cuenta**."
            ),
        ),
        ProductKnowledgeRule(
            topic="edit_profile",
            terms=(
                "editar perfil",
                "cambiar nombre",
                "cambiar apellido",
                "actualizar perfil",
                "como edito mi perfil",
                "donde edito mi perfil",
            ),
            content=(
                "Entra en **Mi cuenta** y selecciona **Editar**, arriba a la derecha. "
                "Desde ahí puedes actualizar los datos personales disponibles."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_pdf",
            terms=(
                "descargar informe pdf",
                "exportar pdf",
                "bajar informe pdf",
                "como descargo el informe",
                "donde descargo el informe",
            ),
            content=(
                "Entra en **Mi cuenta** y, en **Informe financiero**, selecciona "
                "**Descargar informe PDF**."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_transactions",
            terms=(
                "exportar movimientos csv",
                "descargar movimientos csv",
                "exportar transacciones",
                "donde exporto mis movimientos",
                "como exporto mis movimientos",
            ),
            content=(
                "Puedes exportar los movimientos desde **Mi cuenta** con "
                "**Exportar movimientos CSV** o desde **Transacciones** usando "
                "el botón **Exportar**."
            ),
        ),
        ProductKnowledgeRule(
            topic="share_report",
            terms=(
                "compartir informe",
                "como comparto",
                "compartir reporte",
            ),
            content=(
                "Entra en **Mi cuenta** y, dentro de **Informe financiero**, "
                "selecciona **Compartir informe**."
            ),
        ),
        ProductKnowledgeRule(
            topic="import_csv",
            terms=(
                "como importar",
                "como importo",
                "importar csv",
                "cargar csv",
                "subir csv",
                "importar movimientos",
            ),
            content=(
                "Abre **Importar CSV** desde el menú lateral. Selecciona "
                "**Seleccionar CSV**, elige un archivo de hasta 5 MB y después "
                "presiona **Procesar CSV**.\n\n"
                "Las columnas requeridas son: `fecha, descripcion, monto, tipo, "
                "categoria, medio_pago, recurrente`."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_columns",
            terms=(
                "que columnas necesita el csv",
                "que columnas debe tener el csv",
                "columnas obligatorias del csv",
                "columnas csv",
                "formato csv",
                "plantilla csv",
                "requisitos csv",
            ),
            content=(
                "El archivo CSV debe incluir estas columnas: `fecha, descripcion, "
                "monto, tipo, categoria, medio_pago, recurrente`. Debe pesar como "
                "máximo 5 MB y usar montos mayores que cero."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_date_format",
            terms=(
                "que formato debe tener la fecha",
                "que formato debe tener la fecha del csv",
                "formato de fecha del csv",
                "como escribir la fecha en el csv",
            ),
            content=(
                "Se recomienda usar el formato `AAAA-MM-DD`, por ejemplo "
                "`2026-08-05`."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_max_size",
            terms=(
                "tamano maximo del csv",
                "cuanto puede pesar el csv",
                "peso maximo del csv",
            ),
            content="El archivo CSV puede pesar como máximo **5 MB**.",
        ),
        ProductKnowledgeRule(
            topic="csv_recurrent",
            terms=(
                "que significa recurrente",
                "columna recurrente",
                "como completar recurrente",
            ),
            content=(
                "La columna `recurrente` indica si el movimiento se repite "
                "periódicamente. Acepta valores como `Sí/No`, `true/false` o `1/0`."
            ),
        ),
        ProductKnowledgeRule(
            topic="transactions_view",
            terms=(
                "ver transacciones",
                "ver movimientos",
                "donde estan mis movimientos",
                "donde veo mis transacciones",
                "donde veo mis movimientos",
            ),
            content=(
                "Entra en **Transacciones** desde el menú lateral. Allí puedes ver "
                "fecha, descripción, categoría, tipo y monto de cada movimiento."
            ),
        ),
        ProductKnowledgeRule(
            topic="transactions_filters",
            terms=(
                "filtrar ingresos",
                "solo ingresos",
                "filtrar gastos",
                "solo gastos",
            ),
            content=(
                "En **Transacciones**, usa los botones **Todos**, **Ingreso** o "
                "**Gasto** para filtrar el listado."
            ),
        ),
        ProductKnowledgeRule(
            topic="create_goal",
            terms=(
                "crear meta",
                "creo una meta",
                "nueva meta",
                "como hago una meta",
                "agregar meta",
                "como creo una meta",
            ),
            content=(
                "Entra en **Metas**. En **Nueva meta**, completa el nombre, el tipo, "
                "el monto objetivo y la fecha. La descripción es opcional. Después "
                "selecciona **Crear meta**."
            ),
        ),
        ProductKnowledgeRule(
            topic="goals_empty",
            terms=(
                "no tengo metas",
                "sin metas activas",
                "meta activa",
            ),
            content=(
                "Si todavía no tienes metas activas, la pantalla **Metas** muestra "
                "el formulario **Nueva meta** para crear la primera."
            ),
        ),
        ProductKnowledgeRule(
            topic="recommendation_priority",
            terms=(
                "prioridad alta",
                "prioridad media",
                "que significa sugerencia",
            ),
            content=(
                "En **Recomendaciones**, **Prioridad Alta** señala el aspecto más "
                "urgente, **Prioridad Media** indica una mejora importante y "
                "**Sugerencia** propone una acción conveniente de menor urgencia."
            ),
        ),
        ProductKnowledgeRule(
            topic="recommendations",
            terms=(
                "como se generan las recomendaciones",
                "de donde salen las recomendaciones",
                "que son las recomendaciones",
            ),
            content=(
                "Las recomendaciones se generan a partir de tu perfil financiero, "
                "ingresos, gastos, capacidad de ahorro y endeudamiento."
            ),
        ),
        ProductKnowledgeRule(
            topic="analysis",
            terms=(
                "como uso analisis",
                "analizar finanzas",
                "pantalla analisis",
                "hacer analisis",
            ),
            content=(
                "Entra en **Análisis**, revisa o completa **Ingreso Mensual**, "
                "**Nivel de Endeudamiento** y **Frecuencia de Ahorro**, y selecciona "
                "**Analizar Finanzas**."
            ),
        ),
        ProductKnowledgeRule(
            topic="dashboard",
            terms=(
                "que muestra dashboard",
                "que muestra el dashboard",
                "para que sirve dashboard",
                "para que sirve el dashboard",
                "pantalla principal",
                "dashboard",
            ),
            content=(
                "El **Dashboard** resume tu perfil financiero, ingresos, gastos, "
                "balance, gastos mensuales, categorías, capacidad de ahorro, nivel "
                "de endeudamiento, últimas transacciones y recomendaciones."
            ),
        ),
        ProductKnowledgeRule(
            topic="savings_capacity",
            terms=(
                "que es la capacidad de ahorro",
                "que significa capacidad de ahorro",
                "como se calcula la capacidad de ahorro",
                "que es el ahorro estimado",
            ),
            content=(
                "La **Capacidad de Ahorro** estima qué porcentaje de tus ingresos "
                "queda disponible después de considerar los gastos registrados."
            ),
        ),
        ProductKnowledgeRule(
            topic="debt_level",
            terms=(
                "que es el nivel de endeudamiento",
                "que significa nivel de endeudamiento",
                "como se calcula el nivel de endeudamiento",
                "que significa endeudamiento alto",
            ),
            content=(
                "El **Nivel de Endeudamiento** representa qué proporción de tus "
                "ingresos se destina a deudas."
            ),
        ),
        ProductKnowledgeRule(
            topic="risk_profile",
            terms=(
                "perfil en riesgo",
                "estoy en riesgo",
                "que significa en riesgo",
            ),
            content=(
                "La clasificación **En riesgo** indica que uno o más indicadores "
                "necesitan atención, por ejemplo endeudamiento elevado, gastos altos "
                "o capacidad de ahorro insuficiente."
            ),
        ),
        ProductKnowledgeRule(
            topic="observation_profile",
            terms=(
                "perfil en observacion",
                "que significa en observacion",
                "estoy en observacion",
            ),
            content=(
                "La clasificación **En observación** indica que tu situación es "
                "relativamente estable, pero uno o más indicadores necesitan "
                "seguimiento."
            ),
        ),
        ProductKnowledgeRule(
            topic="healthy_profile",
            terms=(
                "perfil saludable",
                "que significa saludable",
                "estoy saludable",
            ),
            content=(
                "La clasificación **Saludable** indica que, según los datos "
                "registrados, mantienes una relación favorable entre ingresos, "
                "gastos, ahorro y deuda."
            ),
        ),
        ProductKnowledgeRule(
            topic="saving_frequency",
            terms=("frecuencia de ahorro", "que significa nunca"),
            content=(
                "La **Frecuencia de Ahorro** resume con qué regularidad tu perfil "
                "registra capacidad de ahorro."
            ),
        ),
        ProductKnowledgeRule(
            topic="two_factor_unavailable",
            terms=(
                "2fa",
                "autenticacion en dos pasos",
                "autenticacion de dos pasos",
                "doble factor",
                "segundo factor",
                "verificacion en dos pasos",
                "verificacion de dos pasos",
                "google authenticator",
                "authenticator",
            ),
            content=(
                "Actualmente FinSightAI no ofrece autenticación en dos pasos (2FA). "
                "El acceso se realiza mediante correo electrónico y contraseña."
            ),
        ),
        ProductKnowledgeRule(
            topic="pin_unavailable",
            terms=(
                "cambiar mi pin",
                "cambiar el pin",
                "cambiar pin",
                "crear pin",
                "configurar pin",
                "activar pin",
                "pin de seguridad",
                "codigo pin",
                "mi pin",
            ),
            content=(
                "Actualmente FinSightAI no utiliza un PIN de seguridad. El acceso "
                "se realiza con correo electrónico y contraseña."
            ),
        ),
        ProductKnowledgeRule(
            topic="sessions_list_unavailable",
            terms=(
                "ver mis sesiones",
                "ver mi sesion",
                "sesiones activas",
                "sesion activas",
                "donde veo mis sesion activas",
                "dispositivos conectados",
                "dispositivos con sesion",
                "donde inicie sesion",
                "donde tengo la sesion abierta",
                "ver dispositivos",
                "historial de sesiones",
                "lista de sesiones",
            ),
            content=(
                "Actualmente FinSightAI no muestra una lista de sesiones activas o "
                "dispositivos conectados. Desde **Mi cuenta**, en **Zona de peligro**, "
                "puedes usar **Cerrar sesiones**."
            ),
        ),
        ProductKnowledgeRule(
            topic="mobile_app_unavailable",
            terms=(
                "android",
                "ios",
                "iphone",
                "app android",
                "app para android",
                "aplicacion android",
                "hay una app en android",
                "hay app en android",
                "app ios",
                "app para iphone",
                "aplicacion movil",
                "app movil",
                "play store",
                "app store",
            ),
            content=(
                "Actualmente FinSightAI está disponible como aplicación web y no "
                "cuenta con una app nativa para Android o iOS. Puedes usarla desde "
                "el navegador del teléfono."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_capabilities",
            terms=(
                "que podes hacer",
                "como me ayudas",
                "funciones de fins",
                "funciones de finsi",
                "como funciona el asistente",
                "como funciona finsi",
                "como funciona la ia",
                "como funciona el chat",
                "como funciona este asistente",
                "finsi",
            ),
            content=(
                "Puedo ayudarte a analizar ingresos, gastos, ahorro, deudas, presupuesto, "
                "metas y perfil financiero. También puedo responder preguntas sobre "
                "FinSightAI, explicar cómo funciona la aplicación y brindarte "
                "recomendaciones generales para ayudarte a comprender mejor tu situación "
                "financiera."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_limitations",
            terms=(
                "que no podes hacer",
                "que no podés hacer",
                "que no puedes hacer",
                "que no haces",
                "que no sabes hacer",
                "cuales son tus limitaciones",
                "cuáles son tus limitaciones",
                "que cosas no puedes hacer",
                "que cosas no podes hacer",
                "limitaciones",
            ),
            content=(
                "Puedo ayudarte a comprender la información financiera registrada en "
                "FinSightAI y responder preguntas sobre la aplicación. Sin embargo, "
                "no puedo reemplazar a un contador, asesor financiero, abogado o "
                "profesional de la salud. Tampoco puedo acceder a cuentas bancarias "
                "externas, realizar operaciones financieras, tomar decisiones por ti "
                "ni modificar información fuera de FinSightAI. Mis respuestas son "
                "orientativas y se basan únicamente en la información disponible "
                "dentro de la aplicación."
            ),
        ),
        ProductKnowledgeRule(
            topic="support_contact",
            terms=(
                "contactar soporte",
                "mandar mail",
                "correo de soporte",
                "hablar con soporte",
                "como contacto a soporte",
                "como contactar a soporte",
                "como me contacto con soporte",
                "como puedo contactar a soporte",
                "como hablo con soporte",
                "contacto de soporte",
                "quiero hablar con soporte",
            ),
            content=(
                "Puedes contactar con el equipo de soporte desde tu perfil. "
                "Haz clic en tu nombre de usuario, en la esquina superior derecha "
                "de la pantalla, y selecciona **Soporte** en el menú desplegable. "
                "Luego elige **Contactar por correo** para enviar tu consulta al "
                "equipo de TwentyNineDevs (`g9latamteam29@gmail.com`).\n\n"
                "Si es posible, incluye una captura de pantalla y el mensaje de "
                "error. No compartas contraseñas, códigos de verificación ni "
                "datos bancarios."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_name",
            terms=(
                "como te llamas",
                "cual es tu nombre",
                "dime tu nombre",
                "tu nombre",
            ),
            content=(
                "Me llamo **Finsi** y soy el asistente inteligente de FinSightAI. "
                "Estoy aquí para ayudarte a comprender tu información financiera "
                "y responder preguntas sobre la aplicación."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_introduction",
            terms=(
                "presentate",
                "presentate por favor",
                "quien sos",
                "quien eres",
            ),
            content=(
                "¡Hola! Soy **Finsi**, el asistente inteligente de FinSightAI. "
                "Puedo ayudarte a analizar ingresos, gastos, ahorro, deudas, metas "
                "y perfil financiero, además de responder dudas sobre el "
                "funcionamiento de la aplicación."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_ai",
            terms=(
                "sos una ia",
                "eres una ia",
                "sos inteligencia artificial",
                "eres inteligencia artificial",
                "usas inteligencia artificial",
            ),
            content=(
                "Sí. Soy Finsi, un asistente que combina reglas determinísticas "
                "con inteligencia artificial. Fui desarrollado por TwentyNineDevs "
                "para ayudarte con FinSightAI y con la interpretación de tu "
                "información financiera."
            ),
        ),
        ProductKnowledgeRule(
            topic="assistant_identity",
            terms=(
                "sos chatgpt",
                "eres chatgpt",
                "sos gpt",
                "eres gpt",
                "sos openai",
                "eres openai",
            ),
            content=(
                "Soy **Finsi**, el asistente inteligente de FinSightAI, "
                "desarrollado por TwentyNineDevs para ayudarte con la aplicación "
                "y con tu información financiera."
            ),
        ),
        ProductKnowledgeRule(
            topic="about_finsi",
            terms=(
                "que es finsi",
                "quien es finsi",
            ),
            content=(
                "Finsi es el asistente inteligente de FinSightAI. Fue desarrollado "
                "por TwentyNineDevs para ayudarte a comprender tu información "
                "financiera, resolver dudas sobre la aplicación y brindarte "
                "orientación general."
            ),
        ),
        ProductKnowledgeRule(
            topic="professional_boundary",
            terms=(
                "si fueras mi contador",
                "si fueras un contador",
                "si fueras mi asesor financiero",
                "sos contador",
                "eres contador",
                "podes ser mi contador",
                "puedes ser mi contador",
            ),
            content=(
                "No puedo reemplazar a un contador o asesor financiero profesional. "
                "Para impuestos, inversiones o decisiones económicas importantes, "
                "consulta con un profesional habilitado. Puedo ayudarte a interpretar "
                "tus ingresos, gastos, ahorro, deuda e indicadores de FinSightAI."
            ),
        ),
        ProductKnowledgeRule(
            topic="logout",
            terms=(
                "como cierro sesion",
                "donde cierro sesion",
                "cerrar mi sesion",
                "salir de mi cuenta",
                "como salgo de mi cuenta",
            ),
            content=(
                "Haz clic en tu nombre de usuario, en la esquina superior derecha, "
                "y selecciona **Cerrar sesión** en el menú desplegable."
            ),
        ),
        ProductKnowledgeRule(
            topic="close_all_sessions",
            terms=(
                "como cierro sesion en todos los dispositivos",
                "cerrar sesion en todos los dispositivos",
                "cerrar todas mis sesiones",
                "cerrar sesiones en otros dispositivos",
            ),
            content=(
                "Entra en **Mi cuenta**, desplázate hasta **Zona de peligro** y "
                "selecciona **Cerrar sesiones**."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_pdf_new",
            terms=(
                "como exporto mis datos en pdf",
                "exportar mis datos en pdf",
                "exportar datos en pdf",
                "como exporto en pdf",
                "descargar pdf",
                "generar pdf",
            ),
            content=(
                "Entra en **Transacciones**, selecciona **Exportar** y elige "
                "**Exportar PDF**."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_excel",
            terms=(
                "como exporto en excel",
                "exportar excel",
                "descargar excel",
            ),
            content=(
                "Entra en **Transacciones**, selecciona **Exportar** y elige "
                "**Exportar Excel**."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_dashboard",
            terms=(
                "exportar dashboard",
                "descargar dashboard",
                "como exporto el dashboard",
            ),
            content=(
                "Entra en **Transacciones**, selecciona **Exportar** y elige "
                "**Exportar Dashboard**."
            ),
        ),
        ProductKnowledgeRule(
            topic="export_data",
            terms=(
                "como exporto mis datos",
                "exportar mis datos",
                "como exporto",
                "formatos de exportacion",
                "que formatos puedo exportar",
                "exportar movimientos",
                "descargar movimientos",
            ),
            content=(
                "Puedes exportar tus datos desde **Transacciones**. Selecciona "
                "**Exportar** y elige uno de los formatos disponibles: "
                "**CSV**, **Excel**, **PDF** o **Dashboard**."
            ),
        ),
        ProductKnowledgeRule(
            topic="analysis_purpose",
            terms=(
                "para que sirve analisis",
                "para que sirve la seccion analisis",
                "que hace analisis",
                "como funciona analisis",
            ),
            content=(
                "La sección **Análisis** evalúa tu situación financiera mediante "
                "indicadores como ingresos, nivel de endeudamiento, frecuencia de "
                "ahorro y perfil financiero."
            ),
        ),
        ProductKnowledgeRule(
            topic="edit_goal",
            terms=(
                "como modifico una meta",
                "como edito una meta",
                "modificar meta",
                "editar meta",
                "cambiar una meta",
            ),
            content=(
                "Entra en **Metas**, abre la meta que deseas modificar, actualiza "
                "los datos disponibles y guarda los cambios."
            ),
        ),
        ProductKnowledgeRule(
            topic="delete_goal",
            terms=(
                "como elimino una meta",
                "como borro una meta",
                "eliminar meta",
                "borrar meta",
            ),
            content=(
                "Entra en **Metas**, abre la meta que deseas eliminar, selecciona "
                "**Eliminar** y confirma la acción."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_columns_short",
            terms=(
                "que columnas necesita",
                "que columnas lleva",
                "cuales son las columnas",
            ),
            content=(
                "El CSV debe incluir estas columnas: `fecha, descripcion, monto, "
                "tipo, categoria, medio_pago, recurrente`."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_date_short",
            terms=(
                "cual es el formato de fecha",
                "formato de fecha",
                "como va la fecha",
            ),
            content=(
                "Para el CSV se recomienda usar el formato `AAAA-MM-DD`, por "
                "ejemplo `2026-08-06`."
            ),
        ),
        ProductKnowledgeRule(
            topic="csv_size_short",
            terms=(
                "cuanto puede pesar",
                "peso maximo",
                "tamano maximo",
                "limite de tamano",
            ),
            content="El archivo CSV puede pesar como máximo **5 MB**.",
        ),
        ProductKnowledgeRule(
            topic="support_menu",
            terms=(
                "necesito soporte",
                "necesito ayuda con la aplicacion",
                "ayuda con finsightai",
            ),
            content=(
                "¿Con qué sección necesitas ayuda? Puedes indicar: "
                "**inicio de sesión**, **contraseña**, **cuenta**, **CSV**, "
                "**transacciones**, **metas**, **Dashboard**, **Análisis**, "
                "**exportaciones** u **otro problema**."
            ),
        ),
        ProductKnowledgeRule(
            topic="clarification",
            terms=(
                "no entendi",
                "no comprendi",
                "explicalo de nuevo",
            ),
            content=(
                "Claro. Indica qué parte deseas que explique nuevamente o "
                "escribe la pregunta con otras palabras."
            ),
        ),
        ProductKnowledgeRule(
            topic="security_refusal",
            terms=(
                "como hackeo una cuenta",
                "hackear una cuenta",
                "robar una cuenta",
                "entrar a una cuenta ajena",
            ),
            content=(
                "No puedo ayudar a acceder sin autorización a una cuenta ni a "
                "vulnerar su seguridad. Si necesitas recuperar tu propia cuenta, "
                "usa **¿Olvidaste tu contraseña?** o contacta a soporte."
            ),
        ),
    )

    @classmethod
    def answer(cls, question: str) -> ProductKnowledgeResult | None:
        normalized = SupportQueryNormalizer.normalize(question)
        if not normalized:
            return None

        # Product Knowledge responde consultas informativas.
        # Si el usuario describe un problema técnico explícito, no debe
        # interceptarlo: el orquestador debe enviarlo al diagnóstico guiado.
        technical_problem_markers = (
            "no puedo",
            "no me deja",
            "no funciona",
            "no anda",
            "no responde",
            "no carga",
            "no aparece",
            "no recibo",
            "se queda cargando",
            "se trabo",
            "se bloqueo",
            "error",
            "falla",
            "fallo",
            "rechazada",
            "rechazado",
            "incorrecta",
            "incorrecto",
            "invalida",
            "invalido",
            "bloqueada",
            "bloqueado",
            "vencido",
            "vencio",
            "desaparecio",
            "perdi mis",
        )

        if any(marker in normalized for marker in technical_problem_markers):
            return None

        best_rule: ProductKnowledgeRule | None = None
        best_len = -1

        for rule in cls._RULES:
            for term in rule.terms:
                if term in normalized and len(term) > best_len:
                    best_rule = rule
                    best_len = len(term)

        if best_rule is None:
            return None

        return cls._result(best_rule.topic, best_rule.content)

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