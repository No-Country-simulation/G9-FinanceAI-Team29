import pytest

from app.services.support.diagnosis import GuidedSupportDiagnosis


def diagnose(question: str, previous: str | None = None):
    return GuidedSupportDiagnosis.diagnose(
        usuario_id="USR0001",
        question=question,
        previous_answer=previous,
        support_email="soporte@finsight.ai",
    )


def test_goal_creation_problem_starts_guided_triage():
    result = diagnose("No puedo crear una meta")
    assert result is not None
    assert result.route == "support_goal_create_triage"
    assert "Crear meta" in result.content
    assert "Ir a la página de Soporte" not in result.content


@pytest.mark.parametrize(
    ("choice", "route"),
    [
        ("1", "support_goal_button_check"),
        ("2", "support_goal_waiting_error"),
        ("3", "support_goal_not_visible"),
        ("4", "support_goal_validation"),
    ],
)
def test_goal_triage_choices(choice: str, route: str):
    previous = diagnose("No puedo crear una meta").content
    result = diagnose(choice, previous)
    assert result is not None
    assert result.route == route
