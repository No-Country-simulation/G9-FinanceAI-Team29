"""Acceso a los datos financieros reales expuestos por Spring Boot.

El AI-Service usa Spring como fuente de verdad para usuarios registrados. El
CSV procesado queda solamente como respaldo para las cuentas demo históricas.
"""
from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

import httpx
import pandas as pd

from app.config import settings
from app.services.backend_http import service_headers


class BackendDataError(RuntimeError):
    """Error al consultar o interpretar los datos del backend principal."""


def _endpoint(path: str) -> str:
    return f"{settings.backend_url.rstrip('/')}/{path.lstrip('/')}"


def fetch_user_transactions(usuario_id: str) -> list[dict[str, Any]]:
    """Obtiene y normaliza las transacciones de un usuario desde Spring."""
    url = _endpoint(f"usuarios/{usuario_id}/transacciones")
    try:
        response = httpx.get(url, timeout=8.0, headers=service_headers())
    except httpx.RequestError as exc:
        raise BackendDataError(
            f"No se pudo conectar con el backend Spring en {settings.backend_url}."
        ) from exc

    if response.status_code == 404:
        raise ValueError(f"No existe el usuario {usuario_id}.")
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise BackendDataError(
            f"Spring respondió HTTP {response.status_code} al consultar transacciones."
        ) from exc

    payload = response.json()
    if isinstance(payload, dict):
        payload = payload.get("transacciones", payload.get("data", []))
    if not isinstance(payload, list):
        raise BackendDataError("El backend devolvió un formato de transacciones inválido.")

    normalized: list[dict[str, Any]] = []
    for raw in payload:
        if not isinstance(raw, dict):
            continue
        try:
            monto = float(raw.get("monto", 0) or 0)
        except (TypeError, ValueError):
            continue
        tipo = str(raw.get("tipo", "")).strip().upper()
        normalized.append(
            {
                "usuario_id": str(usuario_id),
                "id": raw.get("id"),
                "descripcion": str(raw.get("descripcion", "")).strip(),
                "monto": monto,
                "categoria": str(raw.get("categoria", "Sin categoría")).strip()
                or "Sin categoría",
                "fecha": raw.get("fecha"),
                "tipo": tipo,
                "medioPago": raw.get("medioPago", raw.get("medio_pago", "")),
                "recurrente": bool(raw.get("recurrente", False)),
            }
        )
    return normalized


def _safe_ratio(value: float, ingreso: float) -> float:
    return value / ingreso if ingreso > 0 else 0.0


