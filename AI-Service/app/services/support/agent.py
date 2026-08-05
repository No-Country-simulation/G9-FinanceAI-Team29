from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.services.llm.schemas import LLMResponse
from app.services.llm.service import LLMService
from app.services.support.knowledge_base import KnowledgeChunk, SupportKnowledgeBase
from app.services.support.capabilities import CapabilityChecker
from app.services.support.diagnosis import GuidedSupportDiagnosis
from app.services.support.prompt import build_support_messages
from app.services.support.product_knowledge import ProductKnowledgeResponder


class SupportAgent:
    def __init__(self, llm: LLMService | None = None, docs_dir: Path | None = None) -> None:
        self.llm = llm or LLMService()
        self.knowledge = SupportKnowledgeBase(docs_dir or settings.support_knowledge_dir)

    async def answer(
        self,
        usuario_id: str,
        question: str,
        provider: str | None = None,
        previous_answer: str | None = None,
    ) -> LLMResponse:
        capability = CapabilityChecker.check(question)
        if capability is not None:
            return LLMResponse(
                content=capability.content,
                provider="internal",
                model="support-capability-checker",
                metadata={
                    "intent": "technical_support",
                    "route": capability.route,
                    "capability": capability.key,
                    "capability_status": capability.status.value,
                    "support_email": settings.support_email,
                },
            )

        diagnosis = GuidedSupportDiagnosis.diagnose(
            usuario_id=usuario_id,
            question=question,
            previous_answer=previous_answer,
            support_email=settings.support_email,
        )
        if diagnosis is not None:
            return LLMResponse(
                content=diagnosis.content,
                provider="internal",
                model="support-guided-diagnosis",
                metadata={
                    "intent": "technical_support",
                    "route": diagnosis.route,
                    "solved": diagnosis.solved,
                    "escalate": diagnosis.escalate,
                    "support_email": settings.support_email,
                },
            )

        product = ProductKnowledgeResponder.answer(question)
        if product is not None:
            return LLMResponse(
                content=product.content,
                provider="internal",
                model="support-product-knowledge",
                metadata={
                    "intent": "technical_support",
                    "route": product.route,
                    "topic": product.topic,
                    "support_email": settings.support_email,
                },
            )

        chunks = self.knowledge.search(question)
        if not chunks:
            return self._fallback_response(usuario_id, question)

        try:
            response = await self.llm.generate(
                messages=build_support_messages(question, chunks, settings.support_email),
                provider=provider,
            )
            response.metadata.update({
                "intent": "technical_support",
                "route": "support_rag",
                "knowledge_sources": sorted({chunk.source for chunk in chunks}),
                "support_email": settings.support_email,
            })
            return response
        except Exception:
            return self._extractive_response(usuario_id, question, chunks)

    def _extractive_response(
        self,
        usuario_id: str,
        question: str,
        chunks: list[KnowledgeChunk],
    ) -> LLMResponse:
        best = chunks[0]
        content = f"{best.title}\n\n{best.content.strip()}"
        if best.score < 0.16:
            content += "\n\n" + self._contact_text(usuario_id, question)
        return LLMResponse(
            content=content,
            provider="internal",
            model="support-rag-extractive",
            metadata={
                "intent": "technical_support",
                "route": "support_rag_fallback",
                "knowledge_sources": sorted({chunk.source for chunk in chunks}),
                "support_email": settings.support_email,
            },
        )

    def _fallback_response(self, usuario_id: str, question: str) -> LLMResponse:
        return LLMResponse(
            content=(
                "No encontré una solución suficientemente segura en la guía de FinSightAI.\n\n"
                + self._contact_text(usuario_id, question)
            ),
            provider="internal",
            model="support-rag-fallback",
            metadata={
                "intent": "technical_support",
                "route": "support_email_escalation",
                "knowledge_sources": [],
                "support_email": settings.support_email,
            },
        )

    def _contact_text(self, usuario_id: str, question: str) -> str:
        return (
            "El problema necesita una revisión del equipo de TwentyNineDevs.\n\n"
            "[🛠️ Ir a la página de Soporte](/soporte)\n\n"
            "Incluye, si es posible, una captura y el mensaje de error exacto. "
            "No compartas contraseñas, códigos de verificación, números de tarjeta ni datos bancarios."
        )
