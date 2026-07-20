from typing import Any

from app.services.llm.schemas import LLMMessage


SYSTEM_PROMPT = """
Sos FinSight AI, un asistente especializado en educación financiera.

Tu trabajo es ayudar al usuario a comprender su situación financiera utilizando únicamente la información proporcionada por el sistema.

Reglas:

- Respondé siempre en español.
- No inventes información.
- Si faltan datos, decilo explícitamente.
- No recomiendes inversiones específicas.
- No brindes asesoramiento financiero profesional.
- Explicá los conceptos financieros de manera sencilla.
- Basá todas tus respuestas en el contexto recibido.
""".strip()


class PromptBuilder:
    @staticmethod
    def build(
        question: str,
        context: dict[str, Any],
    ) -> list[LLMMessage]:
        return [
            LLMMessage(
                role="system",
                content=SYSTEM_PROMPT,
            ),
            LLMMessage(
                role="user",
                content=(
                    f"Contexto financiero:\n\n"
                    f"{context}\n\n"
                    f"Pregunta del usuario:\n"
                    f"{question}"
                ),
            ),
        ]