def build_live_analysis(usuario_id: str, transactions: list[dict[str, Any]]) -> dict[str, Any]:
    """Construye el mismo contrato de análisis que consume el agente.

    No fuerza el modelo entrenado con datos sintéticos: calcula métricas reales
    y una clasificación transparente basada en ratios.
    """
    if not transactions:
        raise ValueError("El usuario no posee transacciones.")

    frame = pd.DataFrame(transactions)
    frame["monto"] = pd.to_numeric(frame["monto"], errors="coerce").fillna(0.0)
    frame["tipo"] = frame["tipo"].astype(str).str.upper().str.strip()
    frame["fecha_dt"] = pd.to_datetime(frame.get("fecha"), errors="coerce")

    ingresos = frame[frame["tipo"].eq("INGRESO")]
    gastos = frame[frame["tipo"].eq("GASTO")]
    if gastos.empty and ingresos.empty:
        raise ValueError("El usuario no posee transacciones financieras válidas.")

    # Promedios mensuales para no sumar varios meses como si fueran uno solo.
    valid = frame.dropna(subset=["fecha_dt"]).copy()
    monthly_income: list[float] = []
    monthly_expenses: list[float] = []
    if not valid.empty:
        valid["periodo"] = valid["fecha_dt"].dt.to_period("M").astype(str)
        for _, month in valid.groupby("periodo"):
            monthly_income.append(float(month.loc[month["tipo"].eq("INGRESO"), "monto"].sum()))
            monthly_expenses.append(float(month.loc[month["tipo"].eq("GASTO"), "monto"].sum()))

    ingreso_mensual = mean(monthly_income) if monthly_income else float(ingresos["monto"].sum())
    gasto_mensual = mean(monthly_expenses) if monthly_expenses else float(gastos["monto"].sum())

    debt_mask = gastos["categoria"].astype(str).str.lower().str.contains(
        "préstamo|prestamo|deuda|tarjeta de crédito|tarjeta de credito", regex=True
    )
    deuda_total = float(gastos.loc[debt_mask, "monto"].sum())
    months_count = max(len(monthly_expenses), 1)
    deuda_mensual = deuda_total / months_count

    ahorro_mask = gastos["categoria"].astype(str).str.lower().str.contains("ahorro", regex=False)
    ahorro_mensual = float(gastos.loc[ahorro_mask, "monto"].sum()) / months_count
    saldo = ingreso_mensual - gasto_mensual

    ratio_gasto = _safe_ratio(gasto_mensual, ingreso_mensual)
    ratio_deuda = _safe_ratio(deuda_mensual, ingreso_mensual)
    ratio_ahorro = _safe_ratio(ahorro_mensual, ingreso_mensual)

    score = 100
    score -= 30 if ratio_gasto > 0.9 else 20 if ratio_gasto > 0.7 else 10 if ratio_gasto > 0.5 else 0
    score -= 30 if ratio_deuda > 0.45 else 20 if ratio_deuda > 0.3 else 10 if ratio_deuda > 0.15 else 0
    score -= 20 if ratio_ahorro < 0.1 else 10 if ratio_ahorro < 0.2 else 0
    score = max(0, min(100, score))

    if score >= 75:
        perfil, estado, color, riesgo = "Saludable", "Bueno", "green", "Bajo"
    elif score >= 45:
        perfil, estado, color, riesgo = "En observación", "En observación", "yellow", "Moderado"
    else:
        perfil, estado, color, riesgo = "En riesgo", "Riesgo alto", "orange", "Alto"

    category_totals: defaultdict[str, float] = defaultdict(float)
    for tx in transactions:
        if tx["tipo"] == "GASTO":
            category_totals[tx["categoria"]] += float(tx["monto"])
    total_gastos = sum(category_totals.values())
    categorias = [
        {
            "categoria": category,
            "monto": round(amount, 2),
            "porcentaje": round((amount / total_gastos * 100) if total_gastos else 0, 2),
        }
        for category, amount in sorted(category_totals.items(), key=lambda item: item[1], reverse=True)
    ]

    fortalezas: list[str] = []
    oportunidades: list[str] = []
    recomendaciones: list[str] = []
    if ratio_gasto <= 0.6:
        fortalezas.append("El nivel de gasto se mantiene controlado.")
    else:
        oportunidades.append("Reducir el peso de los gastos sobre los ingresos.")
    if ratio_deuda <= 0.2:
        fortalezas.append("El endeudamiento se encuentra dentro de un rango saludable.")
    else:
        oportunidades.append("Priorizar la reducción de deuda.")
    if ratio_ahorro >= 0.2:
        fortalezas.append("La capacidad de ahorro mensual es sólida.")
    else:
        oportunidades.append("Aumentar gradualmente el ahorro mensual.")
    recomendaciones.append(
        "Revisar las categorías de mayor consumo para detectar oportunidades de ajuste."
        if categorias
        else "Registrar más movimientos para mejorar el análisis."
    )
    recomendaciones.append(
        "Mantener el hábito de ahorro y construir un fondo de emergencia."
        if ratio_ahorro >= 0.2
        else "Definir un objetivo inicial de ahorro de al menos el 10% del ingreso mensual."
    )

    return {
        "usuario_id": usuario_id,
        "financial_score": score,
        "score_status": estado,
        "score_color": color,
        "nivel_riesgo": riesgo,
        "perfil_financiero": perfil,
        "confianza_perfil": 1.0,
        "probabilidades_perfil": {perfil: 1.0},
        "explicacion": (
            f"Los gastos mensuales representan aproximadamente el {ratio_gasto * 100:.1f}% "
            f"de los ingresos. El nivel de deuda equivale al {ratio_deuda * 100:.1f}% y "
            f"el ahorro identificado al {ratio_ahorro * 100:.1f}%."
        ),
        "fortalezas": fortalezas or ["Hay información suficiente para construir un plan financiero."],
        "oportunidades_mejora": oportunidades,
        "metricas": {
            "ingreso_mensual": round(ingreso_mensual, 2),
            "gasto_mensual_promedio": round(gasto_mensual, 2),
            "deuda_mensual": round(deuda_mensual, 2),
            "ahorro_mensual_estimado": round(ahorro_mensual, 2),
            "ratio_gasto_ingreso": round(ratio_gasto, 4),
            "ratio_deuda_ingreso": round(ratio_deuda, 4),
            "ratio_ahorro_ingreso": round(ratio_ahorro, 4),
        },
        "wallet": {
            "saldo_total": round(saldo, 2),
            "saldo_reservado": round(ahorro_mensual, 2),
            "saldo_disponible": round(saldo - ahorro_mensual, 2),
        },
        "categorias_principales": categorias[:5],
        "recomendaciones": recomendaciones,
        "modelo_version": "live-backend-1.0.0",
        "transactions": transactions,
    }


def fetch_live_analysis(usuario_id: str) -> dict[str, Any]:
    return build_live_analysis(usuario_id, fetch_user_transactions(usuario_id))


def fetch_user_profile(usuario_id: str) -> dict[str, Any]:
    """Obtiene el perfil básico para personalizar respuestas del agente."""
    url = _endpoint(f"usuarios/{usuario_id}")
    try:
        response = httpx.get(url, timeout=8.0, headers=service_headers())
    except httpx.RequestError as exc:
        raise BackendDataError(
            f"No se pudo conectar con el backend Spring en {settings.backend_url}."
        ) from exc

    if response.status_code == 404:
        raise ValueError(f"No existe el usuario {usuario_id}.")
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise BackendDataError(
            f"Spring respondió HTTP {response.status_code} al consultar el perfil."
        ) from exc

    payload = response.json()
    if not isinstance(payload, dict):
        raise BackendDataError("El backend devolvió un perfil de usuario inválido.")
    return payload
