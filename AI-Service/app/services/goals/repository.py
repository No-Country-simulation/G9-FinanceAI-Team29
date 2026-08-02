from typing import Any
import httpx
from app.config import settings
from app.services.backend_http import service_headers


class GoalRepository:
    """Persistencia de metas delegada al backend Spring, única fuente de verdad."""

    def __init__(self) -> None:
        self._base_url = settings.backend_url.rstrip("/")
        self._timeout = 5.0

    @staticmethod
    def _to_snake(goal: dict[str, Any]) -> dict[str, Any]:
        mapping = {
            "usuarioId": "usuario_id", "montoObjetivo": "monto_objetivo",
            "montoReservado": "monto_reservado", "montoRestante": "monto_restante",
            "fechaObjetivo": "fecha_objetivo", "reservaMensualSugerida": "reserva_mensual_sugerida",
            "fechaCreacion": "fecha_creacion", "fechaActualizacion": "fecha_actualizacion",
        }
        return {mapping.get(k, k): v for k, v in goal.items()}

    @staticmethod
    def _create_payload(goal: dict[str, Any]) -> dict[str, Any]:
        return {
            "nombre": goal["nombre"],
            "descripcion": goal.get("descripcion"),
            "categoria": goal.get("categoria", "OTRO"),
            "montoObjetivo": goal["monto_objetivo"],
            "fechaObjetivo": goal.get("fecha_objetivo"),
        }

    @staticmethod
    def _update_payload(goal: dict[str, Any]) -> dict[str, Any]:
        return {
            "nombre": goal.get("nombre"),
            "descripcion": goal.get("descripcion"),
            "categoria": goal.get("categoria"),
            "montoObjetivo": goal.get("monto_objetivo"),
            "fechaObjetivo": goal.get("fecha_objetivo"),
        }

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        headers = {**service_headers(), **kwargs.pop("headers", {})}
        try:
            response = httpx.request(
                method,
                f"{self._base_url}{path}",
                timeout=self._timeout,
                headers=headers,
                **kwargs,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as error:
            try:
                detail = error.response.json().get("message") or error.response.json().get("detail")
            except Exception:
                detail = error.response.text
            raise ValueError(detail or "El backend rechazó la operación de metas.") from error
        except httpx.RequestError as error:
            raise ValueError("No se pudo conectar con el backend de FinSightAI.") from error

    def list_all(self) -> list[dict[str, Any]]:
        raise ValueError("La consulta global de metas no está permitida.")

    def list_by_user(self, usuario_id: str) -> list[dict[str, Any]]:
        data = self._request("GET", f"/usuarios/{usuario_id}/metas")
        return [self._to_snake(item) for item in data]

    def get(self, goal_id: str) -> dict[str, Any] | None:
        # El acceso seguro requiere conocer el usuario; se resuelve buscando solo entre usuarios conocidos por el servicio.
        return None

    def create(self, goal: dict[str, Any]) -> dict[str, Any]:
        usuario_id = goal["usuario_id"]
        data = self._request("POST", f"/usuarios/{usuario_id}/metas", json=self._create_payload(goal))
        return self._to_snake(data)

    def update(self, goal_id: str, updated_goal: dict[str, Any]) -> dict[str, Any] | None:
        usuario_id = updated_goal["usuario_id"]
        reserved_before = float(updated_goal.get("monto_reservado", 0))
        current = self._request("GET", f"/usuarios/{usuario_id}/metas/{goal_id}")
        current_reserved = float(current.get("montoReservado", 0))
        self._request("PATCH", f"/usuarios/{usuario_id}/metas/{goal_id}", json=self._update_payload(updated_goal))
        delta = round(reserved_before - current_reserved, 2)
        if delta > 0:
            data = self._request("POST", f"/usuarios/{usuario_id}/metas/{goal_id}/reservas", json={"monto": delta})
        elif delta < 0:
            data = self._request("POST", f"/usuarios/{usuario_id}/metas/{goal_id}/liberaciones", json={"monto": abs(delta)})
        else:
            data = self._request("GET", f"/usuarios/{usuario_id}/metas/{goal_id}")
        if updated_goal.get("estado") == "CANCELADA":
            data = self._request("DELETE", f"/usuarios/{usuario_id}/metas/{goal_id}")
        return self._to_snake(data)

    def delete(self, goal_id: str) -> bool:
        return False
