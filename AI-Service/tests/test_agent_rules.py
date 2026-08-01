import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from app.services.agent.calculator import FinancialCalculator
from app.services.agent.context_builder import FinancialContextBuilder
from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.service import FinSightAgentService


class IntentDetectorTests(unittest.TestCase):
    def setUp(self):
        self.detector = IntentDetector()

    def test_rejects_generic_math_without_financial_semantics(self):
        for question in ("2x0", "5+5", "30% de 500", "√144", "$2x$0", "$2000x$550"):
            with self.subTest(question=question):
                self.assertEqual(
                    self.detector.detect(question),
                    Intent.NON_FINANCIAL_CALCULATION,
                )

    def test_accepts_financial_calculations_with_money(self):
        cases = (
            "10% de $500",
            "interés de USD 3000",
            "descuento de $100",
            "descueto del 20% de $300",
            "IVA del 21% sobre USD 100",
        )
        for question in cases:
            with self.subTest(question=question):
                self.assertEqual(
                    self.detector.detect(question),
                    Intent.FINANCIAL_CALCULATION,
                )

    def test_detects_summary_with_typographical_errors(self):
        cases = (
            "necesito un resumen de mi situacion",
            "necesito un esumen de mi situacion",
            "dame un resmen de mis finanzas",
            "quiero un panorama de mi situacion financiera",
        )
        for question in cases:
            with self.subTest(question=question):
                self.assertEqual(self.detector.detect(question), Intent.SUMMARY)

    def test_detects_other_typographical_errors(self):
        cases = {
            "como estan mis ingreos": Intent.INCOME,
            "quiero revisar mis gstos": Intent.EXPENSES,
            "como esta mi endeudamieto": Intent.DEBT,
            "cual es mi capacdad de ahorro": Intent.SAVINGS,
            "armame un prespuesto": Intent.BUDGET,
        }
        for question, expected in cases.items():
            with self.subTest(question=question):
                self.assertEqual(self.detector.detect(question), expected)

    def test_budget_is_explicit(self):
        self.assertEqual(self.detector.detect("Armame un presupuesto"), Intent.BUDGET)

    def test_financial_education_does_not_require_personal_context(self):
        self.assertEqual(
            self.detector.detect("¿Qué es el interés compuesto?"),
            Intent.FINANCIAL_EDUCATION,
        )

    def test_detects_pib_question_as_financial_education(self):
        self.assertEqual(
            self.detector.detect("Cual es el PIB? dimelo en negritas"),
            Intent.FINANCIAL_EDUCATION,
        )

    def test_off_topic_is_rejected(self):
        self.assertEqual(self.detector.detect("quién ganó el mundial"), Intent.OUT_OF_SCOPE)


class FinancialCalculatorTests(unittest.TestCase):
    def test_percentage_preserves_dollar_symbol(self):
        result = FinancialCalculator.calculate("10% de $500")
        self.assertTrue(result.completed)
        self.assertEqual(result.message, "El 10% de $500.00 es $50.00.")

    def test_percentage_preserves_usd_prefix(self):
        result = FinancialCalculator.calculate("10% de USD 500")
        self.assertTrue(result.completed)
        self.assertEqual(result.message, "El 10% de USD 500.00 es USD 50.00.")

    def test_discount(self):
        result = FinancialCalculator.calculate("descuento del 20% sobre $300")
        self.assertTrue(result.completed)
        self.assertEqual(
            result.message,
            "El descuento es $60.00 y el precio final queda en $240.00.",
        )


    def test_discount_tolerates_typo(self):
        result = FinancialCalculator.calculate("descueto del 20% sobre $300")
        self.assertTrue(result.completed)
        self.assertEqual(
            result.message,
            "El descuento es $60.00 y el precio final queda en $240.00.",
        )

    def test_interest_requires_rate(self):
        result = FinancialCalculator.calculate("interés de USD 3000")
        self.assertFalse(result.completed)
        self.assertIn("tasa", result.message.lower())

    def test_discount_requires_rate(self):
        result = FinancialCalculator.calculate("descuento de $100")
        self.assertFalse(result.completed)
        self.assertIn("porcentaje", result.message.lower())
        self.assertIn("$100.00", result.message)

    def test_uses_decimal(self):
        money = FinancialCalculator._extract_money("$0.10")
        self.assertIsNotNone(money)
        assert money is not None
        self.assertEqual(money.value, Decimal("0.10"))


class ContextBuilderTests(unittest.TestCase):
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
            "ratio_gasto_ingreso": 50,
            "ratio_deuda_ingreso": 10,
            "ratio_ahorro_ingreso": 40,
        },
    }

    def test_income_context_is_minimal(self):
        context = FinancialContextBuilder.build(Intent.INCOME, self.ANALYSIS)
        self.assertEqual(set(context), {"currency", "ingresos"})
        self.assertNotIn("financial_score", context)

    def test_unknown_context_has_no_financial_data(self):
        context = FinancialContextBuilder.build(Intent.UNKNOWN, self.ANALYSIS)
        self.assertEqual(context, {"currency": "USD"})


class AgentRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_summary_typo_uses_context_and_llm(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Resumen"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}

        with patch("app.services.agent.service.analizar_usuario", return_value=ContextBuilderTests.ANALYSIS):
            response = await service.chat("USR0001", "necesito un esumen de mi situacion")

        self.assertEqual(response.provider, "test")
        self.assertTrue(response.metadata["used_financial_context"])
        service.llm.generate.assert_awaited_once()

    async def test_generic_math_never_calls_llm_or_profile(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()

        with patch("app.services.agent.service.analizar_usuario") as profile_mock:
            response = await service.chat("USR0001", "$2000x$550")

        self.assertEqual(response.provider, "internal")
        service.llm.generate.assert_not_awaited()
        profile_mock.assert_not_called()

    async def test_financial_education_uses_llm_without_context(self):
        service = FinSightAgentService()
        service.llm.generate = AsyncMock()
        service.llm.generate.return_value.content = "Explicación"
        service.llm.generate.return_value.provider = "test"
        service.llm.generate.return_value.metadata = {}

        with patch("app.services.agent.service.analizar_usuario") as profile_mock:
            response = await service.chat("USR0001", "¿Qué es el interés compuesto?")

        self.assertFalse(response.metadata["used_financial_context"])
        profile_mock.assert_not_called()
        service.llm.generate.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
