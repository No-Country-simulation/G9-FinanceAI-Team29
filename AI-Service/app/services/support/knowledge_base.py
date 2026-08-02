from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from app.services.support.normalizer import SupportQueryNormalizer


@dataclass(frozen=True)
class KnowledgeChunk:
    source: str
    title: str
    content: str
    score: float = 0.0


class SupportKnowledgeBase:
    """RAG local y liviano sobre documentos Markdown.

    No requiere una base vectorial externa: divide los documentos por títulos y
    recupera secciones mediante similitud TF-IDF/coseno.
    """

    _TOKEN_RE = re.compile(r"[a-z0-9áéíóúüñ_-]{2,}", re.IGNORECASE)
    _STOPWORDS = {
        "que", "como", "para", "por", "con", "una", "uno", "unos", "unas", "del",
        "las", "los", "el", "la", "se", "me", "mi", "tu", "su", "es", "en", "de",
        "y", "o", "no", "si", "al", "lo", "un", "ya", "mas", "muy", "puedo",
    }

    def __init__(self, docs_dir: Path) -> None:
        self.docs_dir = docs_dir
        self._chunks = self._load_chunks()
        self._document_frequency = self._build_document_frequency()

    def search(self, query: str, top_k: int = 4, min_score: float = 0.08) -> list[KnowledgeChunk]:
        query_tokens = self._tokens(query)
        if not query_tokens:
            return []
        query_vector = self._tfidf(query_tokens)
        ranked: list[KnowledgeChunk] = []
        for chunk in self._chunks:
            chunk_tokens = self._tokens(f"{chunk.title} {chunk.content}")
            score = self._cosine(query_vector, self._tfidf(chunk_tokens))
            if score >= min_score:
                ranked.append(KnowledgeChunk(chunk.source, chunk.title, chunk.content, score))
        ranked.sort(key=lambda item: item.score, reverse=True)
        return ranked[:top_k]

    def _load_chunks(self) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []
        for path in sorted(self.docs_dir.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            current_title = path.stem.replace("_", " ").title()
            body: list[str] = []
            for line in text.splitlines():
                if line.startswith("## "):
                    self._append_chunk(chunks, path.name, current_title, body)
                    current_title = line[3:].strip()
                    body = []
                elif not line.startswith("# "):
                    body.append(line)
            self._append_chunk(chunks, path.name, current_title, body)
        return chunks

    @staticmethod
    def _append_chunk(chunks: list[KnowledgeChunk], source: str, title: str, body: list[str]) -> None:
        content = "\n".join(body).strip()
        if content:
            chunks.append(KnowledgeChunk(source=source, title=title, content=content))

    def _build_document_frequency(self) -> Counter[str]:
        frequency: Counter[str] = Counter()
        for chunk in self._chunks:
            frequency.update(set(self._tokens(f"{chunk.title} {chunk.content}")))
        return frequency

    def _tfidf(self, tokens: list[str]) -> dict[str, float]:
        counts = Counter(tokens)
        total = max(len(tokens), 1)
        documents = max(len(self._chunks), 1)
        return {
            token: (count / total) * (math.log((documents + 1) / (self._document_frequency[token] + 1)) + 1)
            for token, count in counts.items()
        }

    @staticmethod
    def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
        common = set(left).intersection(right)
        numerator = sum(left[token] * right[token] for token in common)
        left_norm = math.sqrt(sum(value * value for value in left.values()))
        right_norm = math.sqrt(sum(value * value for value in right.values()))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return numerator / (left_norm * right_norm)

    @classmethod
    def _tokens(cls, text: str) -> list[str]:
        normalized = SupportQueryNormalizer.normalize(text)
        return [token for token in cls._TOKEN_RE.findall(normalized) if token not in cls._STOPWORDS]
