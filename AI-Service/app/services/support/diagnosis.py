from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import re

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class DiagnosisResult:
    content: str
    route: str
    solved: bool = False
    escalate: bool = False


class SupportState(str, Enum):
    NONE = "none"
    PASSWORD_TRIAGE = "password_triage"
    PASSWORD_WAITING_ERROR = "password_waiting_error"
    PASSWORD_REQUIREMENTS_CONFIRMATION = "password_requirements_confirmation"
    CSV_TRIAGE = "csv_triage"
    CSV_WAITING_ERROR = "csv_waiting_error"
    CSV_REQUIREMENTS_CONFIRMATION = "csv_requirements_confirmation"


class GuidedSupportDiagnosis:
    """Árbol de diagnóstico técnico sin memoria persistente.

    Usa únicamente la consulta actual y la última respuesta enviada por el
    asistente. Esto permite una conversación guiada dentro de la sesión sin
    almacenar historial en Spring ni Supabase.
    """

    _UNRESOLVED_TERMS = (
        "sigue igual",
        "sigue sin funcionar",
        "no funciono",
        "no funciona",
        "ninguna",
        "otro problema",
        "ya probe",
        "hice todo",
        "persiste",
        "todavia no",
        "sigue en blanco",
        "sigue la ventana en blanco",
        "continua en blanco",
        "continua igual",
        "no cambio",
        "no se resolvio",
        "no sirvio",
        "no me sirvio",
        "ya lo hice",
        "ya hice eso",
        "sigue fallando",
        "aún no puedo",
        "todavia no puedo",
    )

    @classmethod
    def diagnose(
        cls,
        usuario_id: str,
        question: str,
        previous_answer: str | None,
        support_email: str,
    ) -> DiagnosisResult | None:
        current = SupportQueryNormalizer.normalize(question)
        previous = SupportQueryNormalizer.normalize(previous_answer or "")
        raw_current = current

        # El menú del Dashboard usa la última respuesta como estado. Resolvemos
        # sus opciones antes del enrutamiento general para que una respuesta
        # breve (1/2/3/4) no caiga en el fallback de soporte.
        if cls._is_dashboard_triage_prompt(previous) and raw_current in {"1", "2", "3", "4"}:
            if raw_current == "1":
                return cls._support_page_referral(
                    "Eso no debería ocurrir y requiere una revisión del equipo. "
                    "Verifica que estés en la cuenta correcta y no importes ni elimines "
                    "movimientos hasta que se revise el caso."
                )
            if raw_current == "2":
                return cls._solved(
                    "Actualiza la página, verifica que estés en la cuenta correcta y confirma "
                    "que tengas movimientos cargados. Si el Dashboard continúa vacío después "
                    "de actualizar, vuelve a escribir `sigue vacío` para derivar el caso a soporte.",
                    "support_dashboard_empty",
                )
            if raw_current == "3":
                return DiagnosisResult(
                    content=(
                        "Indica qué dato no coincide: ingresos, gastos, balance o cantidad de "
                        "movimientos. Si es posible, incluye el período que estás revisando. "
                        "No elimines ni vuelvas a importar movimientos mientras verificamos el caso."
                    ),
                    route="support_dashboard_totals_detail",
                )
            return DiagnosisResult(
                content=(
                    "Copia el mensaje exacto que aparece en el Dashboard e indica qué estabas "
                    "haciendo cuando ocurrió. No compartas contraseñas, códigos de verificación, "
                    "números de tarjeta ni datos bancarios."
                ),
                route="support_dashboard_waiting_error",
            )

        current = cls._resolve_numbered_choice(current, previous)
        combined = f"{previous} {current}".strip()

        # Respuestas breves afirmativas/negativas deben continuar la última
        # pregunta del diagnóstico, no volver al asesor financiero.
        yes = current in {"si", "sí", "sip", "sipi", "correcto", "claro", "dale", "ok"}
        no = current in {"no", "nop", "nope", "todavia no", "aún no"}

        # Detecta primero si el usuario inició un tema nuevo. Una consulta completa
        # debe cancelar el estado anterior; solo respuestas breves continúan el flujo.
        explicit_csv_query = cls._is_explicit_csv_query(current)
        explicit_password_query = cls._is_explicit_password_query(current)
        explicit_dashboard_query = cls._is_explicit_dashboard_query(current)

        # Seguridad de datos: una consulta nueva sobre movimientos, compras o
        # gastos no reconocidos tiene prioridad absoluta sobre cualquier flujo
        # previo de CSV o contraseña. Nunca debe terminar en estadísticas.
        if cls._is_unrecognized_transaction_query(current):
            return cls._support_page_referral(
                "Eso no debería ocurrir y requiere una revisión del equipo. "
                "Verifica que estés en la cuenta correcta y no importes ni elimines "
                "movimientos hasta que se revise el caso."
            )

        # Un problema genérico del Dashboard debe abrir un diagnóstico propio,
        # sin reutilizar accidentalmente el estado de una importación CSV.
        if cls._is_generic_dashboard_problem(current):
            return DiagnosisResult(
                content=(
                    "Entiendo. Para revisar el Dashboard, indica cuál situación describe mejor el problema:\n\n"
                    "1. Aparecen movimientos, compras o gastos que no reconoces.\n"
                    "2. El Dashboard está vacío o no muestra datos.\n"
                    "3. Los totales o el balance no coinciden.\n"
                    "4. Aparece un mensaje de error.\n\n"
                    "Puedes responder con el número o describir el problema con tus palabras."
                ),
                route="support_dashboard_triage",
            )

        state = cls._infer_state(previous)
        if state in {
            SupportState.PASSWORD_TRIAGE,
            SupportState.PASSWORD_WAITING_ERROR,
            SupportState.PASSWORD_REQUIREMENTS_CONFIRMATION,
        } and explicit_csv_query:
            state = SupportState.NONE
        elif state in {
            SupportState.CSV_TRIAGE,
            SupportState.CSV_WAITING_ERROR,
            SupportState.CSV_REQUIREMENTS_CONFIRMATION,
        } and explicit_password_query:
            state = SupportState.NONE
        elif explicit_dashboard_query:
            state = SupportState.NONE

        if state == SupportState.CSV_WAITING_ERROR:
            known = cls._known_csv_error(current)
            if known is not None:
                return known

            if cls._contains_any(
                current,
                (
                    "error al cargar csv",
                    "error de carga csv",
                    "error al importar csv",
                    "no se pudo cargar",
                    "no se pudo importar",
                    "muestra error",
                    "error desconocido",
                ),
            ):
                return DiagnosisResult(
                    content=(
                        "Ese mensaje es general y no permite identificar la fila o columna que causó el problema. "
                        "Revisemos los requisitos básicos antes de derivar el caso:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\n¿El archivo cumple todos estos requisitos? Responde `sí` o `no`."
                    ),
                    route="support_csv_requirements_confirmation",
                )

            return cls._support_page_referral(
                "No pude identificar una solución segura para ese mensaje de importación."
            )

        if state == SupportState.CSV_TRIAGE:
            if cls._contains_any(current, ("archivo rechazado", "archivo invalido", "figura como invalido")):
                return DiagnosisResult(
                    content=(
                        "Revisa que el archivo sea un CSV real, que pese como máximo **5 MB** y que incluya estas columnas:\n\n"
                        "`fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`\n\n"
                        "Si el archivo cumple todo y sigue siendo rechazado, responde `sigue igual`."
                    ),
                    route="support_csv_rejected_diagnosis",
                )

            if cls._contains_any(
                current,
                (
                    "aparece un error durante el proceso",
                    "error durante el proceso",
                    "aparece un error",
                    "muestra error",
                    "me tira error",
                    "me da error",
                    "error al procesar",
                ),
            ):
                return DiagnosisResult(
                    content=(
                        "Copia y pega el mensaje exacto que aparece durante la importación. "
                        "Si menciona una fila o una columna, incluye también esa parte.\n\n"
                        "No compartas contraseñas, códigos de verificación, números de tarjeta ni datos bancarios."
                    ),
                    route="support_csv_waiting_exact_error",
                )

            if cls._contains_any(
                current,
                (
                    "carga termina pero no aparecen movimientos",
                    "termina pero no aparecen movimientos",
                    "no aparecen movimientos",
                    "no se guardan movimientos",
                ),
            ):
                return DiagnosisResult(
                    content=(
                        "Confirma si el resultado final de la importación muestra una cantidad de movimientos mayor que cero.\n\n"
                        "Responde `sí` o `no`."
                    ),
                    route="support_csv_processed_count_check",
                )

            if cls._contains_any(
                current,
                (
                    "vista previa queda en cero",
                    "vista previa esta en cero",
                    "vista previa vacia",
                    "preview en cero",
                ),
            ):
                return DiagnosisResult(
                    content=(
                        "Confirma si el archivo tiene filas debajo del encabezado y si la columna `monto` contiene valores mayores que cero.\n\n"
                        "¿El archivo cumple ambas condiciones? Responde `sí` o `no`."
                    ),
                    route="support_csv_preview_zero_check",
                )

            return DiagnosisResult(
                content=cls._csv_triage_text(),
                route="support_csv_triage",
            )

        if state == SupportState.PASSWORD_REQUIREMENTS_CONFIRMATION:
            if yes:
                return cls._support_page_referral(
                    "Si la contraseña cumple todos los requisitos y aun así es rechazada, "
                    "el equipo necesita revisar el proceso de cambio de contraseña."
                )
            if no:
                return cls._solved(
                    cls._password_requirements_text()
                    + "\n\nCorrige los requisitos pendientes e intenta guardar la contraseña nuevamente.",
                    "support_password_requirements_fix",
                )

        if state == SupportState.PASSWORD_WAITING_ERROR:
            if cls._is_current_password_error(current):
                return cls._solved(
                    cls._current_password_error_text(),
                    "support_current_password_incorrect",
                )
            if cls._contains_any(current, ("8 caracteres", "menos de 8", "muy corta", "debe tener al menos")):
                return cls._solved(
                    cls._password_requirements_text(),
                    "support_password_too_short",
                )
            if cls._contains_any(current, ("no coinciden", "no coincide", "confirmacion", "son distintas")):
                return cls._solved(
                    "La contraseña y la confirmación deben ser exactamente iguales. Revisa mayúsculas, espacios y caracteres especiales.",
                    "support_password_mismatch",
                )
            return cls._support_page_referral(
                "Ese mensaje no permite identificar una corrección segura desde el chat. El equipo necesita revisar el error de cambio de contraseña."
            )

        if state == SupportState.PASSWORD_TRIAGE:
            if cls._contains_any(current, ("la nueva contrasena es rechazada", "contrasena rechazada")):
                return DiagnosisResult(
                    content=(
                        cls._password_requirements_text()
                        + "\n\n¿La contraseña cumple todos estos requisitos? Responde `sí` o `no`."
                    ),
                    route="support_password_rejected",
                )
            if cls._contains_any(current, ("no aparece la opcion", "no encuentro cambiar contrasena", "boton no aparece")):
                return cls._solved(
                    "Con la sesión iniciada, entra en **Mi cuenta**, busca **Seguridad** y selecciona **Cambiar contraseña**. Si la opción no aparece después de actualizar la página, escribe `sigue igual`.",
                    "support_password_option_missing",
                )
            if cls._contains_any(current, (
                "mensaje de error", "me tira error", "me da error", "muestra error",
                "aparece un error", "da error", "error al guardar", "error al cambiar",
                "error al crear", "no me deja guardar", "no me deja cambiarla",
            )):
                return DiagnosisResult(
                    content=(
                        "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña.\n\n"
                        "Antes de continuar, verifica que incluya:\n\n"
                        "- Al menos **8 caracteres**.\n"
                        "- Una letra **mayúscula** (`A-Z`).\n"
                        "- Una letra **minúscula** (`a-z`).\n"
                        "- Un número (`0-9`).\n"
                        "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
                        "La contraseña y su confirmación deben coincidir exactamente. "
                        "Si el mensaje indica un error interno o muestra un código, el caso será derivado a soporte.\n\n"
                        "Por seguridad, no escribas ni compartas tu contraseña en este chat."
                    ),
                    route="support_password_exact_error",
                )
            if cls._contains_any(current, ("no puedo iniciar sesion", "no me deja iniciar sesion", "no puedo entrar")):
                return DiagnosisResult(
                    content=(
                        "Verifica que el correo esté escrito correctamente. Si no recuerdas la contraseña, usa **¿Olvidaste tu contraseña?** "
                        "y revisa Spam o Correo no deseado. Si ya hiciste eso y sigue fallando, escribe `sigue igual`."
                    ),
                    route="support_login_diagnosis",
                )

        if state == SupportState.CSV_REQUIREMENTS_CONFIRMATION:
            if yes:
                return cls._support_page_referral(
                    "Perfecto. Si el archivo cumple todos los requisitos y aún así no puede importarse, el problema necesita una revisión técnica del equipo."
                )
            if no:
                return DiagnosisResult(
                    content=(
                        "Antes de volver a importar el archivo, corrige los requisitos que no se cumplen:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\nCuando esté corregido, guárdalo como CSV y vuelve a intentar la importación."
                    ),
                    route="support_csv_requirements_fix",
                )

        # Una consulta completa sobre un tema nuevo debe iniciar ese flujo sin
        # quedar contaminada por la respuesta anterior. El contexto previo se
        # conserva solo para respuestas breves como "3", "me tira error" o "sí".
        # Cierre conversacional posterior a una solución. La interfaz puede
        # representar estas opciones como botones Sí/No; el backend también
        # acepta las palabras escritas.
        if "puedo ayudarte con algo mas" in previous:
            if no:
                return DiagnosisResult(
                    content="De acuerdo. Si necesitas ayuda nuevamente, aquí estaré. ¡Hasta luego!",
                    route="support_conversation_closed",
                    solved=True,
                )
            if yes:
                return DiagnosisResult(
                    content="Claro. Cuéntame con qué otra función o problema de FinSightAI necesitas ayuda.",
                    route="support_conversation_continue",
                )

        # Casos de seguridad o posible mezcla de datos: no se diagnostican por chat.
        if cls._contains_any(current, (
            "transacciones que no hice", "movimientos que no hice",
            "transacciones no son mias", "movimientos no son mios",
            "datos de otra persona", "cuenta comprometida", "me hackearon",
            "acceso no autorizado", "perdi mis transacciones",
        )):
            return cls._support_page_referral(
                "Eso no debería ocurrir y requiere una revisión del equipo. Verifica que estés en la cuenta correcta y no importes ni elimines movimientos hasta que se revise el caso."
            )

        # Errores conocidos de importación CSV.
        column_match = re.search(r"no se pudo leer la columna\s+([a-z_]+)", current)
        if column_match:
            column = column_match.group(1)
            tips = {
                "fecha": "Usa el encabezado `fecha` y valores válidos, preferentemente con formato `AAAA-MM-DD`.",
                "monto": "Usa el encabezado `monto`, valores numéricos mayores que cero y sin símbolos de moneda.",
                "tipo": "Usa el encabezado `tipo` y únicamente los valores `Ingreso` o `Gasto`.",
                "categoria": "Usa el encabezado `categoria` y evita celdas vacías.",
                "medio_pago": "Usa el encabezado `medio_pago` y evita celdas vacías.",
                "recurrente": "Usa el encabezado `recurrente` con `Sí/No`, `true/false` o `1/0`.",
                "descripcion": "Usa el encabezado `descripcion` y evita celdas vacías.",
            }
            detail = tips.get(column, "Comprueba que el encabezado exista exactamente y que sus valores tengan el formato esperado.")
            return cls._solved(
                f"No se pudo procesar la columna **{column}**.\n\n{detail}\n\nGuarda el archivo como CSV UTF-8 y vuelve a importarlo.",
                "support_csv_known_column_error",
            )

        if cls._contains_any(current, ("archivo demasiado grande", "supera 5 mb", "mas de 5 mb")):
            return cls._solved(
                "El archivo supera el límite permitido. Redúcelo a **5 MB o menos**, divídelo en varios CSV si hace falta y vuelve a importarlo.",
                "support_csv_file_too_large",
            )

        if cls._contains_any(current, ("utf 8", "utf-8", "codificacion", "encoding")) and cls._is_csv_context(combined):
            return cls._solved(
                "Vuelve a guardar el archivo como **CSV UTF-8**. En Excel o Google Sheets usa `Guardar como` o `Descargar` y elige CSV UTF-8 antes de importarlo otra vez.",
                "support_csv_encoding",
            )

        if cls._contains_any(current, ("delimitador", "separador", "punto y coma")) and cls._is_csv_context(combined):
            return cls._solved(
                "El CSV parece usar un separador incompatible. Vuelve a exportarlo como CSV estándar y verifica que todas las filas mantengan la misma cantidad de columnas.",
                "support_csv_delimiter",
            )

        # Errores conocidos de contraseña pueden resolverse directamente,
        # aunque el usuario no haya iniciado previamente el menú guiado.
        if cls._is_current_password_error(current):
            return cls._solved(
                cls._current_password_error_text(),
                "support_current_password_incorrect",
            )

        # Consulta informativa directa sobre los requisitos de contraseña.
        # No necesita comenzar con un error ni con "no puedo".
        if cls._contains_any(
            current,
            (
                "que requisitos necesita la contrasena",
                "requisitos de la contrasena",
                "que contrasena tengo que poner",
                "como debe ser la contrasena",
                "que debe tener la contrasena",
                "como crear una contrasena segura",
            ),
        ):
            return DiagnosisResult(
                content=cls._password_requirements_text(),
                route="support_password_requirements",
                solved=True,
            )

        # Inicio explícito de un flujo de contraseña. Se evalúa con la consulta
        # actual (no con combined) para que un caso anterior de CSV no lo envíe
        # al fallback equivocado.
        if explicit_password_query:
            if cls._contains_any(
                current,
                (
                    "que requisitos necesita la contrasena",
                    "requisitos de la contrasena",
                    "que contrasena tengo que poner",
                    "como debe ser la contrasena",
                    "que debe tener la contrasena",
                    "no me acepta la clave",
                    "no me acepta la contrasena",
                ),
            ):
                return DiagnosisResult(
                    content=cls._password_requirements_text(),
                    route="support_password_requirements",
                    solved=True,
                )

            if cls._contains_any(current, (
                "olvide mi contrasena", "recuperar contrasena",
                "restablecer contrasena", "no recuerdo mi contrasena",
            )):
                return DiagnosisResult(
                    content=(
                        "Desde la pantalla de inicio de sesión, selecciona **¿Olvidaste tu contraseña?**, "
                        "ingresa tu correo y sigue el enlace de recuperación. Revisa también Spam o Correo no deseado.\n\n"
                        "Si el correo no llega o el enlace falla, escribe `sigue igual` y te derivo a soporte."
                    ),
                    route="support_password_recovery_diagnosis",
                )
            if cls._contains_any(current, (
                "no puedo iniciar sesion", "no me deja iniciar sesion",
                "no puedo entrar", "login no funciona",
            )):
                return DiagnosisResult(
                    content=(
                        "Prueba verificar el correo y usar **¿Olvidaste tu contraseña?** si no recuerdas la clave. "
                        "Revisa Spam si no llega el mensaje de recuperación.\n\n"
                        "Si ya hiciste estos pasos y todavía no puedes entrar, responde `sigue igual`."
                    ),
                    route="support_login_diagnosis",
                )
            return DiagnosisResult(
                content=(
                    "Vamos a revisar qué ocurre con la contraseña:\n\n"
                    "1. La nueva contraseña es rechazada.\n"
                    "2. No aparece la opción para cambiarla.\n"
                    "3. Aparece un mensaje de error al guardar.\n"
                    "4. No puedo iniciar sesión.\n\n"
                    "Puedes responder con el número o describir el problema con tus palabras."
                ),
                route="support_password_triage",
            )

        # Errores comunes de contraseña.
        if cls._is_password_context(combined):
            if cls._contains_any(current, ("menos de 8", "muy corta", "8 caracteres", "debe tener al menos")):
                return cls._solved(
                    cls._password_requirements_text(),
                    "support_password_too_short",
                )
            if cls._contains_any(current, ("no coinciden", "confirmacion no coincide", "distintas")):
                return cls._solved(
                    "La contraseña y su confirmación deben ser exactamente iguales. Vuelve a escribir ambos campos y comprueba mayúsculas, espacios y caracteres especiales.",
                    "support_password_mismatch",
                )
            if cls._contains_any(current, ("error al querer crear", "error al crear", "error al cambiar", "no me deja guardar", "me tira error")) and previous:
                return cls._support_page_referral(
                    "La contraseña ya cumple los requisitos básicos pero la aplicación sigue mostrando un error. El equipo debe revisar el caso."
                )

        # Confirmación del checklist CSV. Si el archivo cumple todo y el
        # error persiste, derivamos a la página de Soporte sin abrir el mail.
        if cls._asked_csv_requirements(previous):
            if yes:
                return cls._support_page_referral(
                    intro=(
                        "Perfecto. Si el archivo cumple todos los requisitos y aún así no puede importarse, "
                        "el problema necesita una revisión técnica del equipo."
                    ),
                )
            if no:
                return DiagnosisResult(
                    content=(
                        "Antes de volver a importar el archivo, corrige los requisitos que no se cumplen:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\nCuando esté corregido, guárdalo como CSV y vuelve a intentar la importación."
                    ),
                    route="support_csv_requirements_fix",
                )

        # Regla global anti-bucle: si el usuario confirma que el problema
        # continúa después de una respuesta de soporte, no repetimos pasos.
        if previous and cls._contains_any(current, cls._UNRESOLVED_TERMS) and cls._looks_like_support_answer(previous):
            return cls._escalation(
                usuario_id,
                question,
                previous_answer,
                support_email,
                category=cls._support_category(previous),
            )

        # Consulta demasiado vaga: guiamos al usuario hacia el módulo afectado.
        if cls._contains_any(current, ("no anda", "no funciona", "se rompio", "no responde", "me muestra error", "muestra error")) and not previous:
            return DiagnosisResult(
                content=(
                    "¿Con qué parte de FinSightAI necesitás ayuda?\n\n"
                    "1. Inicio de sesión o contraseña.\n"
                    "2. Dashboard o datos que no aparecen.\n"
                    "3. Transacciones.\n"
                    "4. Importar CSV.\n"
                    "5. Descargar PDF o exportar.\n"
                    "6. Metas o recomendaciones.\n\n"
                    "Responde con el número o describe qué estabas intentando hacer."
                ),
                route="support_general_triage",
            )

        if "cantidad de movimientos mayor que cero" in previous:
            if no:
                return cls._escalation(
                    usuario_id,
                    "La importación finalizó sin procesar movimientos.",
                    previous_answer,
                    support_email,
                    category="Importación CSV sin movimientos",
                    intro=(
                        "La importación no llegó a procesar ningún movimiento. "
                        "Antes de derivarlo, comprueba que el archivo tenga filas debajo del encabezado, "
                        "que los montos sean mayores que cero y que el tipo sea `Ingreso` o `Gasto`. "
                        "Si el archivo ya cumple con eso, el equipo de soporte tendrá que revisarlo."
                    ),
                )
            if yes:
                return DiagnosisResult(
                    content=(
                        "Perfecto, entonces los movimientos sí fueron procesados. "
                        "Actualiza la página y vuelve a la pantalla principal, donde aparecen tus ingresos y gastos.\n\n"
                        "¿Ahora aparecen los movimientos? Responde `sí` o `no`."
                    ),
                    route="support_csv_preview_refresh",
                )

        if "ahora aparecen los movimientos" in previous:
            if yes:
                return DiagnosisResult(
                    content="¡Perfecto! Me alegra que los movimientos ya aparezcan en la pantalla principal.",
                    route="support_csv_resolved",
                    solved=True,
                )
            if no:
                return cls._escalation(
                    usuario_id,
                    "Los movimientos fueron procesados, pero no aparecen en la pantalla principal.",
                    previous_answer,
                    support_email,
                    category="Movimientos no visibles",
                )

        # Errores conocidos: respuesta directa, sin preguntas redundantes.
        if "monto debe ser mayor que cero" in current:
            return DiagnosisResult(
                content=(
                    "Ese error aparece cuando alguna fila tiene un monto negativo o igual a cero.\n\n"
                    "1. Convierte todos los montos a valores positivos.\n"
                    "2. Para los egresos, mantén `Gasto` en la columna `tipo`.\n"
                    "3. Guarda el archivo como CSV UTF-8 y vuelve a importarlo.\n\n"
                    "Los gastos no llevan signo negativo: FinSightAI usa la columna `tipo` para distinguirlos."
                ),
                route="support_known_error",
                solved=True,
            )

        if "vista previa" in current and ("cero" in current or "0" in current):
            return DiagnosisResult(
                content=(
                    "Entiendo. Primero confirmemos una cosa: ¿el mensaje final de la importación indica una cantidad de movimientos mayor que cero?\n\n"
                    "Responde `sí` o `no`. Con eso seguimos al próximo paso."
                ),
                route="support_csv_preview_diagnosis",
            )

        # Una consulta general de CSV inicia un diagnóstico corto. El checklist
        # se muestra únicamente cuando el mensaje exacto no permite identificar
        # una solución concreta.
        generic_csv_load_problem = (
            "csv" in current
            and cls._contains_any(
                current,
                (
                    "no puedo cargar",
                    "no me deja cargar",
                    "no puedo importar",
                    "no me deja importar",
                    "no puedo subir",
                    "no me deja subir",
                    "error al cargar",
                    "error de carga",
                    "error al importar",
                    "problema al cargar",
                    "problema al importar",
                    "falla al cargar",
                    "falla al importar",
                    "muestra error",
                ),
            )
        )
        if generic_csv_load_problem:
            return DiagnosisResult(
                content=cls._csv_triage_text(),
                route="support_csv_triage",
            )

        # Continuación de diagnóstico CSV.
        if cls._is_csv_context(combined):
            if cls._should_escalate(current, previous):
                return cls._escalation(
                    usuario_id,
                    question,
                    previous_answer,
                    support_email,
                    category="Importación CSV",
                )

            if cls._contains_any(
                current,
                (
                    "error al cargar csv",
                    "error al cargar archivo csv",
                    "no se puede cargar",
                    "no me deja cargar",
                ),
            ) and cls._contains_any(
                previous,
                ("mensaje exacto", "copialo tal como aparece", "texto completo del error"),
            ):
                return DiagnosisResult(
                    content=(
                        "Ese mensaje es general y no indica qué fila o columna causó el problema. "
                        "Antes de derivarte, confirmemos que el archivo cumple todos los requisitos de FinSightAI:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\n¿El archivo cumple **todos** estos requisitos? Responde `sí` o `no`."
                    ),
                    route="support_csv_requirements_confirmation",
                )

            if cls._contains_any(current, ("error durante el proceso", "aparece un error", "error al procesar")):
                return DiagnosisResult(
                    content=(
                        "Entiendo: aparece un error durante la importación. Para identificar la causa necesito el mensaje exacto.\n\n"
                        "Copia y pega el texto completo del error que muestra FinSightAI. Si menciona una fila o una columna, incluye esa parte también.\n\n"
                        "Por tu seguridad, no compartas tu contraseña, códigos de verificación, números de tarjeta ni datos bancarios."
                    ),
                    route="support_csv_process_error_diagnosis",
                )

            if cls._contains_any(current, ("invalido", "rechazado", "columnas", "formato")):
                return DiagnosisResult(
                    content=(
                        "Revisemos el archivo. Para que FinSightAI pueda importarlo debe cumplir estos requisitos:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\n¿El archivo cumple **todos** estos requisitos? Responde `sí` o `no`."
                    ),
                    route="support_csv_requirements_confirmation",
                )

            if cls._contains_any(current, ("termina", "correctamente", "no aparece", "no guarda", "pantalla principal", "dashboard", "cero")):
                return DiagnosisResult(
                    content=(
                        "Entiendo: la carga termina, pero después no ves los movimientos. Probemos esto:\n\n"
                        "1. Confirma que el resultado muestre más de 0 movimientos.\n"
                        "2. Actualiza la página y vuelve a la pantalla principal, donde aparecen tus ingresos y gastos.\n"
                        "3. Verifica que estés usando la misma cuenta con la que importaste.\n\n"
                        "¿Cuál de estas situaciones describe mejor lo que ves?\n"
                        "- La vista previa muestra 0.\n"
                        "- La vista previa muestra movimientos, pero la pantalla principal no los muestra.\n"
                        "- Aparece un error después de confirmar la carga."
                    ),
                    route="support_csv_saved_diagnosis",
                )

            if "vacio" in current:
                return DiagnosisResult(
                    content=(
                        "Abre el CSV y verifica que tenga al menos una fila de movimientos debajo del encabezado. "
                        "También confirma que no sea un archivo de Excel renombrado: debe guardarse realmente como CSV UTF-8.\n\n"
                        "¿El archivo tiene filas visibles cuando lo abres con un editor de texto o una planilla?"
                    ),
                    route="support_csv_empty_diagnosis",
                )

            if previous:
                return cls._support_page_referral(
                    "No reconocí ese mensaje de error con suficiente seguridad y no quiero hacerte repetir el diagnóstico ni inventar una solución."
                )

            return DiagnosisResult(
                content=(
                    "Vamos a ubicar en qué parte falla la importación. ¿Qué ocurre exactamente?\n\n"
                    "1. El archivo es rechazado o figura como inválido.\n"
                    "2. La carga termina, pero no aparecen movimientos.\n"
                    "3. Aparece un error durante el proceso.\n"
                    "4. La vista previa queda en cero.\n\n"
                    "Responde con el número o con una oración que describa lo que ocurre."
                ),
                route="support_csv_triage",
            )

        # Continuación de diagnóstico PDF. La etapa se infiere desde la
        # última respuesta del asistente, por lo que no requiere memoria
        # persistente ni cambios en Spring/Supabase.
        if cls._is_pdf_context(combined):
            return cls._diagnose_pdf(
                usuario_id=usuario_id,
                question=question,
                current=current,
                previous=previous,
                previous_answer=previous_answer,
                support_email=support_email,
            )

        # Dashboard y datos visibles. Los casos simples reciben una única
        # comprobación; los datos ajenos o inconsistencias persistentes van a soporte.
        if cls._is_dashboard_context(combined):
            if cls._contains_any(current, (
                "transacciones que no hice", "movimientos que no hice",
                "transacciones no son mias", "movimientos no son mios",
                "datos de otra persona", "no reconozco esos movimientos",
            )):
                return cls._support_page_referral(
                    "Esos movimientos no deberían aparecer en tu cuenta. Verifica que hayas iniciado sesión con el usuario correcto y no importes ni elimines datos hasta que el equipo revise el caso."
                )
            if cls._contains_any(current, (
                "dashboard vacio", "dashboard en blanco", "no aparecen datos",
                "no veo mis datos", "graficos vacios", "no aparecen los graficos",
            )):
                return cls._solved(
                    "Actualiza la página, verifica que estés en la cuenta correcta y confirma que tengas movimientos cargados. Si el Dashboard sigue vacío, escribe `sigue igual` y te derivo a soporte.",
                    "support_dashboard_empty",
                )
            if cls._contains_any(current, (
                "balance incorrecto", "balance esta mal", "totales incorrectos",
                "ingresos incorrectos", "gastos incorrectos", "datos no coinciden",
            )):
                return cls._support_page_referral(
                    "Una diferencia en los totales necesita revisión técnica. No modifiques ni vuelvas a importar movimientos hasta que el equipo pueda comparar los datos de tu cuenta."
                )

        # Contraseña y acceso. Primero se evalúa el problema actual para no
        # repetir la explicación de cambio de contraseña cuando el usuario ya
        # aclaró que no puede iniciar sesión.
        if cls._is_password_context(combined):
            if cls._asked_password_error_message(previous):
                if cls._contains_any(current, ("8 caracteres", "menos de 8", "muy corta", "debe tener al menos")):
                    return cls._solved(
                        "La nueva contraseña debe tener al menos **8 caracteres**. Escríbela nuevamente y repítela exactamente igual en el campo de confirmación.",
                        "support_password_too_short",
                    )
                if cls._contains_any(current, ("no coinciden", "no coincide", "confirmacion", "son distintas")):
                    return cls._solved(
                        "La contraseña y la confirmación deben ser exactamente iguales. Revisa mayúsculas, espacios y caracteres especiales.",
                        "support_password_mismatch",
                    )
                return cls._support_page_referral(
                    "No reconocí ese mensaje de contraseña con suficiente seguridad. El equipo necesita revisar el error exacto que muestra la aplicación."
                )

            if cls._contains_any(current, ("la nueva contrasena es rechazada", "contrasena rechazada")):
                return DiagnosisResult(
                    content=(
                        cls._password_requirements_text()
                        + "\n\n¿La contraseña cumple todos estos requisitos? Responde `sí` o `no`."
                    ),
                    route="support_password_rejected",
                )
            if cls._contains_any(current, ("no aparece la opcion", "no encuentro cambiar contrasena", "boton no aparece")):
                return cls._solved(
                    "Con la sesión iniciada, entra en **Mi cuenta**, busca **Seguridad** y selecciona **Cambiar contraseña**. Si la opción no aparece después de actualizar la página, escribe `sigue igual`.",
                    "support_password_option_missing",
                )

            password_generic_error = cls._contains_any(current, (
                "me tira error", "me da error", "muestra error", "aparece un error", "da error",
                "error al guardar", "error al cambiar", "error al crear",
                "no me deja guardar", "no me deja cambiarla", "falla al guardar",
                "aparece un mensaje de error al guardar",
            ))
            if password_generic_error and previous:
                return DiagnosisResult(
                    content=(
                        "Copia el mensaje exacto que aparece al intentar guardar la nueva contraseña. "
                        "Si indica que debe tener al menos 8 caracteres o que las contraseñas no coinciden, puedo ayudarte a corregirlo. "
                        "Si muestra un error interno o un código, te derivaré a soporte."
                    ),
                    route="support_password_exact_error",
                )

            login_problem = cls._contains_any(
                current,
                (
                    "no puedo iniciar sesion", "no me deja iniciar sesion",
                    "no puedo entrar", "no me deja entrar", "login no funciona",
                    "correo o contrasena incorrectos", "credenciales incorrectas",
                ),
            )
            recovery_problem = cls._contains_any(
                current,
                (
                    "no llega el correo", "no recibi el correo", "correo no llega",
                    "enlace no funciona", "link no funciona", "token vencido",
                ),
            )

            if cls._should_escalate(current, previous):
                return cls._escalation(
                    usuario_id,
                    question,
                    previous_answer,
                    support_email,
                    category="Acceso y contraseña",
                )

            if recovery_problem:
                return DiagnosisResult(
                    content=(
                        "Si el correo de recuperación no llega, revisa **Spam** o **Correo no deseado**, confirma que escribiste el mismo correo con el que te registraste y solicita el enlace una sola vez más.\n\n"
                        "Si el mensaje sigue sin llegar o el enlace aparece vencido, indica `sigue igual` y preparo el contacto con soporte."
                    ),
                    route="support_password_recovery_diagnosis",
                )

            if login_problem:
                return DiagnosisResult(
                    content=(
                        "Si no puedes iniciar sesión, prueba esto:\n\n"
                        "1. Verifica que el correo esté escrito correctamente.\n"
                        "2. Si no recuerdas la contraseña, usa **¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión.\n"
                        "3. Revisa Spam si no recibes el correo de recuperación.\n"
                        "4. Vuelve a intentar con la nueva contraseña después de completar el restablecimiento.\n\n"
                        "Si ya hiciste estos pasos y todavía no puedes entrar, responde `sigue igual` y te derivo al soporte por correo."
                    ),
                    route="support_login_diagnosis",
                )

            return DiagnosisResult(
                content=(
                    "Vamos a revisar qué ocurre con la contraseña:\n\n"
                    "1. La nueva contraseña es rechazada.\n"
                    "2. No aparece la opción para cambiarla.\n"
                    "3. Aparece un mensaje de error al guardar.\n"
                    "4. No puedo iniciar sesión.\n\n"
                    "Puedes responder con el número o describir el problema con tus palabras."
                ),
                route="support_password_triage",
            )

        return None

    @staticmethod
    def _password_requirements_text() -> str:
        return (
            "Para que la contraseña alcance una seguridad **Muy fuerte**, debe incluir:\n\n"
            "- Al menos **8 caracteres**.\n"
            "- Una letra **mayúscula** (`A-Z`).\n"
            "- Una letra **minúscula** (`a-z`).\n"
            "- Un número (`0-9`).\n"
            "- Un símbolo, por ejemplo: `! @ # $ %`.\n\n"
            "Además, la contraseña y su confirmación deben coincidir exactamente. "
            "Si estás creando una cuenta, también debes aceptar los **Términos y condiciones** "
            "y la **Política de privacidad**.\n\n"
            "Por seguridad, no escribas ni compartas tu contraseña en este chat."
        )

    @staticmethod
    def _csv_triage_text() -> str:
        return (
            "Entiendo. Vamos a revisar la importación del archivo.\n\n"
            "¿Qué ocurre exactamente?\n\n"
            "1. El archivo es rechazado o aparece como inválido.\n"
            "2. Aparece un error durante la importación.\n"
            "3. La carga termina, pero no aparecen movimientos.\n"
            "4. La vista previa aparece vacía o en cero.\n\n"
            "Puedes responder con el número o describir el problema con tus palabras."
        )

    @classmethod
    def _known_csv_error(cls, current: str) -> DiagnosisResult | None:
        column_match = re.search(r"no se pudo leer la columna\s+([a-z_]+)", current)
        if column_match:
            column = column_match.group(1)
            tips = {
                "fecha": "Usa el encabezado `fecha` y valores válidos, preferentemente con formato `AAAA-MM-DD`.",
                "monto": "Usa el encabezado `monto`, valores numéricos mayores que cero y sin símbolos de moneda.",
                "tipo": "Usa el encabezado `tipo` y únicamente los valores `Ingreso` o `Gasto`.",
                "categoria": "Usa el encabezado `categoria` y evita celdas vacías.",
                "medio_pago": "Usa el encabezado `medio_pago` y evita celdas vacías.",
                "recurrente": "Usa el encabezado `recurrente` con `Sí/No`, `true/false` o `1/0`.",
                "descripcion": "Usa el encabezado `descripcion` y evita celdas vacías.",
            }
            detail = tips.get(
                column,
                "Comprueba que el encabezado exista exactamente y que sus valores tengan el formato esperado.",
            )
            return cls._solved(
                f"No se pudo procesar la columna **{column}**.\n\n{detail}\n\n"
                "Guarda el archivo como CSV UTF-8 e intenta importarlo nuevamente.",
                "support_csv_known_column",
            )

        if cls._contains_any(current, ("monto debe ser mayor que cero", "monto mayor que cero")):
            return cls._solved(
                "Ese error aparece cuando una fila contiene un monto igual o menor que cero. "
                "Usa valores positivos y distingue los egresos con `Gasto` en la columna `tipo`. "
                "Después, guarda el archivo como CSV UTF-8 e intenta importarlo nuevamente.",
                "support_csv_amount_positive",
            )

        if cls._contains_any(current, ("archivo vacio", "csv vacio", "sin filas")):
            return cls._solved(
                "El archivo debe contener al menos una fila de movimientos debajo del encabezado. "
                "Agrega los movimientos, guarda el archivo como CSV UTF-8 e intenta importarlo nuevamente.",
                "support_csv_empty",
            )

        if cls._contains_any(current, ("5 mb", "demasiado grande", "archivo grande", "supera el limite")):
            return cls._solved(
                "El archivo debe pesar como máximo **5 MB**. Reduce su tamaño o divídelo en varios archivos CSV.",
                "support_csv_too_large",
            )

        if cls._contains_any(current, ("utf 8", "utf-8", "codificacion", "encoding")):
            return cls._solved(
                "Vuelve a guardar el archivo con codificación **CSV UTF-8** e intenta importarlo nuevamente.",
                "support_csv_encoding",
            )

        if cls._contains_any(current, ("delimitador", "separador", "punto y coma")):
            return cls._solved(
                "El archivo puede tener un separador incompatible. Expórtalo nuevamente como CSV estándar "
                "y comprueba que todas las filas tengan la misma cantidad de columnas.",
                "support_csv_delimiter",
            )

        return None

    @staticmethod
    def _csv_requirements_text() -> str:
        return (
            "- El archivo debe ser un `.csv` real y pesar como máximo **5 MB**.\n"
            "- Debe contener estas columnas obligatorias: "
            "`fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`.\n"
            "- `fecha`: una fecha válida; se recomienda `AAAA-MM-DD`.\n"
            "- `monto`: numérico y mayor que cero; los gastos no llevan signo negativo.\n"
            "- `tipo`: `Ingreso` o `Gasto`.\n"
            "- `descripcion`, `categoria` y `medio_pago`: no pueden estar vacíos.\n"
            "- `recurrente`: `Sí/No`, `true/false` o `1/0`.\n"
            "- Debe incluir al menos una fila de movimientos debajo del encabezado."
        )

    @classmethod
    def _asked_csv_requirements(cls, previous: str) -> bool:
        return cls._contains_any(
            previous,
            (
                "cumple todos estos requisitos",
                "cumple todos los requisitos",
                "archivo cumple todos",
            ),
        ) and cls._contains_any(
            previous,
            ("fecha, descripcion, monto", "5 mb", "recurrente"),
        )

    @classmethod
    def _solved(cls, content: str, route: str) -> DiagnosisResult:
        return DiagnosisResult(
            content=content.rstrip() + "\n\n¿Puedo ayudarte con algo más?",
            route=route,
            solved=True,
        )

    @classmethod
    def _support_page_referral(cls, intro: str | None = None) -> DiagnosisResult:
        return DiagnosisResult(
            content=(
                ((intro.strip() + "\n\n") if intro else "No pude resolver el problema con las comprobaciones disponibles.\n\n")
                + "Este caso requiere una revisión del equipo de TwentyNineDevs.\n\n"
                + "[🛠️ Ir a la página de Soporte](/soporte)\n\n"
                + "Incluye, si es posible, una captura y el mensaje de error exacto. "
                + "No compartas contraseñas, códigos de verificación, números de tarjeta ni datos bancarios.\n\n"
                + "¿Puedo ayudarte con algo más?"
            ),
            route="support_page_referral",
            escalate=True,
        )

    @classmethod
    def _is_current_password_error(cls, text: str) -> bool:
        return cls._contains_any(
            text,
            (
                "la contrasena actual es incorrecta",
                "la contrasena actual es invalida",
                "contrasena actual incorrecta",
                "contrasena actual invalida",
                "clave actual incorrecta",
                "clave actual invalida",
                "password actual incorrecta",
                "password actual invalida",
                "current password is incorrect",
                "invalid current password",
                "wrong current password",
                "current contrasena is incorrect",
                "invalid current contrasena",
                "wrong current contrasena",
            ),
        )

    @staticmethod
    def _current_password_error_text() -> str:
        return (
            "La contraseña actual ingresada no es correcta.\n\n"
            "Verifica que estés escribiéndola exactamente como fue creada, respetando "
            "mayúsculas, minúsculas, números, símbolos y espacios.\n\n"
            "Si no recuerdas la contraseña actual, usa **¿Olvidaste tu contraseña?** "
            "en la pantalla de inicio de sesión para crear una nueva.\n\n"
            "Por seguridad, no escribas ni compartas tu contraseña en este chat."
        )

    @classmethod
    def _is_dashboard_triage_prompt(cls, previous: str) -> bool:
        return cls._contains_any(
            previous,
            (
                "para revisar el dashboard indica cual situacion",
                "aparecen movimientos compras o gastos que no reconoces",
                "el dashboard esta vacio o no muestra datos",
                "los totales o el balance no coinciden",
            ),
        )

    @classmethod
    def _infer_state(cls, previous: str) -> SupportState:
        if not previous:
            return SupportState.NONE
        if cls._contains_any(previous, (
            "ir a la pagina de soporte",
            "puedo ayudarte con algo mas",
            "caso requiere una revision",
            "caso necesita una revision",
        )):
            return SupportState.NONE
        if cls._contains_any(
            previous,
            (
                "copia y pega el mensaje exacto que aparece durante la importacion",
                "mensaje exacto que aparece durante la importacion",
                "support_csv_waiting_exact_error",
            ),
        ):
            return SupportState.CSV_WAITING_ERROR
        if cls._contains_any(previous, (
            "vamos a revisar la importacion del archivo",
            "el archivo es rechazado o aparece como invalido",
        )):
            return SupportState.CSV_TRIAGE
        # La confirmación de requisitos de CSV debe evaluarse antes que la de
        # contraseña. Ambas respuestas contienen frases genéricas como
        # "cumple todos estos requisitos", pero el contexto CSV incluye columnas,
        # formato de fecha o tamaño máximo del archivo.
        if cls._asked_csv_requirements(previous):
            return SupportState.CSV_REQUIREMENTS_CONFIRMATION
        if cls._contains_any(
            previous,
            (
                "la contrasena cumple todos estos requisitos",
                "la clave cumple todos estos requisitos",
                "para que la contrasena alcance una seguridad muy fuerte",
            ),
        ):
            return SupportState.PASSWORD_REQUIREMENTS_CONFIRMATION
        if cls._asked_password_error_message(previous):
            return SupportState.PASSWORD_WAITING_ERROR
        if "vamos a revisar que ocurre con la contrasena" in previous or (
            "la nueva contrasena es rechazada" in previous
            and "no puedo iniciar sesion" in previous
        ):
            return SupportState.PASSWORD_TRIAGE
        return SupportState.NONE

    @staticmethod
    def _asked_password_error_message(previous: str) -> bool:
        return any(
            term in previous
            for term in (
                "copia el mensaje exacto", "copiame el mensaje exacto",
                "mensaje exacto que aparece", "error exacto",
            )
        ) and any(term in previous for term in ("contrasena", "guardar", "nueva clave"))

    @staticmethod
    def _is_explicit_csv_query(text: str) -> bool:
        return "csv" in text and any(
            term in text
            for term in (
                "no puedo", "no me deja", "error", "problema", "falla",
                "rechazado", "invalido", "importar", "cargar", "subir",
                "vista previa", "columna", "archivo vacio",
            )
        )

    @staticmethod
    def _is_explicit_password_query(text: str) -> bool:
        has_topic = any(term in text for term in ("contrasena", "clave", "password", "login", "iniciar sesion"))
        has_action = any(
            term in text
            for term in (
                "no puedo", "no me deja", "error", "problema", "falla",
                "cambiar", "crear", "guardar", "rechazada", "olvide",
                "recuperar", "restablecer", "no recuerdo",
            )
        )
        return has_topic and has_action

    @staticmethod
    def _is_unrecognized_transaction_query(text: str) -> bool:
        subjects = (
            "transaccion", "transacciones", "movimiento", "movimientos",
            "gasto", "gastos", "compra", "compras", "consumo", "consumos",
            "cargo", "cargos", "ingreso", "ingresos", "datos",
        )
        ownership_problem = (
            "no hice", "nunca hice", "no reconozco", "desconozco",
            "no autorice", "no son mios", "no son mias", "no es mio",
            "no es mia", "ajeno", "ajena", "otra persona",
        )
        return any(subject in text for subject in subjects) and any(
            problem in text for problem in ownership_problem
        )

    @staticmethod
    def _is_generic_dashboard_problem(text: str) -> bool:
        has_dashboard = any(
            topic in text for topic in ("dashboard", "pantalla principal")
        )
        has_generic_problem = any(
            problem in text
            for problem in (
                "esta mal", "incorrecto", "incorrecta", "no funciona",
                "no anda", "problema", "falla", "fallo",
            )
        )
        return has_dashboard and has_generic_problem

    @staticmethod
    def _is_explicit_dashboard_query(text: str) -> bool:
        has_topic = any(term in text for term in ("dashboard", "pantalla principal", "transacciones", "movimientos", "graficos", "balance"))
        has_problem = any(term in text for term in ("no hice", "no reconozco", "no son mios", "no aparecen", "vacio", "incorrecto", "esta mal", "no coinciden"))
        return has_topic and has_problem

    @staticmethod
    def _is_dashboard_context(text: str) -> bool:
        return any(
            term in text
            for term in (
                "dashboard", "pantalla principal", "graficos", "balance",
                "datos no aparecen", "transacciones que no hice", "movimientos que no hice",
            )
        )

    @classmethod
    def _looks_like_support_answer(cls, previous: str) -> bool:
        return cls._contains_any(
            previous,
            (
                "proba", "verifica", "revisa", "actualiza", "responde",
                "importacion", "csv", "pdf", "iniciar sesion", "contrasena",
                "dashboard", "transacciones", "meta", "recomendaciones",
                "si sigue", "si continua", "soporte",
            ),
        )

    @classmethod
    def _support_category(cls, previous: str) -> str:
        if cls._contains_any(previous, ("csv", "importacion")):
            return "Importación CSV"
        if cls._contains_any(previous, ("pdf", "informe", "exportar")):
            return "Descarga o exportación"
        if cls._contains_any(previous, ("iniciar sesion", "contrasena", "correo de recuperacion")):
            return "Acceso y contraseña"
        if cls._contains_any(previous, ("meta", "metas")):
            return "Metas"
        if cls._contains_any(previous, ("dashboard", "datos", "graficos")):
            return "Dashboard y datos"
        if cls._contains_any(previous, ("transacciones", "movimientos")):
            return "Transacciones"
        return "Soporte técnico"

    @classmethod
    def _diagnose_pdf(
        cls,
        usuario_id: str,
        question: str,
        current: str,
        previous: str,
        previous_answer: str | None,
        support_email: str,
    ) -> DiagnosisResult:
        unresolved = cls._contains_any(current, cls._UNRESOLVED_TERMS)
        blank_window = cls._contains_any(
            current,
            (
                "ventana en blanco",
                "ventana blanco",
                "pagina en blanco",
                "queda en blanco",
                "sigue en blanco",
                "sin datos",
                "vacio",
            ),
        )
        nothing_opens = cls._contains_any(
            current,
            ("no se abre", "no abre", "no pasa nada", "no aparece nada", "nada"),
        ) and not blank_window

        # Estado 3: ya se indicó habilitar popups y el usuario confirma que
        # sigue fallando. No repetimos la misma solución: escalamos.
        popup_already_tried = cls._contains_any(
            previous,
            ("permiti ventanas emergentes", "habilita las ventanas emergentes"),
        )
        if popup_already_tried and (unresolved or blank_window or nothing_opens):
            return cls._escalation(
                usuario_id,
                question,
                previous_answer,
                support_email,
                category="Descarga de informe PDF",
            )

        # Estado 2: el informe estaba vacío y ya se pidió comprobar que el
        # dashboard tuviera datos. Si continúa vacío, probamos popups una sola vez.
        data_check_already_tried = cls._contains_any(
            previous,
            (
                "pantalla principal aparezcan tus ingresos y gastos",
                "pantalla principal ya muestra tus ingresos y gastos",
                "verifica que en la pantalla principal",
                "dashboard muestre ingresos y gastos",
                "dashboard muestra datos financieros",
                "verifica que el dashboard",
            ),
        )
        if data_check_already_tried and (unresolved or blank_window):
            return DiagnosisResult(
                content=(
                    "Como la pantalla principal ya muestra tus ingresos y gastos y el informe sigue abriéndose en blanco, probemos el último paso del navegador:\n\n"
                    "1. Permite ventanas emergentes para FinSightAI.\n"
                    "2. Cierra la ventana en blanco.\n"
                    "3. Vuelve a tocar `Descargar informe PDF`.\n"
                    "4. En el cuadro de impresión elige `Guardar como PDF`.\n\n"
                    "Si vuelve a abrirse en blanco o no aparece el cuadro de impresión, indica `sigue igual` y preparo el reporte para soporte."
                ),
                route="support_pdf_popup_second_step",
            )

        # Estado 1B: no se abre absolutamente nada.
        if nothing_opens:
            return DiagnosisResult(
                content=(
                    "Si no se abre ninguna ventana, probablemente el navegador esté bloqueando la ventana imprimible.\n\n"
                    "1. Permite ventanas emergentes para FinSightAI.\n"
                    "2. Vuelve a tocar `Descargar informe PDF`.\n"
                    "3. En el cuadro de impresión elige `Guardar como PDF`.\n\n"
                    "Si ya hiciste esto y sigue sin abrirse, responde `sigue igual` para preparar el reporte de soporte."
                ),
                route="support_pdf_popup_diagnosis",
            )

        # Estado 1A: se abre una ventana, pero está vacía. Debe evaluarse antes
        # que la palabra genérica "ventana" para no confundirlo con un popup bloqueado.
        if blank_window:
            return DiagnosisResult(
                content=(
                    "Si se abre una ventana en blanco, primero confirmemos que el informe tenga datos para mostrar:\n\n"
                    "1. Cierra la ventana en blanco.\n"
                    "2. Actualiza FinSightAI.\n"
                    "3. Verifica que en la pantalla principal aparezcan tus ingresos y gastos.\n"
                    "4. Vuelve a generar el PDF.\n\n"
                    "¿En la pantalla principal aparecen tus ingresos y gastos y aún así la ventana continúa en blanco?"
                ),
                route="support_pdf_empty_diagnosis",
            )

        if cls._contains_any(current, ("no aparece la opcion", "no puedo guardar", "guardar como pdf")):
            return DiagnosisResult(
                content=(
                    "Cuando se abra el informe, usa el cuadro de impresión del navegador y elige `Guardar como PDF` como destino. "
                    "Si el cuadro no aparece, presiona `Ctrl + P`.\n\n"
                    "¿Ahora aparece la opción de guardarlo?"
                ),
                route="support_pdf_save_diagnosis",
            )

        if cls._contains_any(current, ("boton no aparece", "no aparece el boton")):
            return DiagnosisResult(
                content=(
                    "La exportación está disponible desde `Dashboard`, `Análisis` y `Transacciones` mediante el botón `Exportar`. "
                    "Desde ese menú puedes elegir `Exportar PDF`. Actualiza la página y vuelve a intentarlo.\n\n"
                    "¿Después de actualizar aparece el botón `Exportar`?"
                ),
                route="support_pdf_button_diagnosis",
            )

        return DiagnosisResult(
            content=(
                "¿Qué pasa cuando seleccionas `Descargar informe PDF`?\n\n"
                "1. No se abre nada.\n"
                "2. Se abre una ventana en blanco.\n"
                "3. Se abre el informe, pero no aparece la opción de guardarlo.\n"
                "4. El botón no aparece.\n\n"
                "Responde con el número o describe lo que ves."
            ),
            route="support_pdf_triage",
        )

    @classmethod
    def _resolve_numbered_choice(cls, current: str, previous: str) -> str:
        """Convierte respuestas 1/2/3/4 en el significado de la última pregunta.

        El frontend envía solo la última respuesta del asistente como contexto.
        Esta traducción evita que una respuesta breve como ``3`` reinicie el
        diagnóstico en lugar de avanzar por la opción elegida.
        """
        choice = current.strip()
        if choice not in {"1", "2", "3", "4"}:
            return current

        if (
            "vamos a revisar la importacion del archivo" in previous
            or "que ocurre exactamente" in previous
            and "archivo es rechazado" in previous
            and "vista previa" in previous
        ):
            return {
                "1": "el archivo es rechazado o aparece como invalido",
                "2": "aparece un error durante el proceso",
                "3": "la carga termina pero no aparecen movimientos",
                "4": "la vista previa queda en cero",
            }[choice]

        if "en que parte falla la importacion" in previous or (
            "archivo es rechazado" in previous and "vista previa queda en cero" in previous
        ):
            return {
                "1": "el archivo es rechazado o figura como invalido",
                "2": "la carga termina pero no aparecen movimientos",
                "3": "aparece un error durante el proceso",
                "4": "la vista previa queda en cero",
            }[choice]

        if "vamos a revisar que ocurre con la contrasena" in previous or (
            "la nueva contrasena es rechazada" in previous and "no puedo iniciar sesion" in previous
        ):
            return {
                "1": "la nueva contrasena es rechazada",
                "2": "no aparece la opcion para cambiarla",
                "3": "aparece un mensaje de error al guardar",
                "4": "no puedo iniciar sesion",
            }[choice]

        if "que pasa cuando tocas descargar informe pdf" in previous or (
            "no se abre nada" in previous and "el boton no aparece" in previous
        ):
            return {
                "1": "no se abre nada",
                "2": "se abre una ventana en blanco",
                "3": "se abre el informe pero no aparece la opcion de guardarlo",
                "4": "el boton no aparece",
            }[choice]

        return current

    @classmethod
    def _escalation(
        cls,
        usuario_id: str,
        question: str,
        previous_answer: str | None,
        support_email: str,
        category: str,
        intro: str | None = None,
    ) -> DiagnosisResult:
        return cls._support_page_referral(
            intro=(
                intro
                or "Hice las comprobaciones disponibles, pero el problema necesita una revisión técnica del equipo."
            )
        )

    @classmethod
    def _should_escalate(cls, current: str, previous: str) -> bool:
        return bool(previous) and cls._contains_any(current, cls._UNRESOLVED_TERMS)

    @staticmethod
    def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
        return any(term in text for term in terms)

    @staticmethod
    def _is_csv_context(text: str) -> bool:
        return any(term in text for term in ("csv", "archivo", "importar", "cargar movimientos", "vista previa"))

    @staticmethod
    def _is_pdf_context(text: str) -> bool:
        return "pdf" in text or "descargar informe" in text

    @staticmethod
    def _is_password_context(text: str) -> bool:
        return any(term in text for term in ("contrasena", "password", "clave", "login", "iniciar sesion"))
