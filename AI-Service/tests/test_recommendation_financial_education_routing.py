from pathlib import Path


def test_financial_education_bypasses_stale_support_follow_up():
    service_path = Path(__file__).parents[1] / "app/services/agent/service.py"
    source = service_path.read_text(encoding="utf-8")

    assert (
        "support_follow_up\n"
        "            and early_intent.intent != Intent.FINANCIAL_EDUCATION\n"
        "            and not (is_contextual_financial_follow_up or is_financial_query)"
    ) in source
