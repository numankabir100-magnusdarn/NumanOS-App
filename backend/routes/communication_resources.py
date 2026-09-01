from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/communication", tags=["communication"])


class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    course_code: Optional[str] = None


class SMSRequest(BaseModel):
    to: str
    message: str


class NotificationTemplate(BaseModel):
    id: int
    name: str
    subject: str
    body: str
    category: str


class SendResponse(BaseModel):
    success: bool
    message: str
    sent_at: str


TEMPLATES = [
    NotificationTemplate(
        id=1,
        name="assignment_reminder",
        subject="Reminder: Upcoming Assignment Due",
        body="This is a friendly reminder that your assignment is due soon. Please ensure you submit it before the deadline.",
        category="deadline",
    ),
    NotificationTemplate(
        id=2,
        name="low_attendance_warning",
        subject="Warning: Low Attendance Detected",
        body="Your attendance in this course has dropped below the recommended threshold. Please attend all future classes.",
        category="attendance",
    ),
    NotificationTemplate(
        id=3,
        name="grade_available",
        subject="Grade Posted",
        body="Your grades for the latest assessment are now available. Please check the portal for details.",
        category="marks",
    ),
]


@router.get("/templates", response_model=List[NotificationTemplate])
def list_templates(category: Optional[str] = None):
    if category:
        return [t for t in TEMPLATES if t.category.lower() == category.lower()]
    return TEMPLATES


@router.post("/send-email", response_model=SendResponse)
def send_email(req: EmailRequest, db: Session = Depends(get_db)):
    """
    Stub email endpoint. Logs locally but does not actually send.
    Production would wire in SMTP / SendGrid etc.
    """
    if not req.to or "@" not in req.to:
        raise HTTPException(status_code=400, detail="Invalid email recipient")
    return SendResponse(
        success=True,
        message=f"Email queued (stub) to: {req.to} via category: {req.course_code or 'general'}",
        sent_at=datetime.utcnow().isoformat(),
    )


@router.post("/send-sms", response_model=SendResponse)
def send_sms(req: SMSRequest, db: Session = Depends(get_db)):
    if not req.to or len(req.to) < 5:
        raise HTTPException(status_code=400, detail="Invalid SMS recipient")
    return SendResponse(
        success=True,
        message=f"SMS queued (stub) to: {req.to}",
        sent_at=datetime.utcnow().isoformat(),
    )


@router.get("/health")
def comm_health():
    return {"status": "ok", "services": ["email (stub)", "sms (stub)", "templates: {}".format(len(TEMPLATES))]}
