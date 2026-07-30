from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from io import BytesIO
import re
import unicodedata
import uuid

import pandas as pd


REQUIRED_COLUMNS = {
    "fecha",
    "descripcion",
    "monto",
    "tipo",
    "categoria",
    "medio_pago",
    "recurrente",
}

DEBT_CATEGORY_TERMS = {
    "deuda",
    "deudas",
    "prestamo",
    "prestamos",
    "credito",
    "creditos",
    "cuota",
    "cuotas",
    "tarjeta de credito",
}

TRUE_VALUES = {"true", "1", "si", "sí", "yes", "y"}
FALSE_VALUES = {"false", "0", "no", "n"}


class CSVValidationError(ValueError):
    """Error de validación legible para mostrar en frontend."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass(frozen=True)
class ProcessedCSV:
    usuario: dict[str, object]
    transacciones: list[dict[str, object]]
    resumen: dict[str, object]


def _normalize_text(value: object) -> str:
    text = "" if pd.isna(value) else str(value).strip()
    return re.sub(r"\s+", " ", text)


def _ascii_lower(value: object) -> str:
    text = _normalize_text(value).lower()
    return "".join(
        char
        for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )


def _parse_boolean(value: object, row_number: int) -> bool:
    normalized = _ascii_lower(value)
    if normalized in {_ascii_lower(item) for item in TRUE_VALUES}:
        return True
    if normalized in {_ascii_lower(item) for item in FALSE_VALUES}:
        return False
    raise CSVValidationError(
        [
            f"Fila {row_number}: 'recurrente' debe ser Sí/No, "
            "true/false o 1/0."
        ]
    )


def _parse_amount(value: object, row_number: int) -> float:
    if pd.isna(value) or _normalize_text(value) == "":
        raise CSVValidationError([f"Fila {row_number}: falta el monto."])

    raw = _normalize_text(value).replace("$", "").replace(" ", "")

    # Acepta 1234.56, 1234,56 y 1.234,56.
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        raw = raw.replace(",", ".")

    try:
        amount = float(raw)
    except ValueError as error:
        raise CSVValidationError(
            [f"Fila {row_number}: el monto '{value}' no es numérico."]
        ) from error

    if amount <= 0:
        raise CSVValidationError(
            [f"Fila {row_number}: el monto debe ser mayor que cero."]
        )

    return round(amount, 2)


def _parse_date(value: object, row_number: int) -> date:
    if pd.isna(value) or _normalize_text(value) == "":
        raise CSVValidationError([f"Fila {row_number}: falta la fecha."])

    parsed = pd.to_datetime(value, errors="coerce", dayfirst=False)
    if pd.isna(parsed):
        parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)

    if pd.isna(parsed):
        raise CSVValidationError(
            [
                f"Fila {row_number}: la fecha '{value}' no es válida. "
                "Usá YYYY-MM-DD."
            ]
        )

    return parsed.date()


def _normalize_type(value: object, row_number: int) -> str:
    normalized = _ascii_lower(value)
    aliases = {
        "ingreso": "INGRESO",
        "income": "INGRESO",
        "gasto": "GASTO",
        "egreso": "GASTO",
        "expense": "GASTO",
    }
    if normalized not in aliases:
        raise CSVValidationError(
            [f"Fila {row_number}: el tipo debe ser INGRESO o GASTO."]
        )
    return aliases[normalized]


def _validate_user_id(usuario_id: str) -> str:
    normalized = usuario_id.strip().upper()
    if not re.fullmatch(r"USR\d{4,}", normalized):
        raise CSVValidationError(
            ["usuario_id debe tener formato USR seguido de números, por ejemplo USR1001."]
        )
    return normalized


def _read_csv(content: bytes) -> pd.DataFrame:
    if not content:
        raise CSVValidationError(["El archivo CSV está vacío."])

    if len(content) > 5 * 1024 * 1024:
        raise CSVValidationError(["El CSV supera el máximo permitido de 5 MB."])

    last_error: Exception | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            frame = pd.read_csv(
                BytesIO(content),
                encoding=encoding,
                sep=None,
                engine="python",
                dtype=str,
            )
            break
        except Exception as error:  # pandas puede lanzar varios tipos
            last_error = error
    else:
        raise CSVValidationError(
            ["No se pudo leer el CSV. Verificá el formato y la codificación."]
        ) from last_error

    frame.columns = [_ascii_lower(column).replace(" ", "_") for column in frame.columns]
    missing = sorted(REQUIRED_COLUMNS - set(frame.columns))
    if missing:
        raise CSVValidationError(
            ["Faltan columnas obligatorias: " + ", ".join(missing) + "."]
        )

    frame = frame.dropna(how="all")
    if frame.empty:
        raise CSVValidationError(["El CSV no contiene transacciones."])

    return frame


def _classify_savings_frequency(savings_percentage: float) -> str:
    if savings_percentage <= 0:
        return "Nunca"
    if savings_percentage <= 10:
        return "Baja"
    if savings_percentage < 20:
        return "Media"
    return "Alta"


def _classify_profile(
    savings_percentage: float,
    debt_percentage: float,
    spending_percentage: float,
) -> str:
    # Replica los cortes principales observados en usuarios_sinteticos.csv.
    if savings_percentage >= 20 and debt_percentage < 20 and spending_percentage <= 60:
        return "Saludable"
    if savings_percentage <= 0 or debt_percentage >= 40 or spending_percentage > 90:
        return "En riesgo"
    return "En observación"


def process_user_csv(content: bytes, usuario_id: str) -> ProcessedCSV:
    user_id = _validate_user_id(usuario_id)
    frame = _read_csv(content)

    transactions: list[dict[str, object]] = []
    errors: list[str] = []

    for index, row in frame.iterrows():
        row_number = int(index) + 2
        try:
            description = _normalize_text(row["descripcion"])
            category = _normalize_text(row["categoria"])
            payment_method = _normalize_text(row["medio_pago"])

            if not description:
                raise CSVValidationError(
                    [f"Fila {row_number}: falta la descripción."]
                )
            if not category:
                raise CSVValidationError(
                    [f"Fila {row_number}: falta la categoría."]
                )
            if not payment_method:
                raise CSVValidationError(
                    [f"Fila {row_number}: falta el medio de pago."]
                )

            transaction_date = _parse_date(row["fecha"], row_number)
            amount = _parse_amount(row["monto"], row_number)
            transaction_type = _normalize_type(row["tipo"], row_number)
            recurring = _parse_boolean(row["recurrente"], row_number)

            transactions.append(
                {
                    "transaction_id": f"TXN-{uuid.uuid4().hex.upper()}",
                    "usuario_id": user_id,
                    "fecha": transaction_date.isoformat(),
                    "descripcion": description,
                    "monto": amount,
                    "moneda": "USD",
                    "tipo": transaction_type,
                    "categoria": category,
                    "medio_pago": payment_method,
                    "recurrente": recurring,
                    "origen": "CSV",
                }
            )
        except CSVValidationError as error:
            errors.extend(error.errors)

    if errors:
        raise CSVValidationError(errors[:50])

    transactions_frame = pd.DataFrame(transactions)
    transactions_frame["month"] = pd.to_datetime(
        transactions_frame["fecha"]
    ).dt.to_period("M")

    normalized_categories = transactions_frame["categoria"].map(_ascii_lower)
    debt_mask = normalized_categories.apply(
        lambda value: any(term in value for term in DEBT_CATEGORY_TERMS)
    ) & transactions_frame["tipo"].eq("GASTO")

    income_by_month = (
        transactions_frame.loc[transactions_frame["tipo"].eq("INGRESO")]
        .groupby("month")["monto"]
        .sum()
    )
    regular_spending_by_month = (
        transactions_frame.loc[
            transactions_frame["tipo"].eq("GASTO") & ~debt_mask
        ]
        .groupby("month")["monto"]
        .sum()
    )
    debt_by_month = (
        transactions_frame.loc[debt_mask]
        .groupby("month")["monto"]
        .sum()
    )

    all_months = sorted(transactions_frame["month"].unique())
    monthly_income = float(income_by_month.reindex(all_months, fill_value=0.0).mean())
    monthly_spending = float(
        regular_spending_by_month.reindex(all_months, fill_value=0.0).mean()
    )
    monthly_debt = float(debt_by_month.reindex(all_months, fill_value=0.0).mean())

    estimated_savings = monthly_income - monthly_spending - monthly_debt

    if monthly_income > 0:
        spending_percentage = monthly_spending / monthly_income * 100
        debt_percentage = monthly_debt / monthly_income * 100
        savings_percentage = estimated_savings / monthly_income * 100
    else:
        spending_percentage = 0.0
        debt_percentage = 0.0
        savings_percentage = 0.0

    usuario = {
        "usuario_id": user_id,
        "ingreso_mensual": round(monthly_income, 2),
        "gasto_mensual_promedio": round(monthly_spending, 2),
        "deuda_mensual": round(monthly_debt, 2),
        "ahorro_mensual_estimado": round(estimated_savings, 2),
        "porcentaje_gastos_ingreso": round(spending_percentage, 2),
        "nivel_endeudamiento": round(debt_percentage, 2),
        "porcentaje_ahorro_ingreso": round(savings_percentage, 2),
        "frecuencia_ahorro": _classify_savings_frequency(savings_percentage),
        "perfil_financiero": _classify_profile(
            savings_percentage,
            debt_percentage,
            spending_percentage,
        ),
        "estado": "ACTIVO",
    }

    resumen = {
        "cantidad_transacciones": len(transactions),
        "cantidad_meses": int(transactions_frame["month"].nunique()),
        "total_ingresos": round(
            float(
                transactions_frame.loc[
                    transactions_frame["tipo"].eq("INGRESO"), "monto"
                ].sum()
            ),
            2,
        ),
        "total_gastos": round(
            float(
                transactions_frame.loc[
                    transactions_frame["tipo"].eq("GASTO"), "monto"
                ].sum()
            ),
            2,
        ),
        "moneda": "USD",
    }

    return ProcessedCSV(
        usuario=usuario,
        transacciones=transactions,
        resumen=resumen,
    )
