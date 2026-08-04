from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class DiagnosisResult:
    content: str
    route: str
    solved: bool = False
    escalate: bool = False


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
        "aun no puedo",
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
        current = cls._resolve_numbered_choice(current, previous)
        combined = f"{previous} {current}".strip()

        # Respuestas breves afirmativas/negativas deben continuar la última
        # pregunta del diagnóstico, no volver al asesor financiero.
        yes = current in {"si", "sí", "sip", "correcto", "claro"}
        no = current in {"no", "nop", "todavia no", "aun no"}

        # Confirmación del checklist CSV. Si el archivo cumple todo y el
        # error persiste, derivamos a la página de Soporte sin abrir el mail.
        if cls._asked_csv_requirements(previous):
            if yes:
                return cls._support_page_referral(
                    intro=(
                        "Perfecto. Si el archivo cumple todos los requisitos y aun así no puede importarse, "
                        "el problema necesita una revisión técnica del equipo."
                    ),
                )
            if no:
                return DiagnosisResult(
                    content=(
                        "Antes de volver a importar el archivo, corregí los requisitos que no se cumplen:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\nCuando esté corregido, guardalo como CSV y volvé a intentar la importación."
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
                    "Respondeme con el número o describime qué estabas intentando hacer."
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
                        "Antes de derivarlo, comprobá que el archivo tenga filas debajo del encabezado, "
                        "que los montos sean mayores que cero y que el tipo sea `Ingreso` o `Gasto`. "
                        "Si el archivo ya cumple con eso, el equipo de soporte tendrá que revisarlo."
                    ),
                )
            if yes:
                return DiagnosisResult(
                    content=(
                        "Perfecto, entonces los movimientos sí fueron procesados. "
                        "Actualizá la página y volvé a la pantalla principal, donde aparecen tus ingresos y gastos.\n\n"
                        "¿Ahora aparecen los movimientos? Respondeme `sí` o `no`."
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
                    "1. Convertí todos los montos a valores positivos.\n"
                    "2. Para los egresos, mantené `Gasto` en la columna `tipo`.\n"
                    "3. Guardá el archivo como CSV UTF-8 y volvé a importarlo.\n\n"
                    "Los gastos no llevan signo negativo: FinSightAI usa la columna `tipo` para distinguirlos."
                ),
                route="support_known_error",
                solved=True,
            )

        if "vista previa" in current and ("cero" in current or "0" in current):
            return DiagnosisResult(
                content=(
                    "Entiendo. Primero confirmemos una cosa: ¿el mensaje final de la importación indica una cantidad de movimientos mayor que cero?\n\n"
                    "Respondeme `sí` o `no`. Con eso seguimos al próximo paso."
                ),
                route="support_csv_preview_diagnosis",
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
                        + "\n\n¿El archivo cumple **todos** estos requisitos? Respondeme `sí` o `no`."
                    ),
                    route="support_csv_requirements_confirmation",
                )

            if cls._contains_any(current, ("error durante el proceso", "aparece un error", "error al procesar")):
                return DiagnosisResult(
                    content=(
                        "Entiendo: aparece un error durante la importación. Para identificar la causa necesito el mensaje exacto.\n\n"
                        "Copiá y pegá el texto completo del error que muestra FinSightAI. Si menciona una fila o una columna, incluí esa parte también.\n\n"
                        "Por tu seguridad, no compartas tu contraseña, códigos de verificación, números de tarjeta ni datos bancarios."
                    ),
                    route="support_csv_process_error_diagnosis",
                )

            if cls._contains_any(current, ("invalido", "rechazado", "columnas", "formato")):
                return DiagnosisResult(
                    content=(
                        "Revisemos el archivo. Para que FinSightAI pueda importarlo debe cumplir estos requisitos:\n\n"
                        + cls._csv_requirements_text()
                        + "\n\n¿El archivo cumple **todos** estos requisitos? Respondeme `sí` o `no`."
                    ),
                    route="support_csv_requirements_confirmation",
                )

            if cls._contains_any(current, ("termina", "correctamente", "no aparece", "no guarda", "pantalla principal", "dashboard", "cero")):
                return DiagnosisResult(
                    content=(
                        "Entiendo: la carga termina, pero después no ves los movimientos. Probemos esto:\n\n"
                        "1. Confirmá que el resultado muestre más de 0 movimientos.\n"
                        "2. Actualizá la página y volvé a la pantalla principal, donde aparecen tus ingresos y gastos.\n"
                        "3. Verificá que estés usando la misma cuenta con la que importaste.\n\n"
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
                        "Abrí el CSV y verificá que tenga al menos una fila de movimientos debajo del encabezado. "
                        "También confirmá que no sea un archivo de Excel renombrado: debe guardarse realmente como CSV UTF-8.\n\n"
                        "¿El archivo tiene filas visibles cuando lo abrís con un editor de texto o una planilla?"
                    ),
                    route="support_csv_empty_diagnosis",
                )

            return DiagnosisResult(
                content=(
                    "Vamos a ubicar en qué parte falla la importación. ¿Qué ocurre exactamente?\n\n"
                    "1. El archivo es rechazado o figura como inválido.\n"
                    "2. La carga termina, pero no aparecen movimientos.\n"
                    "3. Aparece un error durante el proceso.\n"
                    "4. La vista previa queda en cero.\n\n"
                    "Respondeme con el número o copiá el mensaje de error exacto."
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

        # Contraseña y acceso. Primero se evalúa el problema actual para no
        # repetir la explicación de cambio de contraseña cuando el usuario ya
        # aclaró que no puede iniciar sesión.
        if cls._is_password_context(combined):
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
                        "Si el correo de recuperación no llega, revisá **Spam** o **Correo no deseado**, confirmá que escribiste el mismo correo con el que te registraste y solicitá el enlace una sola vez más.\n\n"
                        "Si el mensaje sigue sin llegar o el enlace aparece vencido, decime `sigue igual` y preparo el contacto con soporte."
                    ),
                    route="support_password_recovery_diagnosis",
                )

            if login_problem:
                return DiagnosisResult(
                    content=(
                        "Si no podés iniciar sesión, probá esto:\n\n"
                        "1. Verificá que el correo esté escrito correctamente.\n"
                        "2. Si no recordás la contraseña, usá **¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión.\n"
                        "3. Revisá Spam si no recibís el correo de recuperación.\n"
                        "4. Volvé a intentar con la nueva contraseña después de completar el restablecimiento.\n\n"
                        "Si ya hiciste estos pasos y todavía no podés entrar, respondeme `sigue igual` y te derivo al soporte por correo."
                    ),
                    route="support_login_diagnosis",
                )

            return DiagnosisResult(
                content=(
                    "Si recordás tu contraseña actual, entrá en **Mi cuenta** desde el menú lateral y, en la sección **Seguridad**, tocá **Cambiar contraseña**. "
                    "Si no la recordás o no podés iniciar sesión, usá **¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión. "
                    "La nueva clave debe tener al menos 8 caracteres.\n\n"
                    "¿El problema es que no aparece la opción, que la nueva contraseña es rechazada o que no podés iniciar sesión?"
                ),
                route="support_password_diagnosis",
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
    def _support_page_referral(cls, intro: str | None = None) -> DiagnosisResult:
        return DiagnosisResult(
            content=(
                ((intro.strip() + "\n\n") if intro else "No pude resolver el problema con las comprobaciones disponibles.\n\n")
                + "Abrí la sección **Soporte** desde el menú lateral y usá el botón **Contactar por correo** para que el equipo de TwentyNineDevs revise tu caso.\n\n"
                + "[🛠️ Ir a la página de Soporte](/soporte)\n\n"
                + "Incluí, si podés, una captura y el mensaje de error exacto. "
                + "No compartas contraseñas, códigos de verificación, números de tarjeta ni datos bancarios."
            ),
            route="support_page_referral",
            escalate=True,
        )

    @classmethod
    def _looks_like_support_answer(cls, previous: str) -> bool:
        return cls._contains_any(
            previous,
            (
                "proba", "verifica", "revisa", "actualiza", "respondeme",
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
                    "1. Permití ventanas emergentes para FinSightAI.\n"
                    "2. Cerrá la ventana en blanco.\n"
                    "3. Volvé a tocar `Descargar informe PDF`.\n"
                    "4. En el cuadro de impresión elegí `Guardar como PDF`.\n\n"
                    "Si vuelve a abrirse en blanco o no aparece el cuadro de impresión, decime `sigue igual` y preparo el reporte para soporte."
                ),
                route="support_pdf_popup_second_step",
            )

        # Estado 1B: no se abre absolutamente nada.
        if nothing_opens:
            return DiagnosisResult(
                content=(
                    "Si no se abre ninguna ventana, probablemente el navegador esté bloqueando la ventana imprimible.\n\n"
                    "1. Permití ventanas emergentes para FinSightAI.\n"
                    "2. Volvé a tocar `Descargar informe PDF`.\n"
                    "3. En el cuadro de impresión elegí `Guardar como PDF`.\n\n"
                    "Si ya hiciste esto y sigue sin abrirse, respondeme `sigue igual` para preparar el reporte de soporte."
                ),
                route="support_pdf_popup_diagnosis",
            )

        # Estado 1A: se abre una ventana, pero está vacía. Debe evaluarse antes
        # que la palabra genérica "ventana" para no confundirlo con un popup bloqueado.
        if blank_window:
            return DiagnosisResult(
                content=(
                    "Si se abre una ventana en blanco, primero confirmemos que el informe tenga datos para mostrar:\n\n"
                    "1. Cerrá la ventana en blanco.\n"
                    "2. Actualizá FinSightAI.\n"
                    "3. Verificá que en la pantalla principal aparezcan tus ingresos y gastos.\n"
                    "4. Volvé a generar el PDF.\n\n"
                    "¿En la pantalla principal aparecen tus ingresos y gastos y aun así la ventana continúa en blanco?"
                ),
                route="support_pdf_empty_diagnosis",
            )

        if cls._contains_any(current, ("no aparece la opcion", "no puedo guardar", "guardar como pdf")):
            return DiagnosisResult(
                content=(
                    "Cuando se abra el informe, usá el cuadro de impresión del navegador y elegí `Guardar como PDF` como destino. "
                    "Si el cuadro no aparece, presioná `Ctrl + P`.\n\n"
                    "¿Ahora aparece la opción de guardarlo?"
                ),
                route="support_pdf_save_diagnosis",
            )

        if cls._contains_any(current, ("boton no aparece", "no aparece el boton")):
            return DiagnosisResult(
                content=(
                    "La exportación está disponible desde `Dashboard`, `Análisis` y `Transacciones` mediante el botón `Exportar`. "
                    "Desde ese menú podés elegir `Exportar PDF`. Actualizá la página y volvé a intentarlo.\n\n"
                    "¿Después de actualizar aparece el botón `Exportar`?"
                ),
                route="support_pdf_button_diagnosis",
            )

        return DiagnosisResult(
            content=(
                "¿Qué pasa cuando tocás `Descargar informe PDF`?\n\n"
                "1. No se abre nada.\n"
                "2. Se abre una ventana en blanco.\n"
                "3. Se abre el informe, pero no aparece la opción de guardarlo.\n"
                "4. El botón no aparece.\n\n"
                "Respondeme con el número o describime lo que ves."
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

        if "en que parte falla la importacion" in previous or (
            "archivo es rechazado" in previous and "vista previa queda en cero" in previous
        ):
            return {
                "1": "el archivo es rechazado o figura como invalido",
                "2": "la carga termina pero no aparecen movimientos",
                "3": "aparece un error durante el proceso",
                "4": "la vista previa queda en cero",
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
        subject = f"Soporte FinSightAI - {category} - {usuario_id}"
        body = (
            f"Usuario: {usuario_id}\n"
            f"Categoría: {category}\n\n"
            f"Problema actual:\n{question.strip()}\n\n"
            f"Última orientación del asistente:\n{(previous_answer or 'Sin respuesta previa').strip()}\n\n"
            "Agregá, si podés, el mensaje de error exacto y una captura sin datos sensibles."
        )
        mailto = f"mailto:{support_email}?subject={quote(subject)}&body={quote(body)}"
        return DiagnosisResult(
            content=(
                ((intro.strip() + "\n\n") if intro else "Hice todo lo que estaba a mi alcance con la información disponible y no encontré una solución segura.\n\n")
                + "Puedo dejarte preparado un reporte para el equipo de TwentyNineDevs, así no tenés que explicar todo desde cero.\n\n"
                f"[📧 Contactar soporte]({mailto})\n\n"
                "Por tu seguridad, no compartas tu contraseña, códigos de verificación, números de tarjeta ni datos bancarios."
            ),
            route="support_guided_escalation",
            escalate=True,
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
