import json
import logging
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Course, Deadline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class ParseRequest(BaseModel):
    text: Optional[str] = None
    sender: Optional[str] = None
    timestamp: Optional[str] = None
    source: str = "android_gateway"
    media_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None


class ParseResponse(BaseModel):
    success: bool
    intent: Optional[str] = None
    entities: dict = {}
    raw_text: str
    parsed_at: str
    module: Optional[str] = None


class GatewayResponse(BaseModel):
    success: bool
    intent: str
    module: str
    message: str
    entities: dict = {}
    saved: bool = False
    saved_id: Optional[int] = None
    parsed_at: str


def infer_message_intent(text: str) -> str:
    lower = (text or "").lower()
    if not lower:
        return "unknown"

    if any(k in lower for k in ["deadline", "due", "assignment", "submission", "upcoming", "exam", "quiz", "lab report", "project"]):
        return "deadline"
    if any(k in lower for k in ["mark", "grade", "gpa", "cgpa", "score", "result", "obtained", "total"]):
        return "marks"
    if any(k in lower for k in ["attendance", "present", "absent", "late", "missed class"]):
        return "attendance"
    if any(k in lower for k in ["announcement", "notice", "update", "class cancelled", "meeting", "reminder"]):
        return "announcement"
    if any(k in lower for k in ["pdf", "doc", "docx", "image", "photo", "file", "attachment", "media", "document"]):
        return "document"
    if any(k in lower for k in ["http://", "https://", "link", "url", "drive.google", "dropbox"]):
        return "link"
    if any(k in lower for k in ["course", "class", "subject", "semester"]):
        return "course"
    return "unknown"


def extract_course_code(text: str) -> Optional[str]:
    match = re.search(r"\b(CSC|HUM|BIO|ENG)\d{3}\b", (text or ""), re.IGNORECASE)
    if match:
        return match.group(0).upper()
    return None


def extract_dates(text: str) -> list[str]:
    matches = []
    patterns = [
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{2}/\d{2}/\d{4}\b",
        r"\b\d{2}-\d{2}-\d{4}\b",
        r"\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, (text or "").lower(), re.IGNORECASE):
            matches.append(match.group(0))
    return matches


def normalize_due_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", cleaned):
        return cleaned
    if re.match(r"^\d{2}/\d{2}/\d{4}$", cleaned):
        day, month, year = cleaned.split("/")
        return f"{year}-{month}-{day}"
    if re.match(r"^\d{2}-\d{2}-\d{4}$", cleaned):
        day, month, year = cleaned.split("-")
        return f"{year}-{month}-{day}"
    return None


def extract_deadline_candidates(export_text: str) -> list[dict]:
    candidates: list[dict] = []
    if not export_text:
        return candidates

    lines = [line.strip() for line in export_text.splitlines() if line.strip()]
    for line in lines:
        lower = line.lower()
        if not any(word in lower for word in ["due", "assignment", "submission", "quiz", "lab", "exam", "project", "deadline"]):
            continue

        course_code = extract_course_code(line)
        due_date = None
        for item in extract_dates(line):
            iso_date = normalize_due_date(item)
            if iso_date:
                due_date = iso_date
                break

        title = line
        if course_code:
            title = re.sub(rf"\b{course_code}\b", "", line, flags=re.IGNORECASE).strip(" -:;,")
        if not title:
            title = "Shared deadline"

        candidates.append({
            "course_code": course_code,
            "title": title,
            "due_date": due_date,
            "source_text": line,
        })

    return candidates


def parse_whatsapp_export(file_content: str) -> list[dict]:
    return extract_deadline_candidates(file_content)


def _route_module_from_intent(intent: str, file_name: Optional[str] = None) -> str:
    if intent == "deadline":
        return "deadlines"
    if intent == "marks":
        return "academic-engine"
    if intent == "attendance":
        return "attendance"
    if intent == "document":
        return "documents"
    if intent == "announcement":
        return "dashboard"
    if intent == "link":
        return "documents"
    if intent == "course":
        return "semester-manager"
    if file_name and file_name.lower().endswith((".pdf", ".docx", ".jpg", ".jpeg", ".png", ".txt")):
        return "documents"
    return "dashboard"


def _save_deadline_from_message(text: str, course_code: Optional[str], db: Session) -> Optional[Deadline]:
    if not course_code:
        return None

    course = db.query(Course).filter(Course.code == course_code).first()
    if not course:
        return None

    due_date_text = next(iter(extract_dates(text)), None)
    due_date_iso = normalize_due_date(due_date_text)
    if not due_date_iso:
        return None

    title = text.strip()
    if len(title) > 200:
        title = title[:197] + "..."

    entry = Deadline(
        course_id=course.id,
        title=title,
        due_datetime=datetime.fromisoformat(due_date_iso + "T00:00:00"),
        platform="WhatsApp Gateway",
        link=None,
        status="pending",
        marks_obtained=None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/parse", response_model=ParseResponse)
async def parse_whatsapp(request: Request, db: Session = Depends(get_db)):
    """Parse a WhatsApp message for intent/entities. Supports JSON or form-data."""
    content_type = request.headers.get("content-type", "")
    text = ""
    sender = None
    timestamp = None

    try:
        if "application/json" in content_type.lower():
            try:
                body = await request.json()
            except Exception:
                raw = await request.body()
                try:
                    body = json.loads(raw.decode("utf-8"))
                except Exception:
                    body = {}
            text = body.get("text", body.get("message", body.get("content", "")))
            sender = body.get("sender", body.get("from", None))
            timestamp = body.get("timestamp", body.get("ts", None))
        else:
            form = await request.form()
            text = form.get("text", form.get("message", ""))
            sender = form.get("sender", None)
            timestamp = form.get("timestamp", None)
    except Exception as exc:
        logger.warning(f"Failed to parse request body: {exc}")
        text = ""

    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing 'text' field in request body",
        )

    intent = infer_message_intent(text)
    entities: dict[str, Any] = {}
    course_code = extract_course_code(text)
    if course_code:
        entities["course_code"] = course_code

    dates = extract_dates(text)
    if dates:
        entities["dates"] = dates

    module = _route_module_from_intent(intent)

    return ParseResponse(
        success=True,
        intent=intent,
        entities=entities,
        raw_text=text,
        parsed_at=datetime.utcnow().isoformat(),
        module=module,
    )


@router.post("/parse-txt")
async def parse_txt_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accept a .txt WhatsApp export and extract deadline candidates."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    if not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are supported")

    raw = await file.read()
    text = raw.decode("utf-8", errors="replace")
    deadlines = parse_whatsapp_export(text)

    if not deadlines:
        return {
            "deadlines": [],
            "message": "No deadline-like content found in the exported chat.",
            "intent": "deadline",
            "module": "deadlines",
        }

    return {
        "deadlines": deadlines,
        "message": f"Extracted {len(deadlines)} deadline candidates from WhatsApp export.",
        "intent": "deadline",
        "module": "deadlines",
    }


