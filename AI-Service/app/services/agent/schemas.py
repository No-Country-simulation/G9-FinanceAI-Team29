from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.agent.intent import Intent


@dataclass(frozen=True)
class NormalizedQuery:
    original: str
    normalized: str
    corrected: str
    corrections: tuple[tuple[str, str], ...] = ()


class QueryMode(StrEnum):
    DIRECT = "direct"
    ANALYTICAL = "analytical"


@dataclass(frozen=True)
class IntentResult:
    intent: "Intent"
    mode: QueryMode = QueryMode.DIRECT
    matched_terms: tuple[str, ...] = ()
