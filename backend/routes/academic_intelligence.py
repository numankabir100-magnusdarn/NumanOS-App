from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Course, Mark, Attendance, Deadline

router = APIRouter(prefix="/academic-intelligence", tags=["academic-intelligence"])


class AcademicInsightResponse(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    attendance_percentage: Optional[float]
    average_mark: Optional[float]
    upcoming_deadlines: int
    risk_level: str


class SemesterOverviewResponse(BaseModel):
    total_courses: int
    overall_attendance_percentage: Optional[float]
    average_gpa: Optional[float]
    at_risk_courses: int
    upcoming_deadlines: int


def _component_percentage(obtained: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return (obtained / total) * 100.0


@router.get("/semester/{semester_id}/overview", response_model=SemesterOverviewResponse)
def semester_overview(semester_id: int, db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.semester_id == semester_id).all()
    if not courses:
        raise HTTPException(status_code=404, detail="No courses found for this semester")
    course_ids = [c.id for c in courses]

    att = db.query(Attendance).filter(Attendance.course_id.in_(course_ids)).all()
    total_att = len(att)
    present_att = sum(1 for a in att if a.status.lower() == "present")
    overall_att_pct = round(present_att / total_att * 100, 2) if total_att > 0 else None

    marks = db.query(Mark).filter(Mark.course_id.in_(course_ids)).all()
    avg_mark = round(sum(_component_percentage(m.obtained, m.total) for m in marks) / len(marks), 2) if marks else None

    deadlines_pending = db.query(Deadline).filter(Deadline.course_id.in_(course_ids), Deadline.status == "pending").count()

    at_risk = 0
    for c in courses:
        catts = [a for a in att if a.course_id == c.id]
        cpct = sum(1 for a in catts if a.status.lower() == "present")
        if catts and cpct / len(catts) < 0.6:
            at_risk += 1

    return SemesterOverviewResponse(
        total_courses=len(courses),
        overall_attendance_percentage=overall_att_pct,
        average_gpa=avg_mark,
        at_risk_courses=at_risk,
        upcoming_deadlines=deadlines_pending,
    )


@router.get("/semester/{semester_id}/insights", response_model=List[AcademicInsightResponse])
def course_insights(semester_id: int, db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.semester_id == semester_id).all()
    if not courses:
        raise HTTPException(status_code=404, detail="No courses found for this semester")
    results = []
    for c in courses:
        atts = db.query(Attendance).filter(Attendance.course_id == c.id).all()
        att_pct = round(sum(1 for a in atts if a.status.lower() == "present") / len(atts) * 100, 2) if atts else None
        marks = db.query(Mark).filter(Mark.course_id == c.id).all()
        avg_m = round(sum(_component_percentage(m.obtained, m.total) for m in marks) / len(marks), 2) if marks else None
        pending = db.query(Deadline).filter(Deadline.course_id == c.id, Deadline.status == "pending").count()
        risk = "low"
        if att_pct is not None and att_pct < 60:
            risk = "high"
        elif avg_m is not None and avg_m < 60:
            risk = "medium"
        results.append(AcademicInsightResponse(
            course_id=c.id,
            course_code=c.code,
            course_name=c.name,
            attendance_percentage=att_pct,
            average_mark=avg_m,
            upcoming_deadlines=pending,
            risk_level=risk,
        ))
    return results
