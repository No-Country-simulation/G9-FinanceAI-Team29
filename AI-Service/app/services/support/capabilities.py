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
        "subir", "cargar", "importar", "adjuntar", "agregar", "mandar",
    )
    _DOWNLOAD_TERMS = (
        "descargar", "generar", "guardar", "imprimir", "exportar",
    )
    _BANK_TERMS = (
        "conectar banco", "vincular banco", "sincronizar banco",
        "conecto mi banco", "conectar mi banco", "vinculo mi banco",
        "cuenta bancaria", "open banking", "billetera virtual",
        "conectar billetera", "sincronizar movimientos",
    )
    _MOBILE_TERMS = (
        "app android", "aplicacion android", "app iphone", "app ios",
        "aplicacion movil", "app movil", "play store", "app store",
    )

    @classmethod
    def check(cls, question: str) -> CapabilityResult | None:
        normalized = SupportQueryNormalizer.normalize(question)
        if not normalized:
            return None

        # Importar/subir PDF no existe. Descargar/generar PDF sí existe y debe
        # continuar al diagnóstico normal si presenta un problema.
        if "pdf" in normalized and cls._contains_any(normalized, cls._UPLOAD_TERMS):
            if not cls._contains_any(normalized, cls._DOWNLOAD_TERMS):
                return CapabilityResult(
                    key="IMPORTAR_PDF",
                    status=CapabilityStatus.UNAVAILABLE,
                    route="capability_import_pdf_unavailable",
                    content=(
                        "Actualmente FinSightAI no permite subir ni importar archivos PDF.\n\n"
                        "Por ahora, la carga de movimientos se realiza únicamente mediante archivos CSV compatibles. "
                        "El PDF sí está disponible como formato de descarga para los informes generados por la aplicación.\n\n"
                        "Para cargar movimientos de un resumen en PDF, primero necesitás pasarlos a un CSV con estas columnas:\n\n"
                        "`fecha, descripcion, monto, tipo, categoria, medio_pago, recurrente`"
                    ),
                )

        # Excel tampoco se importa directamente: el usuario debe guardarlo como CSV.
        if cls._contains_any(normalized, ("excel", "xlsx", "xls")) and cls._contains_any(
            normalized, cls._UPLOAD_TERMS
        ):
            return CapabilityResult(
                key="IMPORTAR_EXCEL",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_import_excel_unavailable",
                content=(
                    "Actualmente FinSightAI no importa archivos Excel (`.xls` o `.xlsx`) directamente.\n\n"
                    "Abrí la planilla y elegí `Guardar como` o `Descargar` en formato CSV UTF-8. "
                    "Después podés cargar ese CSV desde la sección de importación."
                ),
            )

        if cls._contains_any(normalized, cls._BANK_TERMS):
            return CapabilityResult(
                key="SINCRONIZACION_BANCARIA",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_bank_sync_unavailable",
                content=(
                    "FinSightAI todavía no permite conectar o sincronizar una cuenta bancaria o billetera virtual.\n\n"
                    "Por el momento, los movimientos se cargan mediante un archivo CSV compatible."
                ),
            )

        if cls._contains_any(normalized, cls._MOBILE_TERMS):
            return CapabilityResult(
                key="APP_MOVIL",
                status=CapabilityStatus.UNAVAILABLE,
                route="capability_mobile_app_unavailable",
                content=(
                    "Actualmente FinSightAI está disponible como aplicación web y no cuenta con una app nativa para Android o iOS.\n\n"
                    "Podés usarla desde el navegador del teléfono, aunque algunas funciones pueden verse mejor en una computadora."
                ),
            )

        return None

    @staticmethod
    def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
        return any(term in text for term in terms)
