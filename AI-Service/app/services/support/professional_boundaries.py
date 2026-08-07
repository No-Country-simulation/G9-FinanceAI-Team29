from __future__ import annotations

from dataclasses import dataclass

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class ProfessionalBoundaryResult:
    content: str
    route: str
    topic: str


@dataclass(frozen=True)
class ProfessionalBoundaryRule:
    topic: str
    terms: tuple[str, ...]
    content: str


class ProfessionalBoundariesResponder:
    """Define los límites profesionales de Finsi.

    Evita que el asistente se presente como contador, asesor financiero,
    médico o abogado, y que recomiende inversiones o créditos específicos.
    Las consultas financieras informativas normales continúan por el flujo
    habitual de FinSightAI.
    """

    _RULES: tuple[ProfessionalBoundaryRule, ...] = (
        ProfessionalBoundaryRule(
            topic="accountant_or_financial_advisor",
            terms=(
                "si fueras mi contador",
                "si fueras un contador",
                "si fueras contador",
                "sos contador",
                "eres contador",
                "sos un contador",
                "eres un contador",
                "si fueras mi asesor financiero",
                "si fueras un asesor financiero",
                "sos asesor financiero",
                "eres asesor financiero",
                "reemplazas a un contador",
                "reemplazas a un asesor financiero",
                "podes ser mi contador",
                "puedes ser mi contador",
                "podes ser mi asesor financiero",
                "puedes ser mi asesor financiero",
            ),
            content=(
                "No puedo reemplazar el asesoramiento de un contador o de un "
                "asesor financiero profesional. Si necesitás recomendaciones "
                "sobre impuestos, inversiones, planificación patrimonial o "
                "decisiones económicas importantes, lo adecuado es consultar "
                "con un profesional matriculado.\n\n"
                "Puedo ayudarte a interpretar la información registrada en "
                "FinSightAI, analizar ingresos, gastos, capacidad de ahorro y "
                "nivel de endeudamiento, y explicarte los indicadores y "
                "recomendaciones de la aplicación para que llegues mejor "
                "preparado a esa consulta."
            ),
        ),
        ProfessionalBoundaryRule(
            topic="investment_advice",
            terms=(
                "que acciones compro",
                "que accion compro",
                "en que acciones invierto",
                "en que accion invierto",
                "compro bitcoin",
                "deberia comprar bitcoin",
                "me conviene comprar bitcoin",
                "en que criptomoneda invierto",
                "que criptomoneda compro",
                "donde invierto mis ahorros",
                "decime en que invertir",
                "dime en que invertir",
                "recomendame una inversion",
                "recomiendame una inversion",
            ),
            content=(
                "No puedo recomendar una inversión, acción o criptomoneda "
                "específica ni reemplazar a un asesor financiero profesional. "
                "Toda inversión implica riesgos y debe evaluarse según tus "
                "objetivos, plazo y tolerancia al riesgo.\n\n"
                "FinSightAI sí puede ayudarte a revisar tus ingresos, gastos, "
                "ahorro y endeudamiento para comprender mejor tu situación "
                "antes de consultar con un profesional."
            ),
        ),
        ProfessionalBoundaryRule(
            topic="credit_decision",
            terms=(
                "me conviene pedir un credito",
                "me conviene sacar un credito",
                "me conviene pedir un prestamo",
                "me conviene sacar un prestamo",
                "deberia pedir un credito",
                "deberia sacar un credito",
                "deberia pedir un prestamo",
                "deberia sacar un prestamo",
                "saco un prestamo",
                "pido un prestamo",
            ),
            content=(
                "No puedo decidir por vos si debés tomar un préstamo o crédito. "
                "Es una decisión que puede generar un compromiso económico "
                "importante y conviene evaluarla con un contador o asesor "
                "financiero profesional.\n\n"
                "Puedo ayudarte a revisar tu nivel de endeudamiento, tus gastos "
                "mensuales y tu capacidad de ahorro dentro de FinSightAI."
            ),
        ),
        ProfessionalBoundaryRule(
            topic="legal_advice",
            terms=(
                "si fueras mi abogado",
                "si fueras un abogado",
                "sos abogado",
                "eres abogado",
                "necesito asesoramiento legal",
                "dame asesoramiento legal",
                "que hago legalmente",
                "que deberia hacer legalmente",
            ),
            content=(
                "No puedo brindar asesoramiento legal ni reemplazar a un "
                "abogado. Si la situación tiene consecuencias legales, lo "
                "adecuado es consultar con un profesional habilitado.\n\n"
                "Puedo ayudarte únicamente con el funcionamiento y la "
                "información financiera disponible en FinSightAI."
            ),
        ),
        ProfessionalBoundaryRule(
            topic="medical_advice",
            terms=(
                "si fueras mi medico",
                "si fueras un medico",
                "sos medico",
                "eres medico",
                "que medicamento tomo",
                "que remedio tomo",
                "que diagnostico tengo",
                "diagnostica mis sintomas",
                "dame un diagnostico medico",
            ),
            content=(
                "No puedo brindar diagnósticos médicos, indicar medicamentos "
                "ni reemplazar a un profesional de la salud. Para una decisión "
                "médica, consultá con un médico o servicio de salud.\n\n"
                "Puedo ayudarte con las funciones y los datos financieros de "
                "FinSightAI."
            ),
        ),
    )

    @classmethod
    def answer(cls, question: str) -> ProfessionalBoundaryResult | None:
        normalized = SupportQueryNormalizer.normalize(question)
        if not normalized:
            return None

        for rule in cls._RULES:
            if cls._contains_any(normalized, rule.terms):
                return ProfessionalBoundaryResult(
                    content=rule.content,
                    route=f"professional_boundary_{rule.topic}",
                    topic=rule.topic,
                )

        return None

    @staticmethod
    def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
        return any(term in text for term in terms)
