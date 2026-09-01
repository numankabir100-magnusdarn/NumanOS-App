from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Attendance, Course

router = APIRouter(tags=["attendance"])


class AttendanceCreate(BaseModel):
    course_id: int
    date: str
    status: str


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None


class AttendanceResponse(BaseModel):
    id: int
    course_id: int
    date: date
    status: str

    class Config:
        from_attributes = True


def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except Exception:
        return date.today()


def _get_attendance_or_404(attendance_id: int, db: Session) -> Attendance:
    a = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return a


@router.get("/attendance", response_model=List[AttendanceResponse])
def list_attendance(
    course_id: Optional[int] = Query(default=None),
    course_code: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Attendance)
    if course_id is not None:
        q = q.filter(Attendance.course_id == course_id)
    elif course_code:
        # Resolve course_code to course_id
        course = db.query(Course).filter(Course.code == course_code).first()
        if course:
            q = q.filter(Attendance.course_id == course.id)
        else:
            return []  # Course not found, return empty list
    if start_date:
        q = q.filter(Attendance.date >= _parse_date(start_date))
    if end_date:
        q = q.filter(Attendance.date <= _parse_date(end_date))
    return q.order_by(Attendance.date.desc()).all()


@router.get("/attendance/{attendance_id}", response_model=AttendanceResponse)
def get_attendance(attendance_id: int, db: Session = Depends(get_db)):
    return _get_attendance_or_404(attendance_id, db)


@router.get("/attendance/summary/course/{course_code}")
@router.get("/attendance/summary")
def attendance_summary(
    course_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Return attendance summary. course_code query param accepts course code like CSC103
    (matches unification from consolidation pass: ?course_code=CODE is canonical).
    """
    q = db.query(Attendance)
    if course_code:
        course = db.query(Course).filter(Course.code == course_code).first()
        if course:
            q = q.filter(Attendance.course_id == course.id)
        else:
            return {"course_code": course_code, "total": 0, "present": 0, "absent": 0, "percentage": None}
    rows = q.all()
    total = len(rows)
    present = sum(1 for a in rows if a.status.lower() == "present")
    absent = total - present
    pct = round(present / total * 100, 2) if total > 0 else None
    return {
        "course_code": course_code,
        "total": total,
        "present": present,
        "absent": absent,
        "percentage": pct,
    }


@router.post("/attendance", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_attendance(payload: AttendanceCreate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    a = Attendance(
        course_id=payload.course_id,
        date=_parse_date(payload.date),
        status=payload.status,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(attendance_id: int, payload: AttendanceUpdate, db: Session = Depends(get_db)):
    a = _get_attendance_or_404(attendance_id, db)
    if payload.status is not None:
        a.status = payload.status
    db.commit()
    db.refresh(a)
    return a


@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    a = _get_attendance_or_404(attendance_id, db)
    db.delete(a)
    db.commit()
    return None
