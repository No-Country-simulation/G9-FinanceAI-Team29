from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

import pandas as pd

from app.services.agent.normalizer import QueryNormalizer


@dataclass(frozen=True)
class TransactionQueryResult:
    content: str
    action: str


class TransactionQueryEngine:
    """Motor determinístico para preguntas financieras basadas en datos reales.

    Se ejecuta antes de los intents genéricos para evitar que preguntas concretas
    (máximos, períodos, categorías y comparaciones) terminen en una
    respuesta genérica o en un cálculo inventado por el LLM.
    """

    EXPENSE_TYPES = {"GASTO", "EGRESO", "EXPENSE"}
    INCOME_TYPES = {"INGRESO", "INCOME"}
    DEBT_TERMS = ("deuda", "prestamo", "préstamo", "credito", "crédito", "tarjeta", "cuota")

    @classmethod
    def is_financial_query_candidate(
        cls,
        question: str,
        previous_answer: str | None = None,
    ) -> bool:
        """Evita que consultas financieras concretas sean derivadas a soporte."""
        q = QueryNormalizer.normalize(question)
        if not q:
            return False

        q = re.sub(r"\bantes\s*de\s*ayer\b", "anteayer", q)
        q = re.sub(r"\bantesdeayer\b", "anteayer", q)

        financial_terms = (
            "gasto", "gastos", "gaste", "gasté", "compra", "compras",
            "ingreso", "ingresos", "ingrese", "cobre", "cobré", "sueldo",
            "ahorro", "ahorre", "movimiento", "movimientos", "transaccion",
            "transacciones", "categoria", "categoría", "subcategoria", "subcategorias", "medio de pago",
            "balance", "finanzas", "deuda", "presupuesto", "plata", "dinero",
            "hoy", "ayer", "anteayer", "semana", "mes pasado", "mes anterior",
        )
        month_names = (
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "setiembre", "octubre",
            "noviembre", "diciembre",
        )
        contextual_terms = (
            "y el mes pasado", "y el anterior", "y el siguiente",
            "y el ano anterior", "y el año anterior", "y el ano siguiente", "y el año siguiente",
            "y la segunda", "y la tercera", "y la cuarta", "y la quinta",
            "que movimiento fue ese", "que movimiento fue esa",
            "que compra fue esa", "que gastos fueron esos",
            "que compre ese dia", "en que gaste ese dia",
            "eso es de", "corresponde a",
        )

        if any(term in q for term in financial_terms + month_names + contextual_terms):
            return True

        if previous_answer:
            previous = QueryNormalizer.normalize(previous_answer)
            previous_is_financial = any(
                term in previous
                for term in (
                    "gastaste", "ingresaste", "gasto", "ingreso",
                    "movimiento", "transaccion", "categoria", "balance",
                )
            )
            if previous_is_financial and (
                q.startswith(("y ", "eso ", "ese ", "esa ", "que movimiento"))
                or cls._has(
                    q,
                    "explicame mas", "explica mas", "amplia", "ampliame",
                    "quiero mas detalle", "dame mas detalle", "mas detalles",
                    "contame mas", "cuentame mas", "quiero saber mas",
                )
            ):
                return True

        return False

    @classmethod
    def answer(
        cls,
        question: str,
        transactions: list[dict[str, Any]],
        *,
        user_name: str | None = None,
        analysis: dict[str, Any] | None = None,
        today: date | None = None,
        previous_answer: str | None = None,
    ) -> TransactionQueryResult | None:
        q = QueryNormalizer.normalize(question)
        if not q:
            return None

        # Canonicaliza variantes coloquiales del período relativo.
        # QueryNormalizer elimina tildes, pero no une expresiones como
        # "antes de ayer" o "antesdeayer".
        q = re.sub(r"\bantes\s*de\s*ayer\b", "anteayer", q)
        q = re.sub(r"\bantesdeayer\b", "anteayer", q)

        actual_today = today or date.today()

        if cls._has(
            q,
            "que dia es hoy",
            "cual es la fecha actual",
            "fecha actual",
            "en que fecha estamos",
            "que fecha es hoy",
        ):
            return cls._result(
                f"Hoy es {cls._spanish_date(actual_today)}.",
                "current_date",
            )

        if cls._has(q, "en que mes estamos", "que mes es", "cual es el mes actual"):
            return cls._result(
                f"Estamos en {cls._spanish_month(actual_today.year, actual_today.month)}.",
                "current_month",
            )

        frame = cls._frame(transactions)

        # Finsi solo analiza movimientos ocurridos hasta la fecha actual/local.
        # Las transacciones futuras del dataset no se consideran realizadas.
        if not frame.empty and "fecha" in frame.columns:
            frame = frame[
                frame["fecha"].isna()
                | frame["fecha"].dt.date.le(actual_today)
            ].copy()

        reference_today = actual_today
        query_today = actual_today
        expenses = frame[frame["_kind"].eq("expense")].copy() if not frame.empty else frame
        incomes = frame[frame["_kind"].eq("income")].copy() if not frame.empty else frame

        contextual_savings_result = cls._contextual_savings_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            reference_today=query_today,
        )
        if contextual_savings_result is not None:
            return contextual_savings_result

        contextual_summary_result = cls._contextual_summary_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            reference_today=query_today,
        )
        if contextual_summary_result is not None:
            return contextual_summary_result

        contextual_year_result = cls._contextual_year_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            reference_today=query_today,
        )
        if contextual_year_result is not None:
            return contextual_year_result

        contextual_expense_rank_result = cls._contextual_expense_ranking_follow_up(
            q,
            previous_answer,
            expenses=expenses,
        )
        if contextual_expense_rank_result is not None:
            return contextual_expense_rank_result

        contextual_category_result = cls._contextual_category_ranking_follow_up(
            q,
            previous_answer,
            expenses=expenses,
        )
        if contextual_category_result is not None:
            return contextual_category_result

        contextual_movement_result = cls._contextual_movement_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            frame=frame,
            reference_today=query_today,
        )
        if contextual_movement_result is not None:
            return contextual_movement_result

        contextual_result = cls._contextual_date_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            frame=frame,
            reference_today=query_today,
        )
        if contextual_result is not None:
            return contextual_result

        contextual_month_result = cls._contextual_month_follow_up(
            q,
            previous_answer,
            expenses=expenses,
            incomes=incomes,
            frame=frame,
            reference_today=query_today,
        )
        if contextual_month_result is not None:
            return contextual_month_result

        # Las expresiones “mes pasado” y “mes anterior” se interpretan contra
        # el calendario real. Si no hubo gastos, se informa el último gasto
        # disponible en lugar de trasladar silenciosamente la consulta al mes
        # anterior del dataset histórico.
        if (
            cls._has(q, "mes pasado", "mes anterior")
            and cls._has(q, "cuanto gaste", "cuanto gasto", "total de gastos", "gastos del mes pasado")
        ):
            return cls._previous_calendar_month_expense_summary(expenses, actual_today)

        def finalize(result: TransactionQueryResult | None) -> TransactionQueryResult | None:
            return cls._apply_dataset_reference(
                result, q, actual_today=actual_today, reference_today=reference_today
            )

        # Experiencias integrales.
        if cls._has(q, "que deberia hacer hoy", "que hago hoy", "que me recomendas hoy", "que me recomiendas hoy", "prioridades de hoy"):
            return cls._result(cls._today_actions(expenses, incomes, analysis, user_name, query_today), "today_actions")

        if cls._has(q, "como estuvieron mis finanzas", "contame como estuvieron mis finanzas", "resumen de este mes", "balance de este mes", "como cerre este mes", "como voy este mes"):
            return cls._result(cls._monthly_overview(expenses, incomes, analysis, user_name, query_today), "monthly_overview")

        if cls._has(q, "si sigo asi", "como terminare el mes", "como voy a terminar el mes", "proyeccion del mes", "prediccion del mes", "cuanto voy a gastar este mes"):
            return cls._result(cls._month_projection(expenses, incomes, query_today), "month_projection")

        if cls._has(
            q,
            "gasto inusual", "gastos inusuales", "compra inusual", "anomalia",
            "movimiento raro", "fuera de lo normal", "gasto raro",
            "algo raro en mis gastos", "gasto que te parezca fuera de lo normal",
        ):
            return cls._result(cls._anomalies(expenses), "expense_anomalies")

        result = cls._movement_query(q, frame, query_today)
        if result:
            return finalize(result)

        result = cls._expense_query(q, expenses, query_today)
        if result:
            return finalize(result)

        result = cls._income_query(q, incomes, query_today)
        if result:
            return finalize(result)

        result = cls._savings_query(q, expenses, incomes, query_today)
        if result:
            return finalize(result)

        result = cls._statistics_query(q, expenses, incomes, query_today)
        if result:
            return finalize(result)

        result = cls._analysis_query(q, expenses, incomes, analysis, query_today)
        if result:
            return finalize(result)

        return None

    @classmethod
    def is_contextual_date_follow_up(
        cls, question: str, previous_answer: str | None
    ) -> bool:
        if not previous_answer:
            return False
        q = QueryNormalizer.normalize(question)
        return cls._contextual_date_direction(q) != 0

    @classmethod
    def is_contextual_month_follow_up(
        cls, question: str, previous_answer: str | None
    ) -> bool:
        if not previous_answer:
            return False
        q = QueryNormalizer.normalize(question)
        if cls._extract_requested_month(q, date.today()) is not None:
            return True
        return cls._has(
            q,
            "mes pasado",
            "mes anterior",
            "el anterior",
            "mes siguiente",
            "el siguiente",
        )

    @classmethod
    def _contextual_savings_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        """Amplía un ahorro transaccional sin mezclarlo con métricas promedio.

        Si la respuesta anterior fue un cálculo explícito del ahorro de este mes
        o de este año, un follow-up como "Explícame más" conserva ese período y
        vuelve a usar únicamente los movimientos reales del mismo período.
        """
        if not previous_answer or not cls._has(
            q,
            "explicame mas",
            "explica mas",
            "amplia",
            "ampliame",
            "quiero mas detalle",
            "dame mas detalle",
        ):
            return None

        previous = QueryNormalizer.normalize(previous_answer)

        if cls._has(
            previous,
            "tu ahorro este mes fue",
            "este mes ahorraste",
            "este mes no tuviste ahorro",
        ):
            period = "month"
            label = "este mes"
        elif cls._has(
            previous,
            "tu ahorro este ano fue",
            "este ano ahorraste",
            "este ano no tuviste ahorro",
        ):
            period = "year"
            label = "este año"
        else:
            return None

        selected_incomes = cls._period_frame(
            incomes,
            period,
            reference_today,
        )
        selected_expenses = cls._period_frame(
            expenses,
            period,
            reference_today,
        )

        income = float(selected_incomes["monto"].sum())
        expense = float(selected_expenses["monto"].sum())
        balance = income - expense

        if income > 0:
            rate = balance / income * 100
            rate_text = f" Eso equivale al {rate:.1f}% de tus ingresos del período."
        else:
            rate_text = ""

        if balance >= 0:
            interpretation = (
                "En ese período tus ingresos superaron a tus gastos, "
                "por lo que el balance de ahorro fue positivo."
            )
        else:
            interpretation = (
                "En ese período tus gastos superaron a tus ingresos, "
                f"por lo que tuviste un déficit de {cls._money(abs(balance))}."
            )

        if balance < 0:
            balance_text = (
                f"Tus gastos superaron tus ingresos en {cls._money(abs(balance))}, "
                "por lo que cerraste el período con déficit."
            )
        elif balance > 0:
            balance_text = (
                f"Tus ingresos superaron tus gastos en {cls._money(balance)}, "
                "por lo que cerraste el período con ahorro."
            )
        else:
            balance_text = (
                "Tus ingresos y gastos fueron iguales, por lo que cerraste el período "
                "sin ahorro ni déficit."
            )

        return cls._result(
            (
                f"Tomando únicamente tus movimientos reales de {label}, "
                f"ingresaste {cls._money(income)} y gastaste {cls._money(expense)}. "
                f"{balance_text} "
                "Este resultado corresponde al período consultado y es distinto "
                "de la capacidad de ahorro mensual estimada que muestra el análisis general de FinSightAI."
            ),
            f"contextual_savings_{period}_explanation",
        )

    @classmethod
    def _contextual_summary_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if not previous_answer or not cls._has(
            q,
            "y el total", "el total", "y total", "y la suma",
            "y el promedio", "el promedio", "y la media",
        ):
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        asks_average = cls._has(q, "promedio", "media")
        is_income = cls._has(previous, "ingres", "cobraste", "cobro") and not cls._has(previous, "gasto")
        frame = incomes if is_income else expenses
        noun = "ingresos" if is_income else "gastos"

        # Conserva el período anual cuando la respuesta anterior lo menciona.
        year_match = re.search(r"\b(20\d{2})\b", previous)
        if year_match:
            year = int(year_match.group(1))
            selected = frame[frame["fecha"].dt.year.eq(year)]
            label = f"durante {year}"
        elif cls._has(previous, "este ano", "este año", "durante el ano"):
            selected = frame[frame["fecha"].dt.year.eq(reference_today.year)]
            label = f"durante {reference_today.year}"
        else:
            selected = frame
            label = "en el período registrado"

        if asks_average:
            return cls._result(
                cls._monthly_average(selected, noun),
                f"contextual_{'income' if is_income else 'expense'}_average",
            )

        count = len(selected)
        movement_noun = "movimiento" if count == 1 else "movimientos"
        verb = "Ingresaste" if is_income else "Gastaste"
        return cls._result(
            f"{verb} {cls._money(selected['monto'].sum())} {label} en {count} {movement_noun}.",
            f"contextual_{'income' if is_income else 'expense'}_total",
        )

    @classmethod
    def _contextual_year_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if not previous_answer:
            return None

        direction = 0
        if cls._has(q, "ano anterior", "año anterior", "ano pasado", "año pasado"):
            direction = -1
        elif cls._has(q, "ano siguiente", "año siguiente"):
            direction = 1
        elif re.fullmatch(r"(?:y\s+)?(?:el\s+)?anterior\??", q):
            previous_normalized = QueryNormalizer.normalize(previous_answer)
            context = cls._context_data(previous_answer)
            month_in_previous = cls._contains_month_name(previous_normalized)
            annual_context = (
                context.get("granularity") == "year"
                or (context.get("granularity") not in {"month", "rank"} and (
                    cls._has(previous_normalized, "durante", "ano", "año") or not month_in_previous
                ))
            )
            if re.search(r"\b20\d{2}\b", previous_normalized) and annual_context:
                direction = -1
        elif re.fullmatch(r"(?:y\s+)?(?:el\s+)?siguiente\??", q):
            previous_normalized = QueryNormalizer.normalize(previous_answer)
            context = cls._context_data(previous_answer)
            month_in_previous = cls._contains_month_name(previous_normalized)
            annual_context = (
                context.get("granularity") == "year"
                or (context.get("granularity") not in {"month", "rank"} and (
                    cls._has(previous_normalized, "durante", "ano", "año") or not month_in_previous
                ))
            )
            if re.search(r"\b20\d{2}\b", previous_normalized) and annual_context:
                direction = 1

        explicit_year = cls._extract_requested_year(q)
        if direction == 0 and explicit_year is None:
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        context = cls._context_data(previous_answer)
        year_match = re.findall(r"\b(20\d{2})\b", previous)
        base_year = context.get("year") or (int(year_match[-1]) if year_match else reference_today.year)
        year = explicit_year if explicit_year is not None else base_year + direction

        context_metric = context.get("metric")
        inferred_income = (
            cls._has(previous, "ingresaste", "ingreso", "ingresos", "cobraste", "cobro")
            and not cls._has(previous, "gastaste", "gasto", "gastos")
        )
        inferred_expense = (
            cls._has(previous, "gastaste", "gasto", "gastos")
            and not cls._has(previous, "ingresaste", "ingreso", "ingresos")
        )
        if context_metric not in {"income", "expense"} and not (inferred_income or inferred_expense):
            return cls._result(
                "No pude determinar si te refieres a ingresos o gastos. Indica cuál de los dos quieres consultar.",
                "contextual_year_metric_clarification",
            )
        is_income = context_metric == "income" or (context_metric is None and inferred_income)
        frame = incomes if is_income else expenses
        selected = frame[frame["fecha"].dt.year.eq(year)]
        count = len(selected)
        movement_noun = "movimiento" if count == 1 else "movimientos"
        verb = "Ingresaste" if is_income else "Gastaste"
        return cls._result(
            f"{verb} {cls._money(selected['monto'].sum())} en {year} en {count} {movement_noun}.",
            f"contextual_{'income' if is_income else 'expense'}_year_total",
        )

    @classmethod
    def _contextual_expense_ranking_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
    ) -> TransactionQueryResult | None:
        if not previous_answer or expenses.empty:
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        if "categoria" in previous:
            return None
        if not cls._has(
            previous,
            "tu mayor gasto fue", "mayor gasto", "gasto mas grande",
            "compra mas cara",
        ):
            return None

        ordinal_patterns = {
            1: ("el primero", "la primera", "primero"),
            2: ("el segundo", "la segunda", "segundo", "segunda"),
            3: ("el tercero", "la tercera", "tercero", "tercera"),
            4: ("el cuarto", "la cuarta", "cuarto", "cuarta"),
            5: ("el quinto", "la quinta", "quinto", "quinta"),
        }
        position = next(
            (pos for pos, markers in ordinal_patterns.items() if cls._has(q, *markers)),
            None,
        )
        if position is None:
            return None
        return cls._result(
            cls._expense_position(expenses, position),
            f"contextual_expense_position_{position}",
        )

    @classmethod
    def _contextual_category_ranking_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
    ) -> TransactionQueryResult | None:
        if not previous_answer:
            return None
        previous = QueryNormalizer.normalize(previous_answer)
        context = cls._context_data(previous_answer)
        if not (
            context.get("granularity") == "rank"
            or cls._has(previous, "categoria en la que mas gastaste", "categoria numero", "categoria con mas gastos")
            or (cls._has(previous, "categoria") and cls._has(previous, "gastaste", "gasto"))
        ):
            return None

        # Un follow-up explicativo debe conservar EXACTAMENTE el dato mostrado
        # en la respuesta anterior. No vuelve a sumar `expenses`, porque esa
        # colección puede representar una ventana distinta de la usada por el
        # responder que produjo la respuesta base.
        if cls._has(
            q,
            "explicame mas", "explica mas", "amplia", "ampliame",
            "quiero mas detalle", "dame mas detalle", "mas detalles",
            "contame mas", "cuentame mas", "quiero saber mas",
        ):
            clean_previous = re.sub(
                r"\s*<!--\s*finsi-financial-context.*?-->\s*$",
                "",
                previous_answer,
                flags=re.IGNORECASE | re.DOTALL,
            ).strip()
            match = re.search(
                r"(?:categor[ií]a\s+(?:en\s+la\s+que\s+m[aá]s\s+gastaste|con\s+mayor\s+gasto(?:\s+acumulado)?|con\s+m[aá]s\s+gastos?)\s+(?:fue|es)\s+)([^,.;]+).*?(\$[\d.]+(?:,[\d]{2})?)",
                clean_previous,
                flags=re.IGNORECASE | re.DOTALL,
            )
            if match:
                category = match.group(1).strip(" *")
                amount = match.group(2)
                return cls._result(
                    (
                        f"Tu categoría con mayor gasto es **{category}**, con **{amount}**. "
                        "Ese monto corresponde al mismo período y conjunto de movimientos usados en la respuesta anterior. "
                        "Representa la suma de los gastos clasificados en esa categoría, no una única compra."
                    ),
                    "contextual_expense_category_explanation",
                )

            # Si por algún cambio de copy no puede extraerse el dato anterior,
            # no recalcula con otra ventana: deja que continúe el routing normal.
            return None

        ordinal_patterns = {
            1: ("la primera", "el primero", "primera categoria", "numero 1"),
            2: ("la segunda", "el segundo", "segunda categoria", "numero 2"),
            3: ("la tercera", "el tercero", "tercera categoria", "numero 3"),
            4: ("la cuarta", "el cuarto", "cuarta categoria", "numero 4"),
            5: ("la quinta", "el quinto", "quinta categoria", "numero 5"),
        }
        position = next(
            (pos for pos, markers in ordinal_patterns.items() if cls._has(q, *markers)),
            None,
        )
        if position is None:
            return None
        return cls._result(
            cls._category_position(expenses, position),
            f"contextual_expense_category_position_{position}",
        )

    @classmethod
    def _contextual_movement_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        frame: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if not previous_answer or not cls._has(
            q,
            "que movimiento fue ese",
            "que movimiento fue esa",
            "cual fue ese movimiento",
            "que compra fue esa",
            "que gastos fueron esos",
            "que compre ese dia",
            "en que gaste ese dia",
        ):
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        base_date = cls._date_from_previous_answer(previous, reference_today)
        if base_date is None:
            return cls._result(
                "No pude identificar la fecha de la respuesta anterior. Preguntame por una fecha concreta.",
                "contextual_movement_date_missing",
            )

        if cls._has(previous, "ingresaste", "ingreso", "cobraste", "cobro"):
            selected = incomes[incomes["fecha"].dt.date.eq(base_date)]
            return cls._result(
                cls._income_detail_for_period(
                    selected,
                    incomes,
                    f"el {base_date.strftime('%d/%m/%Y')}",
                ),
                "contextual_income_movements",
            )

        selected = expenses[expenses["fecha"].dt.date.eq(base_date)]
        return cls._result(
            cls._expense_detail_for_period(
                selected,
                expenses,
                f"el {base_date.strftime('%d/%m/%Y')}",
            ),
            "contextual_expense_movements",
        )

    @classmethod
    def _contextual_month_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        frame: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if not previous_answer:
            return None

        # Una consulta explícita sobre el último gasto/compra debe resolverse
        # por _expense_query, no heredando el total de la respuesta anterior.
        if cls._has(
            q,
            "ultimo gasto",
            "gasto mas reciente",
            "ultima compra",
        ):
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        context = cls._context_data(previous_answer)
        requested = cls._extract_requested_month(q, reference_today)

        if requested is None:
            previous_month = (
                (context.get("year"), context.get("month"))
                if context.get("granularity") == "month" and context.get("year") and context.get("month")
                else cls._extract_requested_month(previous, reference_today)
            )
            if cls._has(q, "mes pasado", "mes anterior", "el anterior"):
                requested = (
                    cls._shift_month(previous_month[0], previous_month[1], -1)
                    if previous_month is not None
                    else cls._shift_month(reference_today.year, reference_today.month, -1)
                )
            elif cls._has(q, "mes siguiente", "el siguiente"):
                requested = (
                    cls._shift_month(previous_month[0], previous_month[1], 1)
                    if previous_month is not None
                    else cls._shift_month(reference_today.year, reference_today.month, 1)
                )

        if requested is None:
            return None

        year, month = requested
        period_name = cls._spanish_month(year, month)

        if cls._has(
            q,
            "eso es de",
            "es de",
            "corresponde a",
            "ese dato es de",
            "esa respuesta es de",
        ):
            month_name = period_name.split()[0]
            same_month = month_name in previous and str(year) in previous
            if same_month:
                return cls._result(
                    f"Sí, la respuesta anterior corresponde a {period_name}.",
                    "contextual_month_confirmation",
                )
            return cls._result(
                f"No. La respuesta anterior no corresponde a {period_name}.",
                "contextual_month_correction",
            )

        if cls._has(previous, "dia que mas gastaste", "día que más gastaste"):
            selected = cls._month_frame(expenses, year, month, reference_today)
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, f"en {period_name}"),
                    "contextual_month_max_day_empty",
                )
            return cls._result(
                f"{cls._max_day(selected, 'gastaste')[:-1]} en {period_name}.",
                "contextual_month_max_day",
            )

        if cls._has(previous, "mayor gasto", "gasto mas grande", "compra mas cara"):
            selected = cls._month_frame(expenses, year, month, reference_today)
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, f"en {period_name}"),
                    "contextual_month_max_expense_empty",
                )
            return cls._result(
                f"{cls._extreme_transaction(selected, True, 'gasto')[:-1]} en {period_name}.",
                "contextual_month_max_expense",
            )

        if cls._has(previous, "categoria", "categoría") and cls._has(previous, "mas", "más"):
            selected = cls._month_frame(expenses, year, month, reference_today)
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, f"en {period_name}"),
                    "contextual_month_top_category_empty",
                )
            return cls._result(
                f"{cls._category_ranking(selected, True)[:-1]} en {period_name}.",
                "contextual_month_top_category",
            )

        if context.get("metric") == "income" or cls._has(previous, "ingresaste", "ingreso", "cobraste", "cobro"):
            selected = cls._month_frame(incomes, year, month, reference_today)
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Ingresaste {cls._money(selected['monto'].sum())} en {period_name} en {count} {noun}.",
                "contextual_month_income_total",
            )

        if context.get("metric") == "expense" or cls._has(previous, "gastaste", "gasto", "compra"):
            selected = cls._month_frame(expenses, year, month, reference_today)
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} en {period_name} en {count} {noun}.",
                "contextual_month_expense_total",
            )

        return None

    @classmethod
    def _contextual_date_follow_up(
        cls,
        q: str,
        previous_answer: str | None,
        *,
        expenses: pd.DataFrame,
        incomes: pd.DataFrame,
        frame: pd.DataFrame,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if not previous_answer:
            return None
        direction = cls._contextual_date_direction(q)
        if direction == 0:
            return None

        previous = QueryNormalizer.normalize(previous_answer)
        base_date = cls._date_from_previous_answer(previous, reference_today)
        if base_date is None:
            return None
        requested_date = base_date + timedelta(days=direction)

        if cls._has(previous, "ingresaste", "ingreso", "cobraste", "cobro"):
            selected = incomes[incomes["fecha"].dt.date.eq(requested_date)]
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Ingresaste {cls._money(selected['monto'].sum())} el {requested_date.strftime('%d/%m/%Y')} en {count} {noun}.",
                "income_specific_date_total",
            )

        if cls._has(previous, "gastaste", "gasto", "compra", "pagaste"):
            selected = expenses[expenses["fecha"].dt.date.eq(requested_date)]
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} el {requested_date.strftime('%d/%m/%Y')} en {count} {noun}.",
                "expenses_specific_date_total",
            )

        selected = frame[frame["fecha"].dt.date.eq(requested_date)]
        return cls._result(
            cls._movement_summary(selected, f"el {requested_date.strftime('%d/%m/%Y')}") ,
            "movements_specific_date_contextual",
        )

    @staticmethod
    def _contextual_date_direction(q: str) -> int:
        previous_markers = (
            "dia anterior", "anterior a ese", "un dia antes", "dia antes",
            "el anterior", "y anterior",
        )
        next_markers = (
            "dia siguiente", "siguiente a ese", "un dia despues",
            "dia despues", "el siguiente",
        )
        if any(marker in q for marker in previous_markers):
            return -1
        if any(marker in q for marker in next_markers):
            return 1
        return 0

    @staticmethod
    def _date_from_previous_answer(previous: str, reference_today: date) -> date | None:
        matches = re.findall(
            r"(?<!\d)(\d{1,2})/(\d{1,2})/(\d{4})(?!\d)", previous
        )
        if matches:
            day, month, year = map(int, matches[-1])
            try:
                return date(year, month, day)
            except ValueError:
                return None
        if "anteayer" in previous:
            return reference_today - timedelta(days=2)
        if re.search(r"\bayer\b", previous):
            return reference_today - timedelta(days=1)
        if re.search(r"\bhoy\b", previous):
            return reference_today
        return None

    # ------------------------------------------------------------------
    # GASTOS
    # ------------------------------------------------------------------
    @classmethod
    def _expense_query(cls, q: str, expenses: pd.DataFrame, today: date) -> TransactionQueryResult | None:
        if expenses.empty or not cls._has(
            q, "gasto", "gastos", "gaste", "gastando", "compra", "compras", "consumo",
            "egreso", "categoria", "subcategoria", "subcategorias", "medio de pago",
            "compre", "compré", "plata", "dinero", "pesa", "peso",
        ):
            return None

        # Comparación relativa explícita entre el mes actual y el anterior.
        # Se reconoce estructuralmente y se resuelve antes de cualquier ranking
        # histórico para evitar que "este mes gasté más que el anterior" sea
        # confundido con "¿en qué mes gasté más?".
        relative_month_comparison = bool(
            re.search(
                r"\b(?:este\s+mes\s+(?:gaste|gasto|estoy\s+gastando)\s+(?:mas|menos)|"
                r"(?:gaste|gasto)\s+(?:mas|menos)\s+este\s+mes)\b"
                r".*\b(?:que|vs|versus)\s+(?:el\s+)?(?:mes\s+)?(?:anterior|pasado)\b",
                q,
            )
        )
        if relative_month_comparison:
            return cls._result(
                cls._compare_months(expenses, today, "gastos"),
                "expenses_month_comparison",
            )

        # Comparación directa entre dos meses explícitos.
        # Ej.: "¿Gasté más en julio o en agosto?"
        month_names = {
            "enero": 1,
            "febrero": 2,
            "marzo": 3,
            "abril": 4,
            "mayo": 5,
            "junio": 6,
            "julio": 7,
            "agosto": 8,
            "septiembre": 9,
            "setiembre": 9,
            "octubre": 10,
            "noviembre": 11,
            "diciembre": 12,
        }
        mentioned_months = re.findall(
            r"\b(" + "|".join(month_names) + r")\b",
            q,
        )

        if (
            len(mentioned_months) >= 2
            and cls._has(
                q,
                "gaste mas",
                "gasto mas",
                "compare",
                "comparar",
                "comparacion",
                "vs",
            )
        ):
            first_name = mentioned_months[0]
            second_name = mentioned_months[1]
            first_month = month_names[first_name]
            second_month = month_names[second_name]

            explicit_years = [
                int(value)
                for value in re.findall(r"\b(20\d{2})\b", q)
            ]

            if len(explicit_years) >= 2:
                first_year = explicit_years[0]
                second_year = explicit_years[1]
            elif len(explicit_years) == 1:
                first_year = explicit_years[0]
                second_year = explicit_years[0]
            else:
                first_year = today.year
                second_year = today.year

            first = cls._month_frame(
                expenses,
                first_year,
                first_month,
                today,
            )
            second = cls._month_frame(
                expenses,
                second_year,
                second_month,
                today,
            )

            first_total = float(first["monto"].sum())
            second_total = float(second["monto"].sum())

            first_label = cls._spanish_month(
                first_year,
                first_month,
            )
            second_label = cls._spanish_month(
                second_year,
                second_month,
            )

            if first_total > second_total:
                conclusion = f"Gastaste más en {first_label}."
            elif second_total > first_total:
                conclusion = f"Gastaste más en {second_label}."
            else:
                conclusion = (
                    "Gastaste lo mismo en ambos meses."
                )

            return cls._result(
                (
                    f"En {first_label} gastaste "
                    f"{cls._money(first_total)} y en "
                    f"{second_label} gastaste "
                    f"{cls._money(second_total)}. "
                    f"{conclusion}"
                ),
                "expenses_two_months_comparison",
            )

        requested_year = cls._extract_requested_year(q)
        if requested_year is not None and cls._has(
            q,
            "cuanto gaste", "cuanto gasto", "total de gastos", "gastos en", "gaste en",
        ):
            selected = expenses[expenses["fecha"].dt.year.eq(requested_year)]
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} en {requested_year} en {count} {noun}.",
                "expenses_specific_year_total",
            )

        requested_date = cls._extract_requested_date(q, today)
        if requested_date and cls._has(q, "que gaste", "en que gaste", "que compre", "que compré", "gastos tuve", "compras hice"):
            selected = expenses[expenses["fecha"].dt.date.eq(requested_date)]
            label = f"el {requested_date.strftime('%d/%m/%Y')}"
            return cls._result(
                cls._expense_detail_for_period(selected, expenses, label),
                "expenses_specific_date_detail",
            )

        requested_month = cls._extract_requested_month(q, today)
        asks_latest_expense = cls._has(
            q,
            "gasto mas reciente",
            "ultima compra",
            "ultimo gasto",
        )

        if requested_month and not asks_latest_expense and cls._has(
            q,
            "cuanto fue mi gasto",
            "cuanto fue el gasto",
            "cuanto gaste en",
            "cuanto gasto en",
            "gastos en",
            "gasto en",
        ):
            year, month = requested_month
            selected = cls._month_frame(expenses, year, month, today)
            period_name = cls._spanish_month(year, month)
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} en {period_name} en {count} {noun}.",
                "expenses_specific_month_total",
            )

        if cls._has(q, "promedio por mes", "promedio mensual de gastos", "gasto promedio por mes"):
            return cls._result(cls._monthly_average(expenses, "gastos"), "expenses_monthly_average")

        if cls._has(q, "gasto por dia", "gasto diario", "promedio por dia"):
            return cls._result(cls._daily_average(expenses, "gasto"), "expenses_daily_average")

        if cls._has(q, "dia hice mas compras", "dia con mas compras", "dia tuve mas compras", "cuando hice mas compras"):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(cls._no_expenses_for_period(expenses, period_label), "expenses_most_purchases_day_empty")
            content = cls._day_most_transactions(selected)
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_most_purchases_day")

        if cls._has(
            q,
            "dia que mas",
            "dia tuve mas",
            "dia gaste mas",
            "dia que gaste mas",
            "que dia gaste mas",
            "fecha con mas",
            "cuando gaste mas",
        ):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, period_label),
                    "expenses_max_day_empty",
                )
            content = cls._max_day(selected, "gastaste")
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_max_day")

        if cls._has(q, "dia que menos", "dia gaste menos", "fecha con menos", "cuando gaste menos"):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, period_label),
                    "expenses_min_day_empty",
                )
            content = cls._min_day(selected, "gastaste")
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_min_day")

        if cls._has(
            q,
            "en que gaste",
            "en que gasté",
            "que gaste ayer",
            "que gasté ayer",
            "que compre",
            "que compré",
            "gastos de ayer",
            "gaste ayer",
            "gasté ayer",
            "que gaste hoy",
            "que gaste esta semana",
            "que gaste este mes",
            "que gaste el mes pasado",
            "compras de hoy",
            "compras de ayer",
        ) and cls._explicit_period(q):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            return cls._result(
                cls._expense_detail_for_period(selected, expenses, period_label),
                "expenses_period_detail",
            )

        if cls._has(q, "dia de la semana") and cls._has(q, "mas"):
            return cls._result(cls._weekday_ranking(expenses, True), "expenses_top_weekday")

        if cls._has(q, "dia de la semana") and cls._has(q, "menos"):
            return cls._result(cls._weekday_ranking(expenses, False), "expenses_bottom_weekday")


        if cls._has(q, "compra mas cara", "gasto mas grande", "mayor gasto", "gasto individual mas"):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(cls._no_expenses_for_period(expenses, period_label), "expenses_max_transaction_empty")
            content = cls._extreme_transaction(selected, True, "gasto")
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_max_transaction")

        if cls._has(q, "compra mas barata", "gasto mas chico", "menor gasto"):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(cls._no_expenses_for_period(expenses, period_label), "expenses_min_transaction_empty")
            content = cls._extreme_transaction(selected, False, "gasto")
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_min_transaction")

        if cls._has(q, "gasto mas reciente", "ultima compra", "ultimo gasto"):
            selected = expenses

            requested_month = cls._extract_requested_month(q, today)
            if requested_month is not None:
                year, month = requested_month
                selected = cls._month_frame(
                    expenses,
                    year,
                    month,
                    today,
                )

            return cls._result(
                cls._latest_transaction(selected, "gasto"),
                "expenses_latest",
            )

        # Comparación entre dos categorías explícitas, por ejemplo
        # "¿gasto más en comida o en transporte?".
        categories = cls._extract_categories(q, expenses)
        if len(categories) >= 2 and cls._has(q, "gasto mas", "gaste mas", "mas en", "compar", " vs ", " o "):
            return cls._result(
                cls._compare_categories(expenses, categories[0], categories[1]),
                "expenses_category_comparison",
            )

        # Ranking de subcategorías global o dentro de una categoría.
        if cls._has(q, "subcategoria", "subcategorias") and cls._has(
            q, "mas", "mayor", "principal", "gastando", "gasto", "gaste"
        ):
            category = cls._extract_category(q, expenses)
            selected = expenses
            if category:
                selected = expenses[
                    expenses["categoria"].str.casefold().eq(category.casefold())
                ]
            return cls._result(
                cls._subcategory_ranking(selected, category=category),
                "expenses_top_subcategory",
            )

        # "Dentro de Transporte, ¿en qué estoy gastando más?"
        category = cls._extract_category(q, expenses)
        if category and cls._has(
            q,
            "dentro de",
            "en que estoy gastando mas",
            "en que gasto mas",
            "en que gaste mas",
            "que es lo que mas gasto",
            "que es lo que mas pesa",
            "donde gasto mas",
        ):
            selected = expenses[
                expenses["categoria"].str.casefold().eq(category.casefold())
            ]
            if "subcategoria" in selected.columns and selected["subcategoria"].fillna("").str.strip().ne("").any():
                return cls._result(
                    cls._subcategory_ranking(selected, category=category),
                    "expenses_top_subcategory_in_category",
                )

        if cls._has(q, "segunda categoria", "segunda categoría") and cls._has(q, "mas gastos", "gasto mas"):
            return cls._result(cls._category_position(expenses, 2), "expenses_second_category")

        if cls._has(
            q,
            "en que categorias gasto mas",
            "en que categorias estoy gastando mas",
            "que categorias deberia revisar",
            "que categorias deberia revisar primero",
            "cuales categorias deberia revisar",
            "cuales son las categorias que deberia revisar",
            "que categorias me conviene revisar",
            "cuales son mis categorias con mas gastos",
            "cuales son mis principales categorias de gasto",
            "que categorias tienen mas gasto",
            "que categorias pesan mas",
            "donde se concentran mis gastos",
            "principales categorias de gasto",
            "principales categorias de gastos",
        ):
            selected, period_label = cls._selected_expenses_for_period(
                expenses,
                q,
                today,
            )
            if selected.empty:
                return cls._result(
                    cls._no_expenses_for_period(expenses, period_label),
                    "expenses_top_categories_empty",
                )

            content = cls._top_categories_ranking(selected, limit=3)
            if cls._explicit_period(q):
                content = f"{content}\n\nPeríodo analizado: {period_label}."

            return cls._result(
                content,
                "expenses_top_categories",
            )

        if cls._has(
            q,
            "categoria con mas",
            "en que categoria gasto mas",
            "en que categoria gaste mas",
            "donde gasto mas",
            "donde gaste mas",
            "en que gasto mas",
            "en que gaste mas",
            "cual es la categoria en la que mas gasto",
            "cual es la categoria donde mas gasto",
            "en que se me esta yendo toda la plata",
            "en que se me esta yendo la plata",
            "donde se me va la plata",
        ):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(cls._no_expenses_for_period(expenses, period_label), "expenses_top_category_empty")
            content = cls._category_ranking(selected, True)
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_top_category")

        if cls._has(q, "categoria con menos", "en que categoria gasto menos"):
            selected, period_label = cls._selected_expenses_for_period(expenses, q, today)
            if selected.empty:
                return cls._result(cls._no_expenses_for_period(expenses, period_label), "expenses_bottom_category_empty")
            content = cls._category_ranking(selected, False)
            if cls._explicit_period(q):
                content = f"{content[:-1]} {period_label}."
            return cls._result(content, "expenses_bottom_category")

        if cls._has(q, "categoria aumento mas", "categoria aumentó mas", "categoria subio mas"):
            return cls._result(cls._category_month_delta(expenses, today, True), "expenses_category_biggest_increase")

        if cls._has(q, "categoria reduje mas", "categoria bajo mas", "categoria disminuyo mas"):
            return cls._result(cls._category_month_delta(expenses, today, False), "expenses_category_biggest_decrease")

        if cls._has(q, "medio de pago", "forma de pago", "pago mas usado"):
            return cls._result(cls._payment_method(expenses), "expenses_payment_method")

        if cls._has(q, "gastos repetitivos", "gastos recurrentes", "pagos recurrentes"):
            if cls._has(q, "cuanto gasto", "total"):
                recurring = expenses[expenses["recurrente"]]
                return cls._result(f"Tus gastos recurrentes suman {cls._money(recurring['monto'].sum())} en el período registrado.", "expenses_recurring_total")
            return cls._result(cls._recurring(expenses), "expenses_recurring")

        if cls._has(q, "gaste mas ayer que anteayer", "ayer que anteayer", "comparar ayer con anteayer"):
            yesterday = cls._period_frame(expenses, "yesterday", today)["monto"].sum()
            before = cls._period_frame(expenses, "day_before_yesterday", today)["monto"].sum()
            return cls._result(cls._comparison_text(float(yesterday), float(before), "gastos", "anteayer"), "expenses_day_comparison")

        if cls._has(q, "esta semana que la pasada", "semana actual que la anterior", "comparar semanas"):
            current = cls._period_frame(expenses, "week", today)["monto"].sum()
            previous = cls._period_frame(expenses, "previous_week", today)["monto"].sum()
            return cls._result(cls._comparison_text(float(current), float(previous), "gastos", "la semana pasada"), "expenses_week_comparison")

        if cls._has(q, "cuantas compras", "cuantos gastos"):
            period, label = cls._select_period(q, today)
            selected = cls._period_frame(expenses, period, today)
            return cls._result(f"Registraste {len(selected)} gastos {label}.", "expenses_count")

        # Las comparaciones relativas deben evaluarse antes del ranking histórico.
        # Si no, "este mes gasté más que el anterior" contiene "mes gaste mas"
        # y termina respondiendo cuál fue el mes con más gastos de todo el historial.
        if cls._has(
            q,
            "este mes que el anterior",
            "este mes que el mes anterior",
            "este mes que el mes pasado",
            "este mes gaste mas que el anterior",
            "este mes gaste mas que el mes anterior",
            "este mes gaste mas que el mes pasado",
            "gaste mas este mes que el anterior",
            "gaste mas este mes que el mes anterior",
            "gaste mas este mes que el mes pasado",
            "estoy gastando mas este mes que el anterior",
            "estoy gastando mas este mes que el mes pasado",
            "este mes vs el anterior",
            "este mes vs el mes anterior",
            "este mes vs el mes pasado",
            "comparar este mes",
            "compara este mes",
            "comparar mis gastos de este mes",
            "compara mis gastos de este mes",
            "gastando mas que el mes pasado",
            "gastos aumentaron este mes",
            "gastos bajaron este mes",
            "gastos disminuyeron este mes",
            "cuanto mas gaste este mes",
            "cuanto menos gaste este mes",
        ):
            return cls._result(cls._compare_months(expenses, today, "gastos"), "expenses_month_comparison")

        if cls._has(
            q,
            "mes con mas gastos",
            "mes gaste mas",
            "mes en que mas gaste",
            "mes donde mas gaste",
            "cual fue el mes en que mas gaste",
            "cual fue el mes que mas gaste",
            "en que mes gaste mas",
        ):
            return cls._result(cls._extreme_month(expenses, True, "gastaste"), "expenses_max_month")

        if cls._has(
            q,
            "mes con menos gastos",
            "mes gaste menos",
            "mes en que menos gaste",
            "mes donde menos gaste",
            "cual fue el mes en que menos gaste",
            "cual fue el mes que menos gaste",
            "en que mes gaste menos",
        ):
            return cls._result(cls._extreme_month(expenses, False, "gastaste"), "expenses_min_month")

        if cls._has(q, "este ano que el pasado", "este año que el pasado", "este ano vs", "este año vs"):
            return cls._result(cls._compare_years(expenses, today, "gastos"), "expenses_year_comparison")

        category = cls._extract_category(q, expenses)
        if category and cls._has(q, "cuanto gaste", "cuanto gasto"):
            selected = expenses[expenses["categoria"].str.casefold().eq(category.casefold())]
            period, label = cls._select_period(q, today)
            if cls._explicit_period(q):
                selected = cls._period_frame(selected, period, today)
            return cls._result(f"Gastaste {cls._money(selected['monto'].sum())} en {category} {label if cls._explicit_period(q) else 'en el período registrado'}.", "expenses_category_total")

        if cls._has(
            q,
            "cuanto gaste", "total de gastos", "suma total de mis gastos",
            "suma total de gastos", "total gastado", "gastos de hoy",
            "gastos esta semana", "gastos este mes", "gastos este ano",
            "gastos de este ano", "gaste hoy",
        ):
            period, label = cls._select_period(q, today)
            selected = cls._period_frame(expenses, period, today)
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} {label} en {count} {noun}.",
                f"expenses_total_{period}",
            )

        return None

    # ------------------------------------------------------------------
    # INGRESOS
    # ------------------------------------------------------------------
    @classmethod
    def _income_query(cls, q: str, incomes: pd.DataFrame, today: date) -> TransactionQueryResult | None:
        if incomes.empty or not cls._has(q, "ingreso", "ingresos", "ingrese", "gane", "cobre", "sueldo", "salario"):
            return None

        requested_year = cls._extract_requested_year(q)
        if requested_year is not None and cls._has(
            q,
            "cuanto ingrese", "total de ingresos", "ingresos en", "ingrese en",
        ):
            selected = incomes[incomes["fecha"].dt.year.eq(requested_year)]
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Ingresaste {cls._money(selected['monto'].sum())} en {requested_year} en {count} {noun}.",
                "income_specific_year_total",
            )

        requested_month = cls._extract_requested_month(q, today)
        if requested_month is not None and cls._has(
            q,
            "cuanto ingrese en", "cuanto ingreso en", "ingresos en",
        ):
            year, month = requested_month
            selected = cls._month_frame(incomes, year, month, today)
            period_name = cls._spanish_month(year, month)
            count = len(selected)
            noun = "movimiento" if count == 1 else "movimientos"
            return cls._result(
                f"Ingresaste {cls._money(selected['monto'].sum())} en {period_name} en {count} {noun}.",
                "income_specific_month_total",
            )

        # El dataset no distingue de forma confiable sueldo frente a trabajos extra.
        if cls._has(
            q,
            "trabajos extra",
            "ingresos extra",
            "ingreso extra",
            "porcentaje representa mi sueldo",
            "porcentaje es mi sueldo",
        ):
            return None

        if cls._has(q, "mayor ingreso", "ingreso mas grande"):
            period, label = cls._select_period(q, today)
            selected = cls._period_frame(incomes, period, today) if cls._explicit_period(q) else incomes
            if selected.empty:
                return cls._result(f"No tuviste ingresos registrados {label}.", "income_max_transaction_empty")
            content = cls._extreme_transaction(selected, True, "ingreso")
            if cls._explicit_period(q):
                content = f"{content[:-1]} {label}."
            return cls._result(content, "income_max_transaction")

        if cls._has(q, "ultimo ingreso", "cuando cobre por ultima vez", "cuando cobré por última vez"):
            return cls._result(cls._latest_transaction(incomes, "ingreso"), "income_latest")

        if cls._has(q, "ingreso promedio", "promedio de ingresos"):
            return cls._result(cls._monthly_average(incomes, "ingresos"), "income_average")

        if cls._has(q, "mes tuve mas ingresos", "mes gane mas", "mes con mas ingresos"):
            return cls._result(cls._extreme_month(incomes, True, "ingresaste"), "income_max_month")

        if cls._has(q, "mes tuve menos ingresos", "mes gane menos", "mes con menos ingresos"):
            return cls._result(cls._extreme_month(incomes, False, "ingresaste"), "income_min_month")

        if cls._has(q, "ingresos crecieron", "ingresos aumentaron", "ingresos subieron", "ingresos bajaron"):
            return cls._result(cls._compare_months(incomes, today, "ingresos"), "income_trend")

        if cls._has(q, "ingresos son estables", "estabilidad de mis ingresos"):
            return cls._result(cls._income_stability(incomes), "income_stability")

        if cls._has(q, "principal fuente", "fuente principal"):
            return cls._result(cls._category_ranking(incomes, True, income=True), "income_top_source")



        if cls._has(q, "que ingresos tuve", "en que ingrese", "que cobre", "que cobré") and cls._explicit_period(q):
            period, label = cls._select_period(q, today)
            selected = cls._period_frame(incomes, period, today)
            return cls._result(cls._income_detail_for_period(selected, incomes, label), "income_period_detail")

        if cls._has(q, "cuanto ingrese", "total de ingresos", "ingresos este mes", "ingresos este ano", "ingrese hoy"):
            period, label = cls._select_period(q, today)
            selected = cls._period_frame(incomes, period, today)
            return cls._result(f"Ingresaste {cls._money(selected['monto'].sum())} {label} en {len(selected)} movimientos.", f"income_total_{period}")

        return None

    # ------------------------------------------------------------------
    # AHORRO
    # ------------------------------------------------------------------
    @classmethod
    def _savings_query(cls, q: str, expenses: pd.DataFrame, incomes: pd.DataFrame, today: date) -> TransactionQueryResult | None:
        if not cls._has(q, "ahorro", "ahorre", "ahorrando", "capacidad de ahorro"):
            return None

        balances = cls._monthly_balance(expenses, incomes)
        if balances.empty:
            return cls._result("No hay movimientos suficientes para calcular tu ahorro.", "savings_no_data")

        if cls._has(q, "mes ahorre mas", "mejor mes de ahorro", "mayor ahorro"):
            row = balances.loc[balances["balance"].idxmax()]
            return cls._result(f"Tu mejor mes de ahorro fue {cls._month_name(row['period'])}, con {cls._money(row['balance'])}.", "savings_best_month")

        if cls._has(q, "mes ahorre menos", "peor mes de ahorro", "menor ahorro"):
            row = balances.loc[balances["balance"].idxmin()]
            return cls._result(f"Tu mes con menor ahorro fue {cls._month_name(row['period'])}, con {cls._money(row['balance'])}.", "savings_worst_month")

        if cls._has(q, "ahorrando mas que antes", "ahorrando mas", "ahorro mejorando"):
            return cls._result(cls._compare_balances(balances), "savings_trend")

        if cls._has(q, "porcentaje de mis ingresos ahorro", "porcentaje ahorro"):
            current_income = cls._month_total(incomes, today, 0)
            current_saving = current_income - cls._month_total(expenses, today, 0)
            if current_income <= 0:
                return cls._result("No hay ingresos de este mes para calcular tu porcentaje de ahorro.", "savings_rate")
            rate = current_saving / current_income * 100
            return cls._result(f"Este mes ahorraste el {rate:.1f}% de tus ingresos ({cls._money(current_saving)}).", "savings_rate")

        if cls._has(q, "cuanto estoy ahorrando por mes", "cuanto ahorro por mes", "ahorro mensual", "promedio mensual de ahorro"):
            average = float(balances["balance"].mean())
            return cls._result(
                f"Tu ahorro mensual promedio es {cls._money(average)}, calculado sobre {len(balances)} meses con movimientos.",
                "savings_monthly_average",
            )

        if cls._has(q, "cuanto ahorre", "ahorro este mes", "ahorro este ano"):
            period, label = cls._select_period(q, today)
            income = cls._period_frame(incomes, period, today)["monto"].sum()
            expense = cls._period_frame(expenses, period, today)["monto"].sum()
            balance = float(income - expense)
            if balance < 0:
                content = (
                    f"{label.capitalize()} no tuviste ahorro. "
                    f"Tuviste un déficit de {cls._money(abs(balance))}: "
                    f"ingresaste {cls._money(income)} y gastaste {cls._money(expense)}."
                )
            elif balance > 0:
                content = (
                    f"{label.capitalize()} ahorraste {cls._money(balance)}: "
                    f"ingresaste {cls._money(income)} y gastaste {cls._money(expense)}."
                )
            else:
                content = (
                    f"{label.capitalize()} no tuviste ahorro ni déficit: "
                    f"ingresaste {cls._money(income)} y gastaste {cls._money(expense)}."
                )
            return cls._result(content, f"savings_total_{period}")

        return None


    # ------------------------------------------------------------------
    # ESTADÍSTICAS, FECHAS Y ANÁLISIS
    # ------------------------------------------------------------------
    @classmethod
    def _movement_query(cls, q: str, frame: pd.DataFrame, today: date) -> TransactionQueryResult | None:
        if frame.empty:
            return None

        if cls._has(q, "ultimos cinco movimientos", "ultimas cinco transacciones", "mis ultimos 5 movimientos", "mis ultimas 5 transacciones"):
            return cls._result(cls._latest_movements(frame, 5), "movements_latest_five")

        if cls._has(q, "ultima transaccion", "ultimo movimiento"):
            return cls._result(cls._latest_movements(frame, 1), "movements_latest")

        requested_date = cls._extract_requested_date(q, today)
        if requested_date and cls._has(q, "movimientos", "transacciones", "que hice", "que paso", "qué pasó"):
            selected = frame[frame["fecha"].dt.date.eq(requested_date)]
            label = f"el {requested_date.strftime('%d/%m/%Y')}"
            return cls._result(cls._movement_summary(selected, label), "movements_specific_date")

        if not cls._has(q, "movimientos", "transacciones", "que hice financieramente", "que paso", "como cerre el ano pasado", "que hice hoy", "que hice ayer"):
            return None

        period, label = cls._select_period(q, today)
        selected = cls._period_frame(frame, period, today)
        return cls._result(cls._movement_summary(selected, label), f"movements_{period}")

    @classmethod
    def _statistics_query(cls, q: str, expenses: pd.DataFrame, incomes: pd.DataFrame, today: date) -> TransactionQueryResult | None:
        if not cls._has(q, "mejor mes", "peor mes", "promedio de gastos", "promedio de ingresos", "balance promedio", "mayor deficit", "mayor ahorro"):
            return None
        balances = cls._monthly_balance(expenses, incomes)
        if balances.empty:
            return cls._result("No hay suficientes meses de datos para calcular estadísticas.", "statistics_empty")
        if cls._has(q, "promedio de gastos"):
            return cls._result(f"Tu promedio mensual de gastos es {cls._money(balances['expense'].mean())}.", "stats_expense_average")
        if cls._has(q, "promedio de ingresos"):
            return cls._result(f"Tu promedio mensual de ingresos es {cls._money(balances['income'].mean())}.", "stats_income_average")
        if cls._has(q, "balance promedio"):
            return cls._result(f"Tu balance mensual promedio es {cls._money(balances['balance'].mean())}.", "stats_balance_average")
        if cls._has(q, "mayor deficit"):
            row = balances.loc[balances["balance"].idxmin()]
            return cls._result(f"Tu mayor déficit fue en {cls._month_name(row['period'])}: {cls._money(row['balance'])}.", "stats_max_deficit")
        if cls._has(q, "mayor ahorro"):
            row = balances.loc[balances["balance"].idxmax()]
            return cls._result(f"Tu mayor ahorro fue en {cls._month_name(row['period'])}: {cls._money(row['balance'])}.", "stats_max_saving")
        if cls._has(q, "mejor mes"):
            row = balances.loc[balances["balance"].idxmax()]
            return cls._result(f"Tu mejor mes financiero fue {cls._month_name(row['period'])}, con un balance de {cls._money(row['balance'])}.", "stats_best_month")
        if cls._has(q, "peor mes"):
            row = balances.loc[balances["balance"].idxmin()]
            return cls._result(f"Tu peor mes financiero fue {cls._month_name(row['period'])}, con un balance de {cls._money(row['balance'])}.", "stats_worst_month")
        return None

    @classmethod
    def _analysis_query(cls, q: str, expenses: pd.DataFrame, incomes: pd.DataFrame, analysis: dict[str, Any] | None, today: date) -> TransactionQueryResult | None:
        if not cls._has(
            q,
            "salud financiera", "gastando demasiado", "gastos sostenibles",
            "gastos son sostenibles", "que puedo mejorar", "gastos podria reducir",
            "perdiendo mas dinero", "categoria deberia controlar",
            "viviendo por encima", "tres cosas concretas",
            "mejorar mis finanzas este mes", "por que no llego a fin de mes",
            "no llego a fin de mes",
            # Explicación del perfil y camino de mejora.
            "por que estoy en observacion", "por que estoy en riesgo",
            "que me falta para ser saludable", "como paso a saludable",
            "como salir de riesgo", "que tengo que mejorar para ser saludable",
            # Simulaciones determinísticas.
            "si reduzco", "si redusco", "si reduco",
            "si bajo", "si recorto", "si disminuyo", "si rebajo",
            "cuanto ahorraria", "cuanto ahoraria", "cuanto me ahorraria",
            "cuanto me ahoraria", "cuanto podria ahorrar",
            "ahorrar el 10%", "ahorrar 10%", "ahorrar un 10%",
            "cuanto tengo que reducir", "cuanto tendria que reducir",
            "que categoria deberia reducir primero", "que gasto tendria mayor impacto",
        ):
            return None

        # Para preguntas generales de situación financiera usamos los mismos
        # promedios del análisis vivo que utiliza el resto de Finsi. Así evitamos
        # comparar un mes puntual con métricas promedio y sacar conclusiones falsas.
        metrics = (analysis or {}).get("metricas", {}) if analysis else {}

        try:
            avg_income = float(metrics.get("ingreso_mensual") or 0)
        except (TypeError, ValueError):
            avg_income = 0.0
        try:
            avg_expense = float(
                metrics.get("gasto_mensual_promedio")
                or metrics.get("gasto_mensual")
                or 0
            )
        except (TypeError, ValueError):
            avg_expense = 0.0
        try:
            avg_saving = float(metrics.get("ahorro_mensual_estimado") or 0)
        except (TypeError, ValueError):
            avg_saving = 0.0

        income = avg_income if avg_income > 0 else cls._month_total(incomes, today, 0)
        expense = avg_expense if avg_expense > 0 else cls._month_total(expenses, today, 0)
        saving = avg_saving if analysis else max(income - expense, 0.0)
        ratio = expense / income * 100 if income > 0 else None
        top = cls._top_category_tuple(expenses)

        # Explica el perfil actual usando el análisis vivo del calificador. No intenta
        # reconstruir ni adivinar los umbrales del modelo: muestra el perfil real y las
        # oportunidades de mejora que ya produjo el pipeline financiero.
        if cls._has(
            q,
            "por que estoy en observacion", "por que estoy en riesgo",
            "que me falta para ser saludable", "como paso a saludable",
            "como salir de riesgo", "que tengo que mejorar para ser saludable",
        ):
            if not analysis:
                return cls._result(
                    "Todavía no tengo un análisis financiero disponible para explicarte tu perfil.",
                    "analysis_profile_explanation_empty",
                )

            profile = (
                analysis.get("perfil_financiero")
                or analysis.get("perfilFinanciero")
                or "sin clasificar"
            )
            score = (
                analysis.get("financial_score")
                or analysis.get("score")
                or analysis.get("puntajeFinanciero")
            )
            opportunities = analysis.get("oportunidades_mejora") or analysis.get("oportunidadesMejora") or []
            strengths = analysis.get("fortalezas") or []

            text = f"Tu perfil financiero actual es {profile}"
            if score is not None:
                text += f" y tu score es {score}/100"
            text += "."

            if opportunities:
                clean = [str(item).strip() for item in opportunities if str(item).strip()]
                if clean:
                    text += " Para mejorar tu perfil, el análisis marca como prioridades: " + "; ".join(clean[:3]) + "."
            elif ratio is not None:
                text += f" Tus gastos representan aproximadamente el {ratio:.1f}% de tus ingresos."

            if strengths:
                clean_strengths = [str(item).strip() for item in strengths if str(item).strip()]
                if clean_strengths:
                    text += " Como punto a favor: " + clean_strengths[0] + "."

            return cls._result(text, "analysis_profile_explanation")

        # Simulación: reducir una categoría un porcentaje concreto.
        # Ej.: "Si reduzco entretenimiento un 20%, ¿cuánto ahorraría?"
        if cls._has(
            q,
            "si reduzco", "si redusco", "si reduco",
            "si bajo", "si recorto", "si disminuyo", "si rebajo",
            "cuanto ahorraria", "cuanto ahoraria",
            "cuanto me ahorraria", "cuanto me ahoraria",
            "cuanto podria ahorrar",
        ):
            percent_match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", q)
            category = cls._extract_category(q, expenses)

            if percent_match and not category:
                available_categories = sorted(
                    {
                        str(value).strip()
                        for value in expenses["categoria"].dropna().tolist()
                        if str(value).strip()
                    },
                    key=str.casefold,
                )
                examples = ", ".join(available_categories[:5])
                message = "No encontré esa categoría entre tus gastos registrados."
                if examples:
                    message += f" Podés probar con alguna categoría disponible, por ejemplo: {examples}."
                return cls._result(
                    message,
                    "analysis_category_reduction_category_not_found",
                )

            if percent_match and category:
                percent = float(percent_match.group(1).replace(",", "."))
                if percent < 0 or percent > 100:
                    return cls._result(
                        "El porcentaje de reducción debe estar entre 0% y 100%.",
                        "analysis_category_reduction_invalid",
                    )
                selected = expenses[expenses["categoria"].str.casefold().eq(category.casefold())]
                # Si la pregunta habla de este mes, usamos sólo el mes actual; de lo
                # contrario, respetamos el período explícito o el período registrado.
                if cls._explicit_period(q):
                    period, _ = cls._select_period(q, today)
                    selected = cls._period_frame(selected, period, today)
                total = float(selected["monto"].sum())
                reduction = total * percent / 100.0
                new_total = total - reduction
                return cls._result(
                    f"Si redujeras {category} un {percent:g}%, ahorrarías aproximadamente "
                    f"{cls._money(reduction)} en ese período. El gasto de la categoría "
                    f"bajaría de {cls._money(total)} a {cls._money(new_total)}.",
                    "analysis_category_reduction_simulation",
                )

        # Calcula cuánto hay que recortar para alcanzar una tasa de ahorro objetivo.
        # Ej.: "¿Cuánto tendría que reducir mis gastos para ahorrar el 10% de mis ingresos?"
        target_match = re.search(
            r"(?:ahorr(?:ar|o)|ahor(?:ar|o))[^%]{0,30}?(\d+(?:[.,]\d+)?)\s*%",
            q,
        )
        if target_match and cls._has(q, "cuanto tengo que reducir", "cuanto tendria que reducir", "ahorrar el", "ahorrar un"):
            target_rate = float(target_match.group(1).replace(",", "."))
            if income <= 0:
                return cls._result(
                    "No tengo ingresos suficientes registrados para calcular un objetivo de ahorro.",
                    "analysis_savings_target_no_income",
                )
            if target_rate < 0 or target_rate >= 100:
                return cls._result(
                    "Indicame un porcentaje de ahorro entre 0% y 99%.",
                    "analysis_savings_target_invalid",
                )
            target_saving = income * target_rate / 100.0
            current_saving = income - expense
            needed = target_saving - current_saving
            if needed <= 0:
                return cls._result(
                    f"Con tus valores actuales ya alcanzás al menos un {target_rate:g}% de ahorro: "
                    f"tu margen estimado es {cls._money(current_saving)} por mes.",
                    "analysis_savings_target_already_met",
                )
            target_expense = income - target_saving
            return cls._result(
                f"Para ahorrar el {target_rate:g}% de tus ingresos deberías reservar "
                f"{cls._money(target_saving)} por mes. Con gastos promedio de {cls._money(expense)}, "
                f"necesitarías reducirlos aproximadamente {cls._money(needed)}, hasta unos "
                f"{cls._money(target_expense)} mensuales.",
                "analysis_savings_target",
            )

        if cls._has(
            q,
            "que categoria deberia reducir primero", "que gasto tendria mayor impacto",
            "categoria deberia controlar", "perdiendo mas dinero",
        ) and top:
            category, value = top
            return cls._result(
                f"La categoría con mayor impacto en tus gastos es {category}, con "
                f"{cls._money(value)} acumulados. Es el primer lugar que revisaría, "
                f"priorizando gastos variables o postergables antes que gastos esenciales.",
                "analysis_category_control",
            )

        if cls._has(q, "viviendo por encima", "gastando demasiado", "gastos sostenibles", "gastos son sostenibles"):
            if income <= 0:
                return cls._result(
                    "No hay ingresos suficientes para evaluar si tus gastos son sostenibles.",
                    "analysis_sustainability",
                )
            status = "sí" if expense > income else "no"
            return cls._result(
                f"{status.capitalize()}: tus gastos representan aproximadamente el "
                f"{ratio:.1f}% de tus ingresos ({cls._money(expense)} sobre "
                f"{cls._money(income)}).",
                "analysis_sustainability",
            )

        # Esta consulta necesita una explicación, no una lista genérica de mejoras.
        if cls._has(q, "por que no llego a fin de mes", "no llego a fin de mes"):
            if income <= 0:
                return cls._result(
                    "No tengo ingresos suficientes registrados para explicar por qué no llegas a fin de mes.",
                    "analysis_end_of_month",
                )

            if expense > income:
                deficit = expense - income
                text = (
                    f"Tus gastos promedio superan tus ingresos en "
                    f"{cls._money(deficit)} por mes: gastas aproximadamente "
                    f"{cls._money(expense)} frente a ingresos de {cls._money(income)}."
                )
            else:
                margin = max(income - expense, saving)
                text = (
                    f"Tus gastos no superan tus ingresos, pero consumen aproximadamente "
                    f"el {ratio:.1f}% de ellos. En promedio ingresas "
                    f"{cls._money(income)}, gastas {cls._money(expense)} y te queda un "
                    f"margen de alrededor de {cls._money(margin)} por mes."
                )

            if top:
                text += (
                    f" La categoría con mayor gasto acumulado es {top[0]}, con "
                    f"{cls._money(top[1])}, así que es un buen lugar para revisar "
                    f"si puedes liberar más margen."
                )
            return cls._result(text, "analysis_end_of_month")

        if cls._has(
            q,
            "gastos podria reducir", "que puedo mejorar", "tres cosas concretas",
            "mejorar mis finanzas este mes",
        ):
            lines: list[str] = []

            if top:
                lines.append(
                    f"1. Revisa {top[0]}, tu categoría de mayor gasto "
                    f"({cls._money(top[1])}), y busca al menos un gasto que puedas "
                    f"reducir o postergar este mes."
                )
            else:
                lines.append(
                    "1. Revisa tus gastos de mayor importe y elige uno que puedas reducir o postergar este mes."
                )

            recurring = expenses[expenses["recurrente"]]
            if not recurring.empty:
                lines.append(
                    f"2. Revisa tus gastos recurrentes, que suman "
                    f"{cls._money(recurring['monto'].sum())}, y elimina o renegocia "
                    f"al menos uno que ya no sea prioritario."
                )
            elif ratio is not None:
                lines.append(
                    f"2. Tus gastos consumen el {ratio:.1f}% de tus ingresos; intenta "
                    f"liberar una parte de los gastos variables."
                )
            else:
                lines.append(
                    "2. Separa tus gastos fijos de los variables y recorta primero uno de los variables."
                )

            if saving > 0:
                lines.append(
                    f"3. Separa al menos {cls._money(saving)} al comienzo del mes para "
                    f"ahorro o para tu meta financiera prioritaria, en vez de esperar "
                    f"a ver qué sobra al final."
                )
            elif income > expense and income > 0:
                lines.append(
                    f"3. Reserva el margen mensual de {cls._money(income - expense)} "
                    f"para ahorro o reducción de deuda antes de destinarlo a nuevos gastos."
                )
            else:
                lines.append(
                    "3. Define un monto fijo, aunque sea pequeño, para ahorro o reducción de deuda y trátalo como un gasto obligatorio."
                )

            return cls._result("\n".join(lines[:3]), "analysis_improvements")

        if cls._has(q, "salud financiera"):
            if analysis:
                return cls._result(cls._score_response(analysis, None), "financial_score")
            return cls._result(cls._basic_health(income, expense), "financial_health")
        return None

    # ------------------------------------------------------------------
    # RESPUESTAS INTEGRALES
    # ------------------------------------------------------------------
    @classmethod
    def _monthly_overview(cls, expenses: pd.DataFrame, incomes: pd.DataFrame, analysis: dict[str, Any] | None, user_name: str | None, today: date) -> str:
        income = cls._month_total(incomes, today, 0)
        expense = cls._month_total(expenses, today, 0)
        balance = income - expense
        greeting = f"{user_name}, " if user_name else ""
        top = cls._top_category_tuple(cls._period_frame(expenses, "month", today))
        comparison = cls._compare_months(expenses, today, "gastos")
        text = f"{greeting}este mes ingresaste {cls._money(income)}, gastaste {cls._money(expense)} y tu balance fue {cls._money(balance)}."
        if top:
            text += f" Tu categoría principal fue {top[0]} con {cls._money(top[1])}."
        return text + " " + comparison

    @classmethod
    def _today_actions(cls, expenses: pd.DataFrame, incomes: pd.DataFrame, analysis: dict[str, Any] | None, user_name: str | None, today: date) -> str:
        month_expenses = cls._period_frame(expenses, "month", today)
        income = cls._month_total(incomes, today, 0)
        expense = month_expenses["monto"].sum()
        top = cls._top_category_tuple(month_expenses)
        recurring = month_expenses[month_expenses["recurrente"]]["monto"].sum()
        prefix = f"{user_name}, hoy te recomiendo:" if user_name else "Hoy te recomiendo:"
        actions = []
        if top:
            actions.append(f"Revisar {top[0]}, que concentra {cls._money(top[1])} este mes.")
        if income > 0 and expense / income > 0.8:
            actions.append(f"Frenar gastos no esenciales: ya usaste el {expense / income * 100:.1f}% de tus ingresos.")
        if recurring > 0:
            actions.append(f"Auditar gastos recurrentes por {cls._money(recurring)}.")
        if not actions:
            actions.append("Mantener el ritmo actual y registrar todos tus movimientos.")
        return prefix + "\n" + "\n".join(f"{i}. {item}" for i, item in enumerate(actions[:3], 1))

    @classmethod
    def _month_projection(cls, expenses: pd.DataFrame, incomes: pd.DataFrame, today: date) -> str:
        spent = cls._month_total(expenses, today, 0)
        earned = cls._month_total(incomes, today, 0)
        elapsed = max(1, today.day)
        days = pd.Period(today, freq="M").days_in_month
        projected_expense = spent / elapsed * days
        projected_income = earned / elapsed * days
        return f"Si mantienes el ritmo actual, cerrarías el mes con gastos cercanos a {cls._money(projected_expense)}, ingresos cercanos a {cls._money(projected_income)} y un balance estimado de {cls._money(projected_income - projected_expense)}."

    @classmethod
    def _anomalies(cls, expenses: pd.DataFrame) -> str:
        if len(expenses) < 4:
            return "No hay suficientes gastos para detectar movimientos inusuales con confianza."
        median = float(expenses["monto"].median())
        threshold = max(float(expenses["monto"].quantile(0.90)), median * 2.5)
        unusual = expenses[expenses["monto"].ge(threshold)].sort_values("monto", ascending=False)
        if unusual.empty:
            return "No detecté gastos inusuales en el período registrado."
        lines = ["Detecté estos gastos inusuales:"]
        for _, row in unusual.head(5).iterrows():
            lines.append(f"• {row['descripcion']}: {cls._money(row['monto'])} el {cls._date(row['fecha'])}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # HELPERS DE CÁLCULO
    # ------------------------------------------------------------------
    @classmethod
    def _frame(cls, transactions: list[dict[str, Any]]) -> pd.DataFrame:
        if not transactions:
            return pd.DataFrame(columns=["monto", "fecha", "descripcion", "categoria", "subcategoria", "medio_pago", "recurrente", "_kind", "_search"])
        frame = pd.DataFrame(transactions).copy()
        aliases = {
            "medio_pago": ["medioPago", "medio_pago"],
        }
        for col, default in (("descripcion", "Movimiento"), ("categoria", "Sin categoría"), ("subcategoria", ""), ("recurrente", False), ("tipo", ""), ("monto", 0), ("fecha", None)):
            if col not in frame.columns:
                frame[col] = default
        for canonical, candidates in aliases.items():
            found = next((c for c in candidates if c in frame.columns), None)
            if found:
                frame[canonical] = frame[found]
            elif canonical not in frame.columns:
                frame[canonical] = ""
        frame["monto"] = pd.to_numeric(frame["monto"], errors="coerce").fillna(0.0)
        frame["fecha"] = pd.to_datetime(frame["fecha"], errors="coerce")
        frame["descripcion"] = frame["descripcion"].fillna("Movimiento").astype(str).str.strip()
        frame["categoria"] = frame["categoria"].fillna("Sin categoría").astype(str).str.strip()
        frame["subcategoria"] = frame["subcategoria"].fillna("").astype(str).str.strip()
        frame["medio_pago"] = frame["medio_pago"].fillna("").astype(str).str.strip()
        frame["recurrente"] = frame["recurrente"].apply(cls._bool)
        types = frame["tipo"].fillna("").astype(str).str.strip().str.upper()
        frame["_kind"] = types.apply(lambda v: "expense" if v in cls.EXPENSE_TYPES else "income" if v in cls.INCOME_TYPES else "other")
        frame["_search"] = (frame["descripcion"] + " " + frame["categoria"] + " " + frame["subcategoria"]).str.casefold()
        return frame

    @classmethod
    def _previous_calendar_month_expense_summary(
        cls,
        expenses: pd.DataFrame,
        actual_today: date,
    ) -> TransactionQueryResult:
        year, month = cls._shift_month(actual_today.year, actual_today.month, -1)
        period_name = cls._spanish_month(year, month)

        if expenses.empty:
            return cls._result(
                f"No tuviste gastos registrados en {period_name} y tampoco hay gastos anteriores disponibles.",
                "expenses_total_previous_month_empty",
            )

        selected = expenses[
            expenses["fecha"].dt.year.eq(year)
            & expenses["fecha"].dt.month.eq(month)
        ]

        if not selected.empty:
            return cls._result(
                f"Gastaste {cls._money(selected['monto'].sum())} en {period_name} en {len(selected)} movimientos.",
                "expenses_total_previous_month",
            )

        valid = expenses.dropna(subset=["fecha"])
        if valid.empty:
            return cls._result(
                f"No tuviste gastos registrados en {period_name} y no pude identificar la fecha de tu último gasto.",
                "expenses_total_previous_month_empty",
            )

        latest = valid.sort_values("fecha", ascending=False).iloc[0]
        return cls._result(
            (
                f"No tuviste gastos registrados en {period_name}. "
                f"Tu último gasto fue {cls._money(latest['monto'])} por "
                f"{latest['descripcion']} ({latest['categoria']}) el {cls._date(latest['fecha'])}."
            ),
            "expenses_total_previous_month_empty_with_latest",
        )

    @classmethod
    def _reference_date(cls, frame: pd.DataFrame, actual_today: date) -> date:
        """Usa el calendario real si hay datos actuales; si no, el último día del dataset.

        Los datasets de demo son históricos. Sin este ajuste, consultas como
        "este mes" devolverían cero simplemente porque la fecha del servidor es
        posterior al último movimiento cargado.
        """
        if frame.empty or "fecha" not in frame.columns:
            return actual_today
        valid = frame.dropna(subset=["fecha"])
        if valid.empty:
            return actual_today
        current = valid[
            valid["fecha"].dt.year.eq(actual_today.year)
            & valid["fecha"].dt.month.eq(actual_today.month)
        ]
        if not current.empty:
            return actual_today
        latest = valid["fecha"].max()
        return latest.date()

    @classmethod
    def _apply_dataset_reference(
        cls,
        result: TransactionQueryResult | None,
        q: str,
        *,
        actual_today: date,
        reference_today: date,
    ) -> TransactionQueryResult | None:
        if result is None:
            return None
        if (actual_today.year, actual_today.month) == (reference_today.year, reference_today.month):
            return result

        # La respuesta puede traer una marca de contexto generada antes de
        # reemplazar referencias como "este año" por el año real del dataset.
        # Se elimina temporalmente y se regenera al final con el contenido ya
        # corregido, para que year/month/granularity queden exactos.
        content = cls._CONTEXT_PATTERN.sub("", result.content).strip()
        note: str | None = None
        if "mes pasado" in q or "mes anterior" in q:
            y, m = cls._shift_month(reference_today.year, reference_today.month, -1)
            period = cls._spanish_month(y, m)
            content = content.replace("el mes pasado", f"en {period}")
            note = f"Tomé como referencia {period}, el mes anterior al último período con datos."
        elif "mes" in q or result.action.endswith("_month") or "monthly" in result.action:
            period = cls._spanish_month(reference_today.year, reference_today.month)
            content = content.replace("este mes", f"en {period}")
            note = f"Tomé {period} como referencia porque es el último mes con movimientos disponibles."
        elif "hoy" in q:
            label = reference_today.strftime("%d/%m/%Y")
            content = content.replace("hoy", f"el {label}")
            note = "Usé la última fecha disponible del historial."
        elif "ayer" in q:
            label = (reference_today - timedelta(days=1)).strftime("%d/%m/%Y")
            content = content.replace("ayer", f"el {label}")
            note = "Usé como referencia el día anterior a la última fecha disponible."
        elif "semana" in q:
            start = reference_today - timedelta(days=reference_today.weekday())
            content = content.replace(
                "esta semana",
                f"en la semana del {start.strftime('%d/%m/%Y')} al {reference_today.strftime('%d/%m/%Y')}",
            )
            note = "Usé la última semana con datos disponibles."
        elif "este ano" in q or "este año" in q:
            content = content.replace("este año", f"en {reference_today.year}")
            note = f"Usé {reference_today.year}, el último año con movimientos disponibles."

        if note and note not in content:
            content = f"{content} {note}"

        marker = cls._context_marker(content, result.action)
        return TransactionQueryResult(
            content=f"{content}\n\n{marker}",
            action=result.action,
        )

    @staticmethod
    def _spanish_month(year: int, month: int) -> str:
        names = (
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        )
        return f"{names[month - 1]} de {year}"

    @classmethod
    def _spanish_date(cls, value: date) -> str:
        weekdays = (
            "lunes", "martes", "miércoles", "jueves",
            "viernes", "sábado", "domingo",
        )
        month_name = cls._spanish_month(value.year, value.month).split(" de ")[0]
        return f"{weekdays[value.weekday()]} {value.day} de {month_name} de {value.year}"

    @classmethod
    def _period_frame(cls, frame: pd.DataFrame, period: str, today: date) -> pd.DataFrame:
        if frame.empty:
            return frame
        d = frame["fecha"]
        if period == "today":
            mask = d.dt.date.eq(today)
        elif period == "yesterday":
            mask = d.dt.date.eq(today - timedelta(days=1))
        elif period == "day_before_yesterday":
            mask = d.dt.date.eq(today - timedelta(days=2))
        elif period == "week":
            start = today - timedelta(days=today.weekday())
            mask = d.dt.date.between(start, today)
        elif period == "previous_week":
            current_start = today - timedelta(days=today.weekday())
            start = current_start - timedelta(days=7)
            end = current_start - timedelta(days=1)
            mask = d.dt.date.between(start, end)
        elif period == "year":
            mask = d.dt.year.eq(today.year) & d.dt.date.le(today)
        elif period == "previous_year":
            mask = d.dt.year.eq(today.year - 1)
        elif period == "previous_month":
            y, m = cls._shift_month(today.year, today.month, -1)
            mask = d.dt.year.eq(y) & d.dt.month.eq(m)
        else:
            mask = (
                d.dt.year.eq(today.year)
                & d.dt.month.eq(today.month)
                & d.dt.date.le(today)
            )
        return frame[mask].copy()

    @classmethod
    def _select_period(cls, q: str, today: date) -> tuple[str, str]:
        if "anteayer" in q: return "day_before_yesterday", "anteayer"
        if "hoy" in q: return "today", "hoy"
        if "ayer" in q: return "yesterday", "ayer"
        if "semana pasada" in q or "semana anterior" in q: return "previous_week", "la semana pasada"
        if "semana" in q: return "week", "esta semana"
        if "ano pasado" in q or "año pasado" in q: return "previous_year", "el año pasado"
        if "este ano" in q or "este año" in q: return "year", "este año"
        if "mes pasado" in q or "mes anterior" in q: return "previous_month", "el mes pasado"
        return "month", "este mes"

    @classmethod
    def _explicit_period(cls, q: str) -> bool:
        return (
            any(x in q for x in ("hoy", "ayer", "anteayer", "semana", "mes", "ano", "año"))
            or cls._extract_requested_month(q, date.today()) is not None
        )


    @classmethod
    def _month_frame(
        cls,
        frame: pd.DataFrame,
        year: int,
        month: int,
        today: date,
    ) -> pd.DataFrame:
        """Filtra un mes y excluye movimientos futuros si es el mes actual."""
        selected = frame[
            frame["fecha"].dt.year.eq(year)
            & frame["fecha"].dt.month.eq(month)
        ]
        if (year, month) == (today.year, today.month):
            selected = selected[selected["fecha"].dt.date.le(today)]
        return selected.copy()

    @classmethod
    def _selected_expenses_for_period(
        cls,
        expenses: pd.DataFrame,
        q: str,
        today: date,
    ) -> tuple[pd.DataFrame, str]:
        requested_month = cls._extract_requested_month(q, today)
        if requested_month is not None:
            year, month = requested_month
            selected = cls._month_frame(expenses, year, month, today)
            return selected, f"en {cls._spanish_month(year, month)}"

        if not cls._explicit_period(q):
            return expenses, "en el período registrado"

        period, label = cls._select_period(q, today)
        return cls._period_frame(expenses, period, today), label

    @classmethod
    def _no_expenses_for_period(cls, expenses: pd.DataFrame, period_label: str) -> str:
        if expenses.empty:
            return f"No tienes gastos registrados {period_label}."
        latest = expenses.dropna(subset=["fecha"]).sort_values("fecha", ascending=False)
        if latest.empty:
            return f"No tienes gastos registrados {period_label}."
        row = latest.iloc[0]
        return (
            f"No tuviste gastos registrados {period_label}. "
            f"Tu último gasto fue {cls._money(row['monto'])} por {row['descripcion']} "
            f"({row['categoria']}) el {cls._date(row['fecha'])}."
        )

    @classmethod
    def _expense_detail_for_period(
        cls,
        selected: pd.DataFrame,
        all_expenses: pd.DataFrame,
        period_label: str,
    ) -> str:
        if selected.empty:
            return cls._no_expenses_for_period(all_expenses, period_label)

        ordered = selected.dropna(subset=["fecha"]).sort_values(
            ["fecha", "monto"], ascending=[True, False]
        )
        total = float(ordered["monto"].sum())
        items = []
        for _, row in ordered.head(5).iterrows():
            items.append(
                f"{row['descripcion']} ({row['categoria']}): {cls._money(row['monto'])}"
            )
        extra = len(ordered) - len(items)
        detail = "; ".join(items)
        suffix = f" y {extra} movimientos más" if extra > 0 else ""
        count = len(ordered)
        noun = "movimiento" if count == 1 else "movimientos"
        return (
            f"{period_label.capitalize()} gastaste {cls._money(total)} en "
            f"{count} {noun}: {detail}{suffix}."
        )

    @classmethod
    def _income_detail_for_period(
        cls, selected: pd.DataFrame, all_incomes: pd.DataFrame, period_label: str
    ) -> str:
        if selected.empty:
            if all_incomes.empty:
                return f"No tuviste ingresos registrados {period_label}."
            latest = all_incomes.dropna(subset=["fecha"]).sort_values("fecha", ascending=False).iloc[0]
            return (
                f"No tuviste ingresos registrados {period_label}. "
                f"Tu último ingreso fue {cls._money(latest['monto'])} por {latest['descripcion']} "
                f"el {cls._date(latest['fecha'])}."
            )
        ordered = selected.dropna(subset=["fecha"]).sort_values(["fecha", "monto"], ascending=[True, False])
        items = [f"{row['descripcion']}: {cls._money(row['monto'])}" for _, row in ordered.head(5).iterrows()]
        extra = len(ordered) - len(items)
        suffix = f" y {extra} movimientos más" if extra > 0 else ""
        return (
            f"{period_label.capitalize()} ingresaste {cls._money(ordered['monto'].sum())} en "
            f"{len(ordered)} movimientos: {'; '.join(items)}{suffix}."
        )

    @classmethod
    def _movement_summary(cls, selected: pd.DataFrame, period_label: str) -> str:
        if selected.empty:
            return f"No registraste movimientos {period_label}."
        inc = selected[selected["_kind"].eq("income")]["monto"].sum()
        exp = selected[selected["_kind"].eq("expense")]["monto"].sum()
        ordered = selected.dropna(subset=["fecha"]).sort_values(["fecha", "monto"], ascending=[True, False])
        details = [
            f"{row['descripcion']} ({'ingreso' if row['_kind'] == 'income' else 'gasto'}): {cls._money(row['monto'])}"
            for _, row in ordered.head(5).iterrows()
        ]
        extra = len(ordered) - len(details)
        suffix = f" y {extra} movimientos más" if extra > 0 else ""
        return (
            f"{period_label.capitalize()} registraste {len(selected)} movimientos: ingresos por {cls._money(inc)}, "
            f"gastos por {cls._money(exp)} y un balance de {cls._money(inc - exp)}. "
            f"Detalle: {'; '.join(details)}{suffix}."
        )

    @classmethod
    def _latest_movements(cls, frame: pd.DataFrame, count: int) -> str:
        valid = frame.dropna(subset=["fecha"]).sort_values(["fecha", "monto"], ascending=[False, False]).head(count)
        if valid.empty:
            return "No hay movimientos disponibles."
        if count == 1:
            row = valid.iloc[0]
            kind = "ingreso" if row["_kind"] == "income" else "gasto"
            return f"Tu último movimiento fue un {kind} de {cls._money(row['monto'])} por {row['descripcion']} el {cls._date(row['fecha'])}."
        lines = ["Tus últimos movimientos fueron:"]
        for _, row in valid.iterrows():
            kind = "Ingreso" if row["_kind"] == "income" else "Gasto"
            lines.append(f"• {cls._date(row['fecha'])} — {kind}: {row['descripcion']} — {cls._money(row['monto'])}")
        return "\n".join(lines)

    @classmethod
    def _day_most_transactions(cls, frame: pd.DataFrame) -> str:
        valid = frame.dropna(subset=["fecha"]).copy()
        if valid.empty:
            return "No hay gastos con fecha disponible."
        grouped = valid.groupby(valid["fecha"].dt.date).agg(total=("monto", "sum"), count=("monto", "size"))
        grouped = grouped.sort_values(["count", "total"], ascending=[False, False])
        day = grouped.index[0]
        row = grouped.iloc[0]
        count = int(row["count"])
        noun = "movimiento" if count == 1 else "movimientos"
        return f"El día que hiciste más compras fue el {day.strftime('%d/%m/%Y')}: {count} {noun} por {cls._money(row['total'])}."

    @staticmethod
    def _contains_month_name(text: str) -> bool:
        return any(
            month in text
            for month in (
                "enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "setiembre", "octubre",
                "noviembre", "diciembre",
            )
        )

    @staticmethod
    def _extract_requested_year(q: str) -> int | None:
        match = re.search(r"(?<!\d)(20\d{2})(?!\d)", q)
        return int(match.group(1)) if match else None

    @staticmethod
    def _extract_requested_month(q: str, today: date) -> tuple[int, int] | None:
        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
            "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
            "septiembre": 9, "setiembre": 9, "octubre": 10,
            "noviembre": 11, "diciembre": 12,
        }
        match = re.search(
            r"\b(" + "|".join(months) + r")(?:\s+de)?\s*(\d{4})?\b",
            q,
        )
        if not match:
            return None
        month = months[match.group(1)]
        year = int(match.group(2) or today.year)
        return year, month

    @staticmethod
    def _extract_requested_date(q: str, today: date) -> date | None:
        numeric = re.search(r"(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?!\d)", q)
        if numeric:
            day, month = int(numeric.group(1)), int(numeric.group(2))
            year = int(numeric.group(3)) if numeric.group(3) else today.year
            if year < 100:
                year += 2000
            try:
                return date(year, month, day)
            except ValueError:
                return None
        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
            "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
            "noviembre": 11, "diciembre": 12,
        }
        match = re.search(r"(?:el\s+)?(\d{1,2})\s+de\s+(" + "|".join(months) + r")(?:\s+de\s+(\d{4}))?", q)
        if match:
            day = int(match.group(1)); month = months[match.group(2)]; year = int(match.group(3) or today.year)
            try:
                return date(year, month, day)
            except ValueError:
                return None
        return None

    @classmethod
    def _month_total(cls, frame: pd.DataFrame, today: date, offset: int) -> float:
        y, m = cls._shift_month(today.year, today.month, offset)
        return float(frame[frame["fecha"].dt.year.eq(y) & frame["fecha"].dt.month.eq(m)]["monto"].sum()) if not frame.empty else 0.0

    @classmethod
    def _monthly_balance(cls, expenses: pd.DataFrame, incomes: pd.DataFrame) -> pd.DataFrame:
        series = []
        for name, frame in (("expense", expenses), ("income", incomes)):
            valid = frame.dropna(subset=["fecha"]).copy()
            valid["period"] = valid["fecha"].dt.to_period("M")
            series.append(valid.groupby("period")["monto"].sum().rename(name))
        if not series:
            return pd.DataFrame()
        result = pd.concat(series, axis=1).fillna(0).reset_index()
        result["balance"] = result.get("income", 0) - result.get("expense", 0)
        return result

    @classmethod
    def _monthly_average(cls, frame: pd.DataFrame, noun: str) -> str:
        valid = frame.dropna(subset=["fecha"]).copy()
        if valid.empty: return f"No hay datos para calcular el promedio mensual de {noun}."
        valid["period"] = valid["fecha"].dt.to_period("M")
        values = valid.groupby("period")["monto"].sum()
        return f"Tu promedio mensual de {noun} es {cls._money(values.mean())}, calculado sobre {len(values)} meses."

    @classmethod
    def _daily_average(cls, frame: pd.DataFrame, noun: str) -> str:
        valid = frame.dropna(subset=["fecha"]).copy()
        if valid.empty: return f"No hay datos para calcular tu {noun} diario."
        values = valid.groupby(valid["fecha"].dt.date)["monto"].sum()
        return f"Tu {noun} diario promedio es {cls._money(values.mean())}, considerando {len(values)} días con movimientos."

    @classmethod
    def _max_day(cls, frame: pd.DataFrame, verb: str) -> str:
        return cls._extreme_day(frame, True, verb)

    @classmethod
    def _min_day(cls, frame: pd.DataFrame, verb: str) -> str:
        return cls._extreme_day(frame, False, verb)

    @classmethod
    def _extreme_day(cls, frame: pd.DataFrame, highest: bool, verb: str) -> str:
        valid = frame.dropna(subset=["fecha"])
        grouped = valid.groupby(valid["fecha"].dt.date)["monto"].agg(["sum", "count"])
        day = grouped["sum"].idxmax() if highest else grouped["sum"].idxmin()
        row = grouped.loc[day]
        count = int(row["count"])
        noun = "movimiento" if count == 1 else "movimientos"
        return f"El día que {'más' if highest else 'menos'} {verb} fue el {day.strftime('%d/%m/%Y')}: {cls._money(row['sum'])} en {count} {noun}."

    @classmethod
    def _extreme_transaction(cls, frame: pd.DataFrame, highest: bool, noun: str) -> str:
        row = frame.loc[frame["monto"].idxmax() if highest else frame["monto"].idxmin()]
        return f"Tu {'mayor' if highest else 'menor'} {noun} fue {cls._money(row['monto'])} por {row['descripcion']} ({row['categoria']}) el {cls._date(row['fecha'])}."

    @classmethod
    def _latest_transaction(cls, frame: pd.DataFrame, noun: str) -> str:
        valid = frame.dropna(subset=["fecha"])
        row = valid.sort_values("fecha", ascending=False).iloc[0]
        return f"Tu último {noun} fue {cls._money(row['monto'])} por {row['descripcion']} ({row['categoria']}) el {cls._date(row['fecha'])}."

    @classmethod
    def _expense_position(cls, frame: pd.DataFrame, position: int) -> str:
        ordered = frame.sort_values("monto", ascending=False).reset_index(drop=True)
        if len(ordered) < position:
            return f"No hay al menos {position} gastos para armar ese ranking."
        row = ordered.iloc[position - 1]
        return (
            f"Tu gasto número {position} por importe es {cls._money(row['monto'])} "
            f"por {row['descripcion']} ({row['categoria']}) el {cls._date(row['fecha'])}."
        )

    @classmethod
    def _subcategory_ranking(cls, frame: pd.DataFrame, category: str | None = None) -> str:
        if frame.empty or "subcategoria" not in frame.columns:
            return "No hay datos de subcategorías disponibles para responder esa consulta."
        valid = frame.copy()
        valid["subcategoria"] = valid["subcategoria"].fillna("").astype(str).str.strip()
        valid = valid[valid["subcategoria"].ne("")]
        if valid.empty:
            suffix = f" dentro de {category}" if category else ""
            return f"No encontré subcategorías registradas{suffix}."
        grouped = valid.groupby("subcategoria")["monto"].sum().sort_values(ascending=False)
        subcategory, value = grouped.index[0], float(grouped.iloc[0])
        if category:
            return f"Dentro de {category}, la subcategoría en la que más gastaste fue {subcategory}, con {cls._money(value)}."
        return f"La subcategoría en la que más gastaste fue {subcategory}, con {cls._money(value)}."

    @classmethod
    def _compare_categories(cls, frame: pd.DataFrame, first: str, second: str) -> str:
        first_total = float(frame.loc[frame["categoria"].str.casefold().eq(first.casefold()), "monto"].sum())
        second_total = float(frame.loc[frame["categoria"].str.casefold().eq(second.casefold()), "monto"].sum())
        if first_total > second_total:
            conclusion = f"Gastaste más en {first}."
        elif second_total > first_total:
            conclusion = f"Gastaste más en {second}."
        else:
            conclusion = "Gastaste lo mismo en ambas categorías."
        return (
            f"En {first} gastaste {cls._money(first_total)} y en {second} "
            f"gastaste {cls._money(second_total)}. {conclusion}"
        )

    @classmethod
    def _top_categories_ranking(
        cls,
        frame: pd.DataFrame,
        limit: int = 3,
    ) -> str:
        grouped = (
            frame.groupby("categoria")["monto"]
            .sum()
            .sort_values(ascending=False)
        )

        if grouped.empty:
            return "No encontré gastos categorizados para armar el ranking."

        total = float(grouped.sum())
        top = grouped.head(limit)

        lines = ["Tus categorías con mayor peso en los gastos son:"]

        for position, (category, value) in enumerate(top.items(), start=1):
            amount = float(value)
            percentage = (amount / total * 100) if total > 0 else 0.0
            lines.append(
                f"{position}. **{category}**: {cls._money(amount)} "
                f"({percentage:.1f}% del gasto)."
            )

        lines.append(
            "Estas son las categorías que más conviene revisar por su peso. "
            "Eso no significa que todos esos gastos sean prescindibles o reducibles."
        )

        return "\n".join(lines)

    @classmethod
    def _category_ranking(cls, frame: pd.DataFrame, highest: bool, income: bool = False) -> str:
        grouped = frame.groupby("categoria")["monto"].sum().sort_values(ascending=not highest)
        category, value = grouped.index[0], float(grouped.iloc[0])
        if income: return f"Tu principal fuente de ingresos es {category}, con {cls._money(value)} registrados."
        return f"La categoría en la que {'más' if highest else 'menos'} gastaste fue {category}, con {cls._money(value)}."

    @classmethod
    def _category_position(cls, frame: pd.DataFrame, position: int) -> str:
        grouped = frame.groupby("categoria")["monto"].sum().sort_values(ascending=False)
        if len(grouped) < position: return f"No hay al menos {position} categorías diferentes para armar ese ranking."
        category, value = grouped.index[position - 1], float(grouped.iloc[position - 1])
        return f"Tu categoría número {position} por gasto es {category}, con {cls._money(value)}."

    @classmethod
    def _category_month_delta(cls, frame: pd.DataFrame, today: date, increase: bool) -> str:
        current = cls._period_frame(frame, "month", today).groupby("categoria")["monto"].sum()
        previous = cls._period_frame(frame, "previous_month", today).groupby("categoria")["monto"].sum()
        delta = current.subtract(previous, fill_value=0)
        if delta.empty: return "No hay datos suficientes para comparar categorías entre meses."
        category = delta.idxmax() if increase else delta.idxmin()
        value = float(delta.loc[category])
        if increase and value <= 0: return "Ninguna categoría aumentó sus gastos respecto del mes anterior."
        if not increase and value >= 0: return "Ninguna categoría redujo sus gastos respecto del mes anterior."
        return f"La categoría que {'más aumentó' if increase else 'más redujiste'} fue {category}, con una variación de {cls._money(abs(value))}."

    @classmethod
    def _weekday_ranking(cls, frame: pd.DataFrame, highest: bool) -> str:
        valid = frame.dropna(subset=["fecha"]).copy(); valid["weekday"] = valid["fecha"].dt.weekday
        names = {0:"lunes",1:"martes",2:"miércoles",3:"jueves",4:"viernes",5:"sábado",6:"domingo"}
        grouped = valid.groupby("weekday")["monto"].sum().sort_values(ascending=not highest)
        wd, value = int(grouped.index[0]), float(grouped.iloc[0])
        return f"El día de la semana en que {'más' if highest else 'menos'} gastás es el {names[wd]}, con {cls._money(value)} acumulados."


    @classmethod
    def _payment_method(cls, frame: pd.DataFrame) -> str:
        methods = frame["medio_pago"].replace("", "Sin especificar").value_counts()
        method, count = methods.index[0], int(methods.iloc[0])
        total = frame.loc[frame["medio_pago"].replace("", "Sin especificar").eq(method), "monto"].sum()
        return f"Tu medio de pago más usado es {method}: {count} movimientos por {cls._money(total)}."

    @classmethod
    def _recurring(cls, frame: pd.DataFrame) -> str:
        recurring = frame[frame["recurrente"]]
        if recurring.empty: return "No encontré gastos marcados como recurrentes o suscripciones."
        grouped = recurring.groupby(["descripcion", "categoria"])["monto"].sum().sort_values(ascending=False)
        lines = [f"Tus gastos recurrentes suman {cls._money(recurring['monto'].sum())}:"]
        lines += [f"• {d} ({c}): {cls._money(v)}" for (d,c),v in grouped.head(5).items()]
        return "\n".join(lines)

    @classmethod
    def _extreme_month(cls, frame: pd.DataFrame, highest: bool, verb: str) -> str:
        valid = frame.dropna(subset=["fecha"]).copy(); valid["period"] = valid["fecha"].dt.to_period("M")
        grouped = valid.groupby("period")["monto"].sum().sort_values(ascending=not highest)
        p, v = grouped.index[0], float(grouped.iloc[0])
        return f"El mes en que {'más' if highest else 'menos'} {verb} fue {cls._month_name(p)}, con {cls._money(v)}."

    @classmethod
    def _compare_months(cls, frame: pd.DataFrame, today: date, noun: str) -> str:
        current, previous = cls._month_total(frame,today,0), cls._month_total(frame,today,-1)
        return cls._comparison_text(current, previous, noun, "mes anterior")

    @classmethod
    def _compare_years(cls, frame: pd.DataFrame, today: date, noun: str) -> str:
        current = cls._period_frame(frame,"year",today)["monto"].sum(); previous = cls._period_frame(frame,"previous_year",today)["monto"].sum()
        return cls._comparison_text(current, previous, noun, "año pasado")

    @classmethod
    def _comparison_text(cls, current: float, previous: float, noun: str, label: str) -> str:
        diff = current - previous
        article = "" if label == "anteayer" else ("de " if label.startswith(("la ", "el ")) else "del ")
        comparison_label = f"{article}{label}" if article else label
        if previous == 0:
            return f"Registraste {cls._money(current)} en {noun}; no hay datos {comparison_label} para comparar."
        pct = abs(diff) / previous * 100
        pct_text = f"{pct:.1f}".replace(".", ",")
        if diff > 0:
            return f"Tus {noun} aumentaron {cls._money(diff)} ({pct_text}%) respecto {comparison_label}."
        if diff < 0:
            return f"Tus {noun} bajaron {cls._money(abs(diff))} ({pct_text}%) respecto {comparison_label}."
        return f"Tus {noun} se mantuvieron iguales respecto {comparison_label}: {cls._money(current)}."

    @classmethod
    def _income_stability(cls, incomes: pd.DataFrame) -> str:
        valid = incomes.dropna(subset=["fecha"]).copy(); valid["period"] = valid["fecha"].dt.to_period("M")
        values = valid.groupby("period")["monto"].sum()
        if len(values) < 3: return "Necesito al menos tres meses de ingresos para evaluar estabilidad."
        mean = values.mean(); cv = 0 if mean == 0 else values.std(ddof=0)/mean
        label = "muy estables" if cv < .10 else "moderadamente estables" if cv < .25 else "variables"
        return f"Tus ingresos son {label}: la variación relativa mensual es del {cv*100:.1f}% en {len(values)} meses."


    @classmethod
    def _compare_balances(cls, balances: pd.DataFrame) -> str:
        ordered = balances.sort_values("period")
        if len(ordered) < 2: return "Necesito al menos dos meses para comparar tu ahorro."
        current, previous = float(ordered.iloc[-1]["balance"]), float(ordered.iloc[-2]["balance"])
        return cls._comparison_text(current, previous, "ahorros", "mes anterior")

    @classmethod
    def _current_month_balance(cls, expenses: pd.DataFrame, incomes: pd.DataFrame, today: date) -> float:
        return cls._month_total(incomes,today,0)-cls._month_total(expenses,today,0)

    @classmethod
    def _top_category_tuple(cls, expenses: pd.DataFrame) -> tuple[str,float] | None:
        if expenses.empty: return None
        grouped = expenses.groupby("categoria")["monto"].sum().sort_values(ascending=False)
        return str(grouped.index[0]), float(grouped.iloc[0]) if not grouped.empty else None

    @classmethod
    def _basic_health(cls, income: float, expense: float) -> str:
        if income <= 0: return "No puedo evaluar tu salud financiera sin ingresos registrados este mes."
        ratio = expense/income*100; balance=income-expense
        status = "saludable" if ratio <= 70 else "ajustada" if ratio <= 90 else "en riesgo"
        return f"Tu situación financiera del mes es {status}: gastaste el {ratio:.1f}% de tus ingresos y tu balance es {cls._money(balance)}."

    @classmethod
    def _score_response(cls, analysis: dict[str, Any], user_name: str | None) -> str:
        score = analysis.get("financial_score") or analysis.get("score") or analysis.get("puntajeFinanciero")
        profile = analysis.get("perfil_financiero") or analysis.get("perfilFinanciero") or "sin clasificar"
        prefix = f"{user_name}, " if user_name else ""
        return f"{prefix}tu perfil financiero es {profile}" + (f" y tu score es {score}/100." if score is not None else ".")




    @staticmethod
    def _shift_month(year: int, month: int, offset: int) -> tuple[int,int]:
        idx=year*12+(month-1)+offset; return idx//12, idx%12+1

    @classmethod
    def _extract_categories(cls, q: str, frame: pd.DataFrame) -> list[str]:
        aliases = {
            "comida": ("alimentacion", "alimentación", "comida"),
            "alimentacion": ("alimentacion", "alimentación"),
            "transporte": ("transporte",),
            "salud": ("salud",),
            "vivienda": ("vivienda",),
            "entretenimiento": ("entretenimiento", "ocio"),
            "educacion": ("educación", "educacion"),
            "servicios": ("servicios",),
            "compras": ("compras",),
            "deudas": ("deudas", "deuda"),
            "impuestos": ("impuestos", "impuesto"),
        }
        categories = sorted(
            frame["categoria"].dropna().astype(str).unique(),
            key=len,
            reverse=True,
        )
        found: list[str] = []
        for category in categories:
            if QueryNormalizer.normalize(category) in q and category not in found:
                found.append(category)
        for alias, candidates in aliases.items():
            if alias not in q:
                continue
            for category in categories:
                norm = QueryNormalizer.normalize(category)
                if any(QueryNormalizer.normalize(c) in norm for c in candidates):
                    if category not in found:
                        found.append(category)
                    break
        return found

    @classmethod
    def _extract_category(cls, q: str, frame: pd.DataFrame) -> str | None:
        categories = cls._extract_categories(q, frame)
        return categories[0] if categories else None

    _CONTEXT_PATTERN = re.compile(
        r"<!--\s*finsi-financial-context\s+"
        r"metric=(income|expense|unknown)\s+"
        r"granularity=(year|month|rank|other)\s+"
        r"year=(\d{4}|none)\s+"
        r"month=(\d{1,2}|none)\s+"
        r"position=(\d+|none)\s*-->",
        re.IGNORECASE,
    )

    @classmethod
    def _context_data(cls, previous_answer: str | None) -> dict[str, Any]:
        if not previous_answer:
            return {}
        match = cls._CONTEXT_PATTERN.search(previous_answer)
        if not match:
            return {}
        metric, granularity, year, month, position = match.groups()
        return {
            "metric": metric.lower(),
            "granularity": granularity.lower(),
            "year": None if year.lower() == "none" else int(year),
            "month": None if month.lower() == "none" else int(month),
            "position": None if position.lower() == "none" else int(position),
        }

    @classmethod
    def _context_marker(cls, content: str, action: str) -> str:
        normalized = QueryNormalizer.normalize(content)
        action_normalized = QueryNormalizer.normalize(action)

        metric = "unknown"
        if "income" in action_normalized or cls._has(normalized, "ingresaste", "ingreso", "ingresos", "cobraste"):
            metric = "income"
        elif (
            "expense" in action_normalized
            or cls._has(normalized, "gastaste", "gasto", "gastos", "categoria numero", "categoria en la que mas gastaste")
        ):
            metric = "expense"

        granularity = "other"
        year = None
        month = None
        position = None

        rank_match = re.search(r"(?:categoria numero|numero)\s+(\d+)", normalized)
        if (
            "category_position" in action_normalized
            or rank_match
            or cls._has(normalized, "categoria en la que mas gastaste", "categoria con mas gastos")
        ):
            granularity = "rank"
            position = int(rank_match.group(1)) if rank_match else 1
        else:
            month_match = re.search(
                r"\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(20\d{2})\b",
                normalized,
            )
            if month_match:
                months = {
                    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
                    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
                    "septiembre": 9, "setiembre": 9, "octubre": 10,
                    "noviembre": 11, "diciembre": 12,
                }
                granularity = "month"
                month = months[month_match.group(1)]
                year = int(month_match.group(2))
            else:
                years = re.findall(r"\b(20\d{2})\b", normalized)
                if years and ("year" in action_normalized or cls._has(normalized, "durante", "en 20")):
                    granularity = "year"
                    year = int(years[-1])

        return (
            "<!-- finsi-financial-context "
            f"metric={metric} granularity={granularity} "
            f"year={year if year is not None else 'none'} "
            f"month={month if month is not None else 'none'} "
            f"position={position if position is not None else 'none'} -->"
        )

    @staticmethod
    def _bool(value: Any) -> bool:
        return value if isinstance(value,bool) else str(value).strip().casefold() in {"true","1","si","sí","yes"}

    @staticmethod
    def _has(q: str, *terms: str) -> bool:
        return any(QueryNormalizer.normalize(term) in q for term in terms)

    @classmethod
    def _result(cls, content: str, action: str) -> TransactionQueryResult:
        marker = cls._context_marker(content, action)
        return TransactionQueryResult(content=f"{content}\n\n{marker}", action=action)

    @staticmethod
    def _date(value: Any) -> str:
        parsed=pd.to_datetime(value,errors="coerce"); return "sin fecha" if pd.isna(parsed) else parsed.strftime("%d/%m/%Y")

    @staticmethod
    def _month_name(period: Any) -> str:
        months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
        return f"{months[int(period.month)-1]} de {period.year}" if hasattr(period,"month") else str(period)

    @staticmethod
    def _num(value: Any) -> float:
        try: return float(value or 0)
        except (TypeError,ValueError): return 0.0

    @staticmethod
    def _money(value: Any) -> str:
        try:
            rounded = Decimal(str(float(value))).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP,
            )
        except (InvalidOperation, TypeError, ValueError):
            rounded = Decimal("0.00")

        is_negative = rounded < 0
        absolute = abs(rounded)

        english = f"{absolute:,.2f}"
        localized = (
            english
            .replace(",", "X")
            .replace(".", ",")
            .replace("X", ".")
        )

        return f"-${localized}" if is_negative else f"${localized}"
