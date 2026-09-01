from datetime import datetime, date, timedelta
from typing import List, Optional
import json
import os
import zipfile
import io
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Semester, Course, Deadline, Attendance, Mark, Document, DocumentDecision

router = APIRouter(prefix="/semesters", tags=["semesters"])

DEFAULT_EXPORT_DIR = r"C:\Users\Numan Kabir\Desktop\NuManOS_Archives"


class SemesterCreate(BaseModel):
    number: int
    title: str
    start_date: str
    end_date: str


class CourseCreate(BaseModel):
    code: str
    name: str
    credits: int
    theory_weight: float = 75.0
    lab_weight: float = 25.0
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    submission_pref: Optional[str] = None


class SemesterResponse(BaseModel):
    id: int
    name: str
    year: int
    is_active: bool
    number: Optional[int] = None
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    archived_at: Optional[str] = None

    class Config:
        from_attributes = True


class CourseSuggestion(BaseModel):
    code: str
    name: str
    credits: int
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    theory_weight: float
    lab_weight: float


class SemesterSummary(BaseModel):
    semester_id: int
    title: str
    number: Optional[int]
    start_date: Optional[str]
    end_date: Optional[str]
    course_count: int
    course_list: List[dict]
    deadline_count: int
    attendance_total: int
    attendance_present: int
    attendance_percentage: Optional[float]
    mark_count: int
    document_count: int
    decision_count: int


def _sem_to_response(sem: Semester) -> SemesterResponse:
    return SemesterResponse(
        id=sem.id,
        name=sem.name,
        year=sem.year,
        is_active=sem.is_active,
        number=sem.number,
        title=sem.title,
        start_date=sem.start_date.isoformat() if sem.start_date else None,
        end_date=sem.end_date.isoformat() if sem.end_date else None,
        status=sem.status,
        archived_at=sem.archived_at.isoformat() if sem.archived_at else None,
    )


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def _get_semester_courses(db: Session, semester_id: int) -> List[Course]:
    return db.query(Course).filter(Course.semester_id == semester_id).all()


def _compute_summary(db: Session, sem: Semester) -> SemesterSummary:
    courses = _get_semester_courses(db, sem.id)
    course_ids = [c.id for c in courses]
    course_list = [
        {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "credits": c.credits,
            "teacher_name": c.teacher_name,
        }
        for c in courses
    ]

    deadline_count = 0
    attendance_total = 0
    attendance_present = 0
    mark_count = 0
    document_count = 0

    if course_ids:
        deadline_count = db.query(Deadline).filter(Deadline.course_id.in_(course_ids)).count()
        att = db.query(Attendance).filter(Attendance.course_id.in_(course_ids)).all()
        attendance_total = len(att)
        attendance_present = sum(1 for a in att if a.status.lower() == "present")
        mark_count = db.query(Mark).filter(Mark.course_id.in_(course_ids)).count()
        document_count = db.query(Document).filter(Document.course_id.in_(course_ids)).count()

    decision_count = db.query(DocumentDecision).count()

    attendance_percentage = (attendance_present / attendance_total * 100.0) if attendance_total > 0 else None

    return SemesterSummary(
        semester_id=sem.id,
        title=sem.title or f"{sem.name} {sem.year}",
        number=sem.number,
        start_date=sem.start_date.isoformat() if sem.start_date else None,
        end_date=sem.end_date.isoformat() if sem.end_date else None,
        course_count=len(courses),
        course_list=course_list,
        deadline_count=deadline_count,
        attendance_total=attendance_total,
        attendance_present=attendance_present,
        attendance_percentage=round(attendance_percentage, 2) if attendance_percentage is not None else None,
        mark_count=mark_count,
        document_count=document_count,
        decision_count=decision_count,
    )


def _rows_to_dicts(rows):
    result = []
    for r in rows:
        d = {}
        for col in r.__table__.columns:
            v = getattr(r, col.name)
            if isinstance(v, (datetime, date)):
                v = v.isoformat()
            d[col.name] = v
        result.append(d)
    return result


@router.get("", response_model=List[SemesterResponse])
def list_semesters(db: Session = Depends(get_db)):
    """List all semesters, newest first."""
    sems = db.query(Semester).order_by(Semester.id.desc()).all()
    return [_sem_to_response(s) for s in sems]


@router.get("/active", response_model=SemesterResponse)
def get_active_semester(db: Session = Depends(get_db)):
    """Return the current active semester."""
    sem = db.query(Semester).filter(Semester.is_active == True).first()
    if not sem:
        raise HTTPException(status_code=404, detail="No active semester found")
    return _sem_to_response(sem)


@router.post("", response_model=SemesterResponse)
def create_semester(data: SemesterCreate, db: Session = Depends(get_db)):
    """
    Create a new semester. Automatically deactivates any previously active
    semester (sets is_active=False but does NOT archive it).
    """
    db.query(Semester).filter(Semester.is_active == True).update({Semester.is_active: False})
    db.flush()

    start = _parse_date(data.start_date)
    end = _parse_date(data.end_date)
    title = data.title.strip()
    year = start.year if start else (end.year if end else datetime.now().year)
    name = f"Semester {data.number}"

    sem = Semester(
        name=name,
        year=year,
        is_active=True,
        number=data.number,
        title=title,
        start_date=start,
        end_date=end,
        status="active",
        archived_at=None,
    )
    db.add(sem)
    db.commit()
    db.refresh(sem)
    return _sem_to_response(sem)


