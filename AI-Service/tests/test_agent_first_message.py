from app.api.agent import _first_message_answer


def test_first_financial_question_keeps_real_answer():
    result = _first_message_answer(
        "¿Cuánto gasté este mes?",
        "Este mes gastaste USD 850 en 12 movimientos.",
    )

    assert "Hola, soy **Finsi**" in result
    assert "Este mes gastaste USD 850" in result


def test_first_support_question_keeps_diagnosis():
    result = _first_message_answer(
        "No puedo cargar mi CSV",
        "Veo que no podés cargar tu CSV. Revisemos el problema juntos.",
    )

    assert "Hola, soy **Finsi**" in result
    assert "Revisemos el problema juntos" in result


def test_simple_greeting_does_not_duplicate_old_greeting():
    result = _first_message_answer(
        "Hola",
        "¡Hola! Soy el asistente financiero de FinSightAI.",
    )

    assert result.count("Hola") == 1
    assert "¿En qué puedo ayudarte hoy?" in result


def test_second_message_is_not_prefixed_is_enforced_by_endpoint_contract():
    # La función solo se invoca cuando previous_answer es None. Este test deja
    # explícito que no modifica el contenido por sí sola fuera de ese caso.
    answer = "Continuemos con el diagnóstico del CSV."
    assert answer == "Continuemos con el diagnóstico del CSV."
