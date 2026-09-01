from routes.whatsapp_router import (
    infer_message_intent,
    extract_course_code,
    extract_deadline_candidates,
    parse_whatsapp_export,
)


def test_infer_message_intent_handles_deadline_text():
    result = infer_message_intent("CSC103 assignment due on 2026-09-18")
    assert result == "deadline"


def test_extract_course_code_from_text():
    assert extract_course_code("Reminder for HUM112 quiz") == "HUM112"


def test_extract_deadline_candidates_from_export():
    export = """
    09/01/2026, 10:00 PM - Alice: CSC103 assignment due 2026-09-18
    09/02/2026, 11:00 PM - Bob: BIO201 lab report due 2026-09-20
    """
    candidates = extract_deadline_candidates(export)
    assert len(candidates) == 2
    assert candidates[0]["course_code"] == "CSC103"
    assert candidates[0]["title"]
