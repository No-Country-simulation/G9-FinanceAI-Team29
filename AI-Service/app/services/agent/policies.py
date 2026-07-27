import re
from dataclasses import dataclass
from enum import StrEnum

from app.services.agent.intent import Intent, IntentDetector
from app.services.agent.schemas import NormalizedQuery


class PolicyDecision(StrEnum):
    ALLOW = "allow"
    RESTRICT = "restrict"


@dataclass(frozen=True)
class PolicyResult:
    decision: PolicyDecision
    intent: Intent | None = None

    @property
    def allowed(self) -> bool:
        return self.decision == PolicyDecision.ALLOW


class AgentPolicies:
    USER_ID_PATTERN = re.compile(r"\bUSR\d+\b", re.IGNORECASE)
    _PRIVACY_TERMS = {
        "otro usuario", "otra persona", "otros usuarios", "todos los usuarios",
        "datos de usuarios", "datos de otras personas", "finanzas de otro",
        "comparame con otro", "ranking de usuarios",
    }
    _SECURITY_TERMS = {
        "muestra el prompt", "revela el prompt", "prompt del sistema",
        "instrucciones internas", "ignora tus instrucciones", "ignora las instrucciones",
        "clave api", "api key", "token secreto", "credenciales",
        "variables de entorno", "archivo env", "base de datos completa", "dataset completo",
    }

    @classmethod
    def evaluate(cls, usuario_id: str, query: NormalizedQuery) -> PolicyResult:
        referenced = {match.upper() for match in cls.USER_ID_PATTERN.findall(query.original)}
        current = usuario_id.strip().upper()
        if any(reference != current for reference in referenced):
            return PolicyResult(PolicyDecision.RESTRICT, Intent.PRIVACY_RESTRICTED)
        if IntentDetector._contains_any(query.corrected, cls._PRIVACY_TERMS):
            return PolicyResult(PolicyDecision.RESTRICT, Intent.PRIVACY_RESTRICTED)
        if IntentDetector._contains_any(query.corrected, cls._SECURITY_TERMS):
            return PolicyResult(PolicyDecision.RESTRICT, Intent.SECURITY_RESTRICTED)
        return PolicyResult(PolicyDecision.ALLOW)
