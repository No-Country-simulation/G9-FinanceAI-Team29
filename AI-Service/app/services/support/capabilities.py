from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.services.support.normalizer import SupportQueryNormalizer


class CapabilityStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    COMING_SOON = "coming_soon"


@dataclass(frozen=True)
class CapabilityResult:
    key: str
    status: CapabilityStatus
    content: str
    route: str


class CapabilityChecker:
    """Valida capacidades de FinSightAI antes de iniciar un diagnóstico.

    Esta capa evita que el soporte intente solucionar funciones que la
    aplicación no ofrece. Las reglas son determinísticas y fáciles de cambiar
    cuando una funcionalidad se habilite en el futuro.
    """

    _UPLOAD_TERMS = (
        "subir",
        "cargar",
        "importar",
        "adjuntar",
        "agregar",
        "mandar",
    )

    _DOWNLOAD_TERMS = (
        "descargar",
        "generar",
        "guardar",
        "imprimir",
        "exportar",
    )

    _BANK_TERMS = (
        "conectar banco",
        "vincular banco",
        "sincronizar banco",
        "conecto mi banco",
        "conectar mi banco",
        "vinculo mi banco",
        "cuenta bancaria",
        "open banking",
        "billetera virtual",
        "conectar billetera",
        "sincronizar movimientos",
    )

    _MOBILE_TERMS = (
        "app android",
        "aplicacion android",
        "app para android",
        "aplicacion para android",
        "hay app para android",
        "app iphone",
        "app ios",
        "aplicacion ios",
        "app para iphone",
        "aplicacion movil",
        "app movil",
        "play store",
        "app store",
    )

    _TWO_FACTOR_TERMS = (
        "2fa",
        "autenticacion en dos pasos",
        "autenticacion de dos pasos",
        "doble factor",
        "segundo factor",
        "verificacion en dos pasos",
        "verificacion de dos pasos",
        "codigo de autenticacion",
        "google authenticator",
        "authenticator",
    )

    _PIN_TERMS = (
        "cambiar mi pin",
        "cambiar el pin",
        "cambiar pin",
        "crear pin",
        "configurar pin",
        "activar pin",
        "pin de seguridad",
        "codigo pin",
        "mi pin",
    )

    _ACTIVE_SESSIONS_TERMS = (
        "ver mis sesiones",
        "sesiones activas",
        "dispositivos conectados",
        "dispositivos con sesion",
        "donde inicie sesion",
        "donde tengo la sesion abierta",
        "ver dispositivos",
        "historial de sesiones",
    )

    @classmethod
    def check(cls, question: str) -> CapabilityResult | None:
        normalized = SupportQueryNormalizer.normalize(question)
        if not normalized:
            return None

        # Seguridad no disponible en la versión actual.
        if cls._contains_any(normalized, cls._TWO_FACTOR_TERMS):
            return CapabilityResult(
                key="AUTENTICACION_DOS_PASOS",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_two_factor_unavailable",
                content=(
                    "Actualmente FinSightAI no ofrece autenticación en dos pasos "
                    "(2FA). La cuenta se protege mediante correo electrónico y "
                    "contraseña. Si esta función se incorpora en una versión futura, "
                    "estará disponible desde la sección **Seguridad** de **Mi cuenta**."
                ),
            )

        if cls._contains_any(normalized, cls._PIN_TERMS):
            return CapabilityResult(
                key="PIN_SEGURIDAD",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_pin_unavailable",
                content=(
                    "Actualmente FinSightAI no utiliza un PIN de seguridad. "
                    "El acceso se realiza con correo electrónico y contraseña."
                ),
            )

        if cls._contains_any(normalized, cls._ACTIVE_SESSIONS_TERMS):
            return CapabilityResult(
                key="LISTADO_SESIONES_ACTIVAS",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_active_sessions_unavailable",
                content=(
                    "Actualmente FinSightAI no muestra una lista de sesiones activas "
                    "o dispositivos conectados. Desde **Mi cuenta**, en **Zona de "
                    "peligro**, podés usar **Cerrar sesiones** para cerrar la sesión "
                    "actual y las abiertas en otros dispositivos."
                ),
            )

        # Importar/subir PDF no existe. Descargar/generar PDF sí existe y debe
        # continuar al diagnóstico normal si presenta un problema.
        if "pdf" in normalized and cls._contains_any(
            normalized,
            cls._UPLOAD_TERMS,
        ):
            if not cls._contains_any(normalized, cls._DOWNLOAD_TERMS):
                return CapabilityResult(
                    key="IMPORTAR_PDF",
                    status=CapabilityStatus.UNAVAILABLE,
                    route="capability_import_pdf_unavailable",
                    content=(
                        "Actualmente FinSightAI no permite subir ni importar "
                        "archivos PDF.\n\n"
                        "Por ahora, la carga de movimientos se realiza únicamente "
                        "mediante archivos CSV compatibles. El PDF sí está disponible "
                        "como formato de descarga para los informes generados por la "
                        "aplicación.\n\n"
                        "Para cargar movimientos de un resumen en PDF, primero "
                        "necesitás pasarlos a un CSV con estas columnas:\n\n"
                        "`fecha, descripcion, monto, tipo, categoria, medio_pago, "
                        "recurrente`"
                    ),
                )

        # Excel tampoco se importa directamente: debe guardarse como CSV.
        if cls._contains_any(
            normalized,
            ("excel", "xlsx", "xls"),
        ) and cls._contains_any(normalized, cls._UPLOAD_TERMS):
            return CapabilityResult(
                key="IMPORTAR_EXCEL",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_import_excel_unavailable",
                content=(
                    "Actualmente FinSightAI no importa archivos Excel (`.xls` o "
                    "`.xlsx`) directamente.\n\n"
                    "Abrí la planilla y elegí `Guardar como` o `Descargar` en "
                    "formato CSV UTF-8. Después podés cargar ese CSV desde la "
                    "sección de importación."
                ),
            )

        if cls._contains_any(normalized, cls._BANK_TERMS):
            return CapabilityResult(
                key="SINCRONIZACION_BANCARIA",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_bank_sync_unavailable",
                content=(
                    "FinSightAI todavía no permite conectar o sincronizar una "
                    "cuenta bancaria o billetera virtual.\n\n"
                    "Por el momento, los movimientos se cargan mediante un archivo "
                    "CSV compatible."
                ),
            )

        if cls._contains_any(normalized, cls._MOBILE_TERMS):
            return CapabilityResult(
                key="APP_MOVIL",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_mobile_app_unavailable",
                content=(
                    "Actualmente FinSightAI está disponible como aplicación web y "
                    "no cuenta con una app nativa para Android o iOS.\n\n"
                    "Podés usarla desde el navegador del teléfono, aunque algunas "
                    "funciones pueden verse mejor en una computadora."
                ),
            )

        return None

    @staticmethod
    def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
        return any(term in text for term in terms)