@router.get("/{semester_id}/summary", response_model=SemesterSummary)
def get_semester_summary(semester_id: int, db: Session = Depends(get_db)):
    """Return summary statistics for a semester (preview before wrap-up)."""
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")
    return _compute_summary(db, sem)


@router.post("/{semester_id}/courses/carry-over", response_model=List[CourseSuggestion])
def carryover_course_suggestions(
    semester_id: int,
    previous_semester_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Find courses in the previous semester matching by code and return suggestions.
    Accepts either explicit previous_semester_id (via query param) or uses the
    semester_id in the path as the previous one. Does not save anything.
    """
    prev_id = previous_semester_id or semester_id
    prev = db.query(Semester).filter(Semester.id == prev_id).first()
    if not prev:
        raise HTTPException(status_code=404, detail="Previous semester not found")
    courses = _get_semester_courses(db, prev_id)
    suggestions = []
    for c in courses:
        suggestions.append(CourseSuggestion(
            code=c.code,
            name=c.name,
            credits=c.credits,
            teacher_name=c.teacher_name,
            teacher_email=c.teacher_email,
            theory_weight=c.theory_weight,
            lab_weight=c.lab_weight,
        ))
    suggestions.sort(key=lambda s: s.code)
    return suggestions


@router.post("/{semester_id}/courses", status_code=201)
def add_courses_to_semester(
    semester_id: int,
    courses: List[CourseCreate],
    db: Session = Depends(get_db),
):
    """Bulk create courses under the given semester."""
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")
    created = []
    for c in courses:
        course = Course(
            semester_id=sem.id,
            code=c.code.strip(),
            name=c.name.strip(),
            credits=c.credits,
            theory_weight=c.theory_weight,
            lab_weight=c.lab_weight,
            teacher_name=c.teacher_name.strip() if c.teacher_name else None,
            teacher_email=c.teacher_email.strip() if c.teacher_email else None,
            submission_pref=c.submission_pref,
        )
        db.add(course)
        created.append(course)
    db.commit()
    for c in created:
        db.refresh(c)
    return {"created": len(created), "course_ids": [c.id for c in created]}


@router.post("/{semester_id}/wrapup")
def wrapup_semester(semester_id: int, db: Session = Depends(get_db)):
    """
    Export all semester data to a zip file, save a copy to the export dir,
    mark the semester as archived, and return the zip for download.
    """
    sem = db.query(Semester).filter(Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")
    if sem.status == "archived":
        raise HTTPException(status_code=400, detail="Semester is already archived")

    summary = _compute_summary(db, sem)
    courses = _get_semester_courses(db, sem.id)
    course_ids = [c.id for c in courses]

    deadlines_rows = []
    attendance_rows = []
    marks_rows = []
    documents_rows = []
    if course_ids:
        deadlines_rows = db.query(Deadline).filter(Deadline.course_id.in_(course_ids)).all()
        attendance_rows = db.query(Attendance).filter(Attendance.course_id.in_(course_ids)).all()
        marks_rows = db.query(Mark).filter(Mark.course_id.in_(course_ids)).all()
        documents_rows = db.query(Document).filter(Document.course_id.in_(course_ids)).all()
    decisions_rows = db.query(DocumentDecision).all()

    deadlines_json = json.dumps(_rows_to_dicts(deadlines_rows), indent=2, default=str).encode("utf-8")
    attendance_json = json.dumps(_rows_to_dicts(attendance_rows), indent=2, default=str).encode("utf-8")
    marks_json = json.dumps(_rows_to_dicts(marks_rows), indent=2, default=str).encode("utf-8")
    decisions_json = json.dumps(_rows_to_dicts(decisions_rows), indent=2, default=str).encode("utf-8")
    courses_json = json.dumps(_rows_to_dicts(courses), indent=2, default=str).encode("utf-8")
    summary_dict = summary.model_dump()
    summary_json = json.dumps(summary_dict, indent=2, default=str).encode("utf-8")

    today_str = datetime.now().strftime("%Y%m%d")
    safe_title = (sem.title or f"Semester_{sem.number or sem.id}").replace(" ", "_").replace("/", "_")
    zip_filename = f"NuManOS_Semester_{sem.number or sem.id}_{safe_title}_{today_str}.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("summary.json", summary_json)
        zf.writestr("courses.json", courses_json)
        zf.writestr("deadlines.json", deadlines_json)
        zf.writestr("attendance.json", attendance_json)
        zf.writestr("marks.json", marks_json)
        zf.writestr("decisions.json", decisions_json)

        for doc in documents_rows:
            if not doc.filepath:
                continue
            try:
                fp = Path(doc.filepath)
                if fp.exists() and fp.is_file():
                    arcname = f"documents/{fp.name}"
                    zf.write(str(fp), arcname=arcname)
            except Exception:
                pass

    zip_bytes = buf.getvalue()
    buf.seek(0)

    try:
        export_dir = Path(DEFAULT_EXPORT_DIR)
        export_dir.mkdir(parents=True, exist_ok=True)
        export_path = export_dir / zip_filename
        with open(export_path, "wb") as f:
            f.write(zip_bytes)
        saved_path = str(export_path)
    except Exception as e:
        saved_path = f"save_failed: {e}"

    sem.status = "archived"
    sem.archived_at = datetime.now()
    sem.is_active = False
    db.commit()

    headers = {
        "Content-Disposition": f'attachment; filename="{zip_filename}"',
        "X-Saved-To": saved_path,
        "X-File-Size": str(len(zip_bytes)),
    }

    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers=headers,
    )
