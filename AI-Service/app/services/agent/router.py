from enum import StrEnum

from app.services.agent.intent import Intent
from app.services.agent.schemas import IntentResult, QueryMode


class AgentRoute(StrEnum):
    INTERNAL = "internal"
    CALCULATOR = "calculator"
    DETERMINISTIC = "deterministic"
    LLM_WITH_CONTEXT = "llm_with_context"
    LLM_WITHOUT_CONTEXT = "llm_without_context"


class AgentRouter:
    _INTERNAL = {
        Intent.GREETING, Intent.THANKS, Intent.FAREWELL, Intent.CAPABILITIES,
        Intent.UNKNOWN, Intent.OUT_OF_SCOPE, Intent.NON_FINANCIAL_CALCULATION,
        Intent.PRIVACY_RESTRICTED, Intent.SECURITY_RESTRICTED,
    }
    _DIRECT_FINANCIAL = {
        Intent.INCOME, Intent.EXPENSES, Intent.DEBT, Intent.SAVINGS,
        Intent.SCORE, Intent.PROFILE, Intent.GOALS,
    }
    _ANALYTICAL = {
        Intent.SUMMARY, Intent.FULL_ANALYSIS, Intent.BUDGET, Intent.RECOMMENDATIONS,
    }

    @classmethod
    def resolve(cls, result: IntentResult) -> AgentRoute:
        if result.intent in cls._INTERNAL:
            return AgentRoute.INTERNAL
        if result.intent == Intent.FINANCIAL_CALCULATION:
            return AgentRoute.CALCULATOR
        if result.intent == Intent.FINANCIAL_EDUCATION:
            return AgentRoute.LLM_WITHOUT_CONTEXT
        if result.intent in cls._DIRECT_FINANCIAL:
            return (
                AgentRoute.LLM_WITH_CONTEXT
                if result.mode == QueryMode.ANALYTICAL
                else AgentRoute.DETERMINISTIC
            )
        if result.intent in cls._ANALYTICAL:
            return AgentRoute.LLM_WITH_CONTEXT
        return AgentRoute.INTERNAL
