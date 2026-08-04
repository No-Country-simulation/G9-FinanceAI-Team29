import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.goal_responder import DeterministicGoalResponder
from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.rules_engine import FinancialRulesEngine
from app.services.agent.service import FinSightAgentService
from app.services.goals.repository import GoalRepository


ANALYSIS = {
    "financial_score": 90,
    "score_status": "Excelente",
    "nivel_riesgo": "Bajo",
    "metricas": {
        "ingreso_mensual": 1000,
        "gasto_mensual_promedio": 900,
        "deuda_mensual": 209.43,
        "ahorro_mensual_estimado": -109.43,
        "ratio_gasto_ingreso": 90,
        "ratio_deuda_ingreso": 20.943,
        "ratio_ahorro_ingreso": -10.943,
    },
    "categorias_principales": ["Transporte"],
}


class RulesEngineTests(unittest.TestCase):
    def test_detects_deficit_and_high_expenses(self):
        facts = FinancialRulesEngine.evaluate(ANALYSIS)
        codes = {fact["code"] for fact in facts}
        self.assertIn("monthly_deficit", codes)
        self.assertIn("high_expense_ratio", codes)
        self.assertIn("financial_score", codes)

    def test_context_includes_verified_facts_for_recommendations(self):
        facts = FinancialRulesEngine.evaluate(ANALYSIS)
        context = FinancialContextBuilder.build(Intent.RECOMMENDATIONS, ANALYSIS, facts)
        self.assertEqual(context["currency"], "USD")
        self.assertIn("hechos_verificados", context["orientacion"])
        self.assertTrue(context["orientacion"]["hechos_verificados"])


class GoalIntentTests(unittest.TestCase):
    def test_detects_goal_queries(self):
        detector = IntentDetector()
        for question in ("como va mi meta", "cuanto me falta para mi objetivo financiero", "mis metas"):
            with self.subTest(question=question):
                self.assertEqual(detector.detect(question), Intent.GOALS)

    def test_single_goal_response(self):
        response = DeterministicGoalResponder.respond([{
            "nombre": "Notebook",
            "estado": "ACTIVA",
            "monto_objetivo": 1500,
            "monto_reservado": 850,
            "fecha_objetivo": "2026-12-01",
        }])
        self.assertIn("56.7%", response)
        self.assertIn("USD 650.00", response)
        self.assertIn("01/12/2026", response)

    def test_no_goals_response(self):
        self.assertEqual(
            DeterministicGoalResponder.respond([]),
            "Todavía no tenés metas financieras registradas.",
        )


class GoalServiceRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_goal_query_is_internal_and_does_not_call_llm(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.goal_repository.list_by_user = lambda user_id: [{
            "nombre": "Viaje",
            "estado": "ACTIVA",
            "monto_objetivo": 1000,
            "monto_reservado": 250,
        }]

        response = await service.chat("USR0001", "como va mi meta")

        self.assertEqual(response.provider, "internal")
        self.assertEqual(response.metadata["intent"], "goals")
        self.assertIn("25.0%", response.content)
        service.llm.generate.assert_not_awaited()

    async def test_recommendations_receive_rules(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Recomendación"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}

        with (
            patch("app.services.agent.service.fetch_user_transactions", side_effect=__import__("app.services.backend_financial_data", fromlist=["BackendDataError"]).BackendDataError("sin backend en test")),
            patch("app.services.agent.service.fetch_live_analysis", return_value=ANALYSIS),
        ):
            response = await service.chat("USR0001", "como puedo ahorrar")

        self.assertEqual(response.metadata["route"], "llm_with_context")
        call = service.llm.generate.await_args.kwargs
        user_prompt = call["messages"][1].content
        self.assertIn("hechos_verificados", user_prompt)
        self.assertIn("monthly_deficit", user_prompt)


if __name__ == "__main__":
    unittest.main()
