import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import settings


class GoalRepository:
    def __init__(self) -> None:
        self._path: Path = settings.goals_storage_path

        self._path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        if not self._path.exists():
            self._save([])

    def _load(self) -> list[dict[str, Any]]:
        with self._path.open(
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    def _save(
        self,
        goals: list[dict[str, Any]],
    ) -> None:
        with self._path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                goals,
                file,
                indent=4,
                ensure_ascii=False,
            )

    def list_all(self) -> list[dict[str, Any]]:
        return self._load()

    def list_by_user(
        self,
        usuario_id: str,
    ) -> list[dict[str, Any]]:
        return [
            goal
            for goal in self._load()
            if goal["usuario_id"] == usuario_id
        ]

    def get(
        self,
        goal_id: str,
    ) -> dict[str, Any] | None:
        for goal in self._load():
            if goal["id"] == goal_id:
                return goal

        return None

    def create(
        self,
        goal: dict[str, Any],
    ) -> dict[str, Any]:
        goals = self._load()

        goal["id"] = str(uuid4())

        goals.append(goal)

        self._save(goals)

        return goal

    def update(
        self,
        goal_id: str,
        updated_goal: dict[str, Any],
    ) -> dict[str, Any] | None:
        goals = self._load()

        for index, goal in enumerate(goals):
            if goal["id"] == goal_id:
                goals[index] = updated_goal

                self._save(goals)

                return updated_goal

        return None

    def delete(
        self,
        goal_id: str,
    ) -> bool:
        goals = self._load()

        filtered = [
            goal
            for goal in goals
            if goal["id"] != goal_id
        ]

        if len(filtered) == len(goals):
            return False

        self._save(filtered)

        return True