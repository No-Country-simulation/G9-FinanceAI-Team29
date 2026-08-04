import unittest
from unittest.mock import AsyncMock, patch

from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.normalizer import QueryNormalizer
from app.services.agent.router import AgentRoute, AgentRouter
from app.services.agent.schemas import IntentResult, QueryMode
from app.services.agent.service import FinSightAgentService
from app.services.agent.spell_corrector import FinancialSpellCorrector
from app.services.llm.prompt_builder import PromptBuilder
from app.services.backend_financial_data import BackendDataError


ANALYSIS = {
    "financial_score": 80,
    "score_status": "Bueno",
    "nivel_riesgo": "Bajo",
    "perfil_financiero": "Saludable",
    "metricas": {
        "ingreso_mensual": 1000,
        "gasto_mensual_promedio": 500,
        "deuda_mensual": 100,
        "ahorro_mensual_estimado": 400,
    },
}


class QueryPipelineTests(unittest.TestCase):
    def test_normalizer_does_not_correct(self):
        self.assertEqual(QueryNormalizer.normalize("Hola!!! Mi ESUMEN"), "hola mi esumen")

    def test_spell_corrector_records_controlled_corrections(self):
        normalized = QueryNormalizer.normalize("quiero mi esumen")
        query = FinancialSpellCorrector.process("quiero mi esumen", normalized)
        self.assertEqual(query.corrected, "quiero mi resumen")
        self.assertEqual(query.corrections, (("esumen", "resumen"),))

    def test_common_typographical_errors(self):
        cases = {
            "persupuesto": "presupuesto",
            "presupesto": "presupuesto",
            "ahorar": "ahorrar",
            "deudaa": "deuda",
            "ingresoss": "ingresos",
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                query = FinancialSpellCorrector.process(source, source)
                self.assertEqual(query.corrected, expected)

    def test_valid_word_ahora_is_not_changed(self):
        query = FinancialSpellCorrector.process("ahora", "ahora")
        self.assertEqual(query.corrected, "ahora")
        self.assertEqual(query.corrections, ())


class DeterministicIntentTests(unittest.TestCase):
    def test_detector_operates_on_corrected_text(self):
        detector = IntentDetector()
        self.assertEqual(detector.detect("quiero mi resumen"), Intent.SUMMARY)
        self.assertEqual(detector.detect("ayudame con mi presupuesto mensual"), Intent.BUDGET)

    def test_how_to_save_routes_to_recommendations(self):
        detector = IntentDetector()
        result = detector.detect_result("como puedo ahorrar por mes")

        self.assertEqual(result.intent, Intent.RECOMMENDATIONS)
        self.assertEqual(result.mode, QueryMode.ANALYTICAL)

    def test_how_much_can_i_save_routes_to_savings(self):
        detector = IntentDetector()
        result = detector.detect_result("cuanto puedo ahorrar por mes")

        self.assertEqual(result.intent, Intent.SAVINGS)
        self.assertEqual(result.mode, QueryMode.DIRECT)

    def test_analytical_mode_changes_route(self):
        router = AgentRouter()
        self.assertEqual(
            router.resolve(IntentResult(Intent.SAVINGS, QueryMode.DIRECT)),
            AgentRoute.DETERMINISTIC,
        )
        self.assertEqual(
            router.resolve(IntentResult(Intent.SAVINGS, QueryMode.ANALYTICAL)),
            AgentRoute.LLM_WITH_CONTEXT,
        )


class ServiceRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_direct_income_uses_no_llm(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        with (
            patch("app.services.agent.service.fetch_user_transactions", side_effect=__import__("app.services.backend_financial_data", fromlist=["BackendDataError"]).BackendDataError("sin backend en test")),
            patch("app.services.agent.service.fetch_live_analysis", return_value=ANALYSIS),
        ):
            response = await service.chat("USR0001", "cuanto ingreso")
        self.assertEqual(response.provider, "internal")
        self.assertIn("$1.000,00", response.content)
        service.llm.generate.assert_not_awaited()

    async def test_how_to_save_uses_llm_with_context(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Plan de ahorro"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}

        with patch("app.services.agent.service.analizar_usuario", return_value=ANALYSIS):
            response = await service.chat(
                "USR0001",
                "como puedo ahorrar por mes",
            )

        self.assertEqual(response.provider, "test")
        self.assertEqual(response.metadata["intent"], "recommendations")
        self.assertEqual(response.metadata["route"], "llm_with_context")
        self.assertTrue(response.metadata["used_financial_context"])
        service.llm.generate.assert_awaited_once()

    async def test_analytical_savings_uses_llm_and_context(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Análisis"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}
        with patch("app.services.agent.service.analizar_usuario", return_value=ANALYSIS):
            response = await service.chat("USR0001", "como puedo mejorar mi ahorro")
        self.assertEqual(response.provider, "test")
        self.assertTrue(response.metadata["used_financial_context"])
        service.llm.generate.assert_awaited_once()

    async def test_corrected_summary_uses_llm(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Resumen"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}
        with patch("app.services.agent.service.analizar_usuario", return_value=ANALYSIS):
            response = await service.chat("USR0001", "quiero mi esumen")
        self.assertEqual(response.metadata["corrections_count"], 1)
        service.llm.generate.assert_awaited_once()


class PromptBuilderTests(unittest.TestCase):
    def test_prompt_preserves_original_and_adds_interpretation(self):
        messages = PromptBuilder.build(
            original_question="quiero mi esumen",
            processed_question="quiero mi resumen",
            corrections=(("esumen", "resumen"),),
            context={},
            intent="summary",
        )
        user = messages[1].content
        self.assertIn("quiero mi esumen", user)
        self.assertIn("quiero mi resumen", user)
        self.assertIn("potencialmente imperfecta", user)


class DeterministicSavingsResponseTests(unittest.TestCase):
    def test_positive_savings_answers_capacity_directly(self):
        from app.services.agent.deterministic_responder import (
            DeterministicFinancialResponder,
        )

        response = DeterministicFinancialResponder.respond(
            Intent.SAVINGS,
            {"metricas": {"ahorro_mensual_estimado": 258.34}},
        )

        self.assertEqual(
            response,
            "Podés ahorrar aproximadamente USD 258.34 por mes.",
        )

    def test_zero_savings_explains_monthly_equilibrium(self):
        from app.services.agent.deterministic_responder import (
            DeterministicFinancialResponder,
        )

        response = DeterministicFinancialResponder.respond(
            Intent.SAVINGS,
            {"metricas": {"ahorro_mensual_estimado": 0}},
        )

        self.assertIn("no tenés capacidad de ahorro mensual", response)
        self.assertIn("cubrir exactamente", response)

    def test_negative_savings_answers_question_before_deficit(self):
        from app.services.agent.deterministic_responder import (
            DeterministicFinancialResponder,
        )

        response = DeterministicFinancialResponder.respond(
            Intent.SAVINGS,
            {"metricas": {"ahorro_mensual_estimado": -109.43}},
        )

        self.assertTrue(
            response.startswith(
                "Actualmente no tenés capacidad de ahorro mensual."
            )
        )
        self.assertIn("USD 109.43", response)
        self.assertNotIn("USD -", response)

    def test_money_formatter_is_fixed_to_usd(self):
        from app.services.agent.deterministic_responder import (
            DeterministicFinancialResponder,
        )

        self.assertEqual(
            DeterministicFinancialResponder._format_money("12.5"),
            "USD 12.50",
        )
