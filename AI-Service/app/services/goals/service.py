from datetime import UTC, date, datetime
from typing import Any

from app.profile import analizar_usuario
from app.schemas.goals import (
    GoalCreate,
    GoalUpdate,
)
from app.services.goals.repository import GoalRepository


class GoalService:
    def __init__(
        self,
        repository: GoalRepository | None = None,
    ) -> None:
        self.repository = repository or GoalRepository()

    def create_goal(
        self,
        data: GoalCreate,
    ) -> dict[str, Any]:
        self._get_user_analysis(data.usuario_id)

        now = datetime.now(UTC)

        goal = {
            **data.model_dump(mode="json"),
            "monto_reservado": 0.0,
            "estado": "ACTIVA",
            "fecha_creacion": now.isoformat(),
            "fecha_actualizacion": now.isoformat(),
        }

        created_goal = self.repository.create(goal)

        return self._build_goal_response(created_goal)

    def list_goals(
        self,
        usuario_id: str,
        estado: str | None = None,
    ) -> list[dict[str, Any]]:
        self._get_user_analysis(usuario_id)

        goals = self.repository.list_by_user(usuario_id)

        if estado is not None:
            normalized_status = estado.strip().upper()

            valid_statuses = {
                "ACTIVA",
                "COMPLETADA",
                "CANCELADA",
            }

            if normalized_status not in valid_statuses:
                raise ValueError(
                    "El estado debe ser ACTIVA, "
                    "COMPLETADA o CANCELADA."
                )

            goals = [
                goal
                for goal in goals
                if goal["estado"] == normalized_status
            ]

        return [
            self._build_goal_response(goal)
            for goal in goals
        ]

    def get_goal(
        self,
        goal_id: str,
    ) -> dict[str, Any]:
        goal = self._require_goal(goal_id)

        return self._build_goal_response(goal)

    def update_goal(
        self,
        goal_id: str,
        data: GoalUpdate,
    ) -> dict[str, Any]:
        goal = self._require_goal(goal_id)

        self._ensure_editable(goal)

        changes = data.model_dump(
            exclude_unset=True,
            mode="json",
        )

        new_target = changes.get(
            "monto_objetivo",
            goal["monto_objetivo"],
        )

        if new_target < goal["monto_reservado"]:
            raise ValueError(
                "El monto objetivo no puede ser menor "
                "que el dinero ya reservado."
            )

        goal.update(changes)
        goal["fecha_actualizacion"] = (
            datetime.now(UTC).isoformat()
        )

        goal["estado"] = self._calculate_status(goal)

        updated_goal = self.repository.update(
            goal_id,
            goal,
        )

        if updated_goal is None:
            raise ValueError("No se pudo actualizar la meta.")

        return self._build_goal_response(updated_goal)

    def reserve_money(
        self,
        goal_id: str,
        amount: float,
    ) -> dict[str, Any]:
        goal = self._require_goal(goal_id)

        self._ensure_active(goal)

        amount = round(float(amount), 2)

        if amount <= 0:
            raise ValueError(
                "El monto a reservar debe ser mayor que cero."
            )

        remaining = round(
            goal["monto_objetivo"]
            - goal["monto_reservado"],
            2,
        )

        if amount > remaining:
            raise ValueError(
                f"La meta solo necesita USD {remaining:.2f} "
                "para completarse."
            )

        available_balance = self._available_balance(
            goal["usuario_id"]
        )

        if amount > available_balance:
            raise ValueError(
                "Saldo disponible insuficiente. "
                f"Actualmente hay USD "
                f"{available_balance:.2f} disponibles."
            )

        goal["monto_reservado"] = round(
            goal["monto_reservado"] + amount,
            2,
        )
        goal["estado"] = self._calculate_status(goal)
        goal["fecha_actualizacion"] = (
            datetime.now(UTC).isoformat()
        )

        updated_goal = self.repository.update(
            goal_id,
            goal,
        )

        if updated_goal is None:
            raise ValueError(
                "No se pudo guardar la reserva."
            )

        response = self._build_goal_response(
            updated_goal
        )
        response["saldo_disponible"] = round(
            available_balance - amount,
            2,
        )

        return response

    def release_money(
        self,
        goal_id: str,
        amount: float,
    ) -> dict[str, Any]:
        goal = self._require_goal(goal_id)

        if goal["estado"] == "CANCELADA":
            raise ValueError(
                "No se puede liberar dinero "
                "de una meta cancelada."
            )

        amount = round(float(amount), 2)

        if amount <= 0:
            raise ValueError(
                "El monto a liberar debe ser mayor que cero."
            )

        if amount > goal["monto_reservado"]:
            raise ValueError(
                "No se puede liberar más dinero "
                "del que está reservado."
            )

        goal["monto_reservado"] = round(
            goal["monto_reservado"] - amount,
            2,
        )

        goal["estado"] = (
            "ACTIVA"
            if goal["monto_reservado"]
            < goal["monto_objetivo"]
            else "COMPLETADA"
        )

        goal["fecha_actualizacion"] = (
            datetime.now(UTC).isoformat()
        )

        updated_goal = self.repository.update(
            goal_id,
            goal,
        )

        if updated_goal is None:
            raise ValueError(
                "No se pudo liberar la reserva."
            )

        response = self._build_goal_response(
            updated_goal
        )
        response["saldo_disponible"] = (
            self._available_balance(
                goal["usuario_id"]
            )
        )

        return response

    def cancel_goal(
        self,
        goal_id: str,
    ) -> dict[str, Any]:
        goal = self._require_goal(goal_id)

        if goal["estado"] == "CANCELADA":
            raise ValueError(
                "La meta ya se encuentra cancelada."
            )

        released_amount = round(
            float(goal["monto_reservado"]),
            2,
        )

        goal["monto_reservado"] = 0.0
        goal["estado"] = "CANCELADA"
        goal["fecha_actualizacion"] = (
            datetime.now(UTC).isoformat()
        )

        updated_goal = self.repository.update(
            goal_id,
            goal,
        )

        if updated_goal is None:
            raise ValueError(
                "No se pudo cancelar la meta."
            )

        return {
            **self._build_goal_response(updated_goal),
            "monto_liberado": released_amount,
            "saldo_disponible": self._available_balance(
                goal["usuario_id"]
            ),
        }

    def get_summary(
        self,
        usuario_id: str,
    ) -> dict[str, Any]:
        balance = self._total_balance(usuario_id)

        goals = self.repository.list_by_user(
            usuario_id
        )

        active_goals = [
            goal
            for goal in goals
            if goal["estado"] == "ACTIVA"
        ]

        completed_goals = [
            goal
            for goal in goals
            if goal["estado"] == "COMPLETADA"
        ]

        reserved_total = round(
            sum(
                float(goal["monto_reservado"])
                for goal in active_goals
                + completed_goals
            ),
            2,
        )

        available = round(
            max(balance - reserved_total, 0.0),
            2,
        )

        reserved_percentage = (
            round(
                reserved_total / balance * 100,
                2,
            )
            if balance > 0
            else 0.0
        )

        return {
            "usuario_id": usuario_id,
            "saldo_total": balance,
            "total_reservado": reserved_total,
            "saldo_disponible": available,
            "metas_activas": len(active_goals),
            "metas_completadas": len(
                completed_goals
            ),
            "porcentaje_reservado": (
                reserved_percentage
            ),
        }

    def _total_balance(
        self,
        usuario_id: str,
    ) -> float:
        analysis = self._get_user_analysis(
            usuario_id
        )

        metrics = analysis["metricas"]

        balance = float(
            metrics["ahorro_mensual_estimado"]
        )

        return round(max(balance, 0.0), 2)

    def _reserved_total(
        self,
        usuario_id: str,
    ) -> float:
        goals = self.repository.list_by_user(
            usuario_id
        )

        return round(
            sum(
                float(goal["monto_reservado"])
                for goal in goals
                if goal["estado"]
                in {"ACTIVA", "COMPLETADA"}
            ),
            2,
        )

    def _available_balance(
        self,
        usuario_id: str,
    ) -> float:
        total = self._total_balance(usuario_id)
        reserved = self._reserved_total(
            usuario_id
        )

        return round(
            max(total - reserved, 0.0),
            2,
        )

    @staticmethod
    def _get_user_analysis(
        usuario_id: str,
    ) -> dict[str, Any]:
        try:
            return analizar_usuario(usuario_id)

        except ValueError as error:
            raise ValueError(
                f"No existe el usuario '{usuario_id}'."
            ) from error

    def _require_goal(
        self,
        goal_id: str,
    ) -> dict[str, Any]:
        goal = self.repository.get(goal_id)

        if goal is None:
            raise ValueError(
                f"No existe la meta '{goal_id}'."
            )

        return goal

    @staticmethod
    def _ensure_active(
        goal: dict[str, Any],
    ) -> None:
        if goal["estado"] != "ACTIVA":
            raise ValueError(
                "Solo se puede reservar dinero "
                "en una meta activa."
            )

    @staticmethod
    def _ensure_editable(
        goal: dict[str, Any],
    ) -> None:
        if goal["estado"] == "CANCELADA":
            raise ValueError(
                "No se puede modificar "
                "una meta cancelada."
            )

    @staticmethod
    def _calculate_status(
        goal: dict[str, Any],
    ) -> str:
        if (
            float(goal["monto_reservado"])
            >= float(goal["monto_objetivo"])
        ):
            return "COMPLETADA"

        return "ACTIVA"

    @staticmethod
    def _monthly_reservation(
        goal: dict[str, Any],
    ) -> float | None:
        target_date = goal.get("fecha_objetivo")

        if not target_date:
            return None

        if isinstance(target_date, str):
            target_date = date.fromisoformat(
                target_date
            )

        today = date.today()

        remaining_months = (
            (target_date.year - today.year) * 12
            + target_date.month
            - today.month
        )

        if target_date.day > today.day:
            remaining_months += 1

        remaining_months = max(
            remaining_months,
            1,
        )

        remaining_amount = max(
            float(goal["monto_objetivo"])
            - float(goal["monto_reservado"]),
            0.0,
        )

        return round(
            remaining_amount / remaining_months,
            2,
        )

    def _build_goal_response(
        self,
        goal: dict[str, Any],
    ) -> dict[str, Any]:
        target = float(goal["monto_objetivo"])
        reserved = float(goal["monto_reservado"])

        remaining = round(
            max(target - reserved, 0.0),
            2,
        )

        progress = (
            round(
                min(reserved / target * 100, 100),
                2,
            )
            if target > 0
            else 0.0
        )

        return {
            **goal,
            "monto_objetivo": round(
                target,
                2,
            ),
            "monto_reservado": round(
                reserved,
                2,
            ),
            "monto_restante": remaining,
            "progreso": progress,
            "reserva_mensual_sugerida": (
                self._monthly_reservation(goal)
            ),
        }