@router.post("/save-deadlines")
def save_deadlines(payload: list[dict], db: Session = Depends(get_db)):
    """Persist extracted deadline entries to the NuManOS database."""
    saved = 0
    for item in payload or []:
        course_code = item.get("course_code") or extract_course_code(str(item.get("source_text") or item.get("title") or ""))
        if not course_code:
            continue
        course = db.query(Course).filter(Course.code == course_code).first()
        if not course:
            continue
        due_date = normalize_due_date(item.get("due_date")) or next(iter([normalize_due_date(x) for x in extract_dates(str(item.get("source_text") or item.get("title") or ""))]), None)
        if not due_date:
            continue

        existing = db.query(Deadline).filter(
            Deadline.course_id == course.id,
            Deadline.title == (item.get("title") or "Shared deadline").strip(),
            Deadline.due_datetime == datetime.fromisoformat(due_date + "T00:00:00")
        ).first()
        if existing:
            continue

        deadline = Deadline(
            course_id=course.id,
            title=(item.get("title") or "Shared deadline").strip()[:200],
            due_datetime=datetime.fromisoformat(due_date + "T00:00:00"),
            platform="WhatsApp Gateway",
            status="pending",
        )
        db.add(deadline)
        saved += 1

    db.commit()
    return {
        "success": True,
        "saved": saved,
        "message": f"Saved {saved} WhatsApp-derived deadlines to NuManOS.",
    }


@router.post("/route", response_model=GatewayResponse)
async def route_shared_content(request: Request, db: Session = Depends(get_db)):
    """Gateway-friendly endpoint for Android share flow. Accepts shared WhatsApp text, media, or file metadata."""
    content_type = request.headers.get("content-type", "")
    body: dict[str, Any] = {}

    try:
        if "application/json" in content_type.lower():
            body = await request.json()
        else:
            form = await request.form()
            body = dict(form)
    except Exception:
        body = {}

    text = str(body.get("text") or body.get("message") or body.get("content") or "").strip()
    sender = body.get("sender") or body.get("from")
    file_name = body.get("file_name") or body.get("filename") or body.get("name")
    media_url = body.get("media_url") or body.get("url")
    intent = infer_message_intent(text) if text else "document" if file_name or media_url else "unknown"

    if not text and not file_name and not media_url:
        raise HTTPException(status_code=400, detail="No WhatsApp payload received")

    entities: dict[str, Any] = {}
    course_code = extract_course_code(text or file_name or "")
    if course_code:
        entities["course_code"] = course_code

    if text:
        dates = extract_dates(text)
        if dates:
            entities["dates"] = dates

    module = _route_module_from_intent(intent, file_name=file_name)

    if intent == "deadline" and text and course_code:
        saved_deadline = _save_deadline_from_message(text, course_code, db)
        if saved_deadline:
            return GatewayResponse(
                success=True,
                intent=intent,
                module=module,
                message="WhatsApp deadline routed and saved to NuManOS.",
                entities=entities,
                saved=True,
                saved_id=saved_deadline.id,
                parsed_at=datetime.utcnow().isoformat(),
            )

    return GatewayResponse(
        success=True,
        intent=intent,
        module=module,
        message="Incoming WhatsApp content was classified and routed to the right NuManOS module.",
        entities=entities,
        saved=False,
        parsed_at=datetime.utcnow().isoformat(),
    )
