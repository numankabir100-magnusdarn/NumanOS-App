from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Course


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    credits: int
    theory_weight: float
    lab_weight: float
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    submission_pref: Optional[str] = None
    semester_id: int

    class Config:
        from_attributes = True


router = APIRouter(tags=["courses"])


def _course_to_response(course: Course) -> CourseResponse:
    return CourseResponse(
        id=course.id,
        code=course.code,
        name=course.name,
        credits=course.credits,
        theory_weight=course.theory_weight,
        lab_weight=course.lab_weight,
        teacher_name=course.teacher_name,
        teacher_email=course.teacher_email,
        submission_pref=course.submission_pref,
        semester_id=course.semester_id,
    )


@router.get("/courses", response_model=List[CourseResponse])
def list_courses(
    code: Optional[str] = Query(default=None),
    id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    List all courses. Optionally filter by ?code= or ?id=.
    Returns objects with .id and .code fields that Autron/tools.py expects.
    """
    query = db.query(Course)
    if code is not None:
        query = query.filter(Course.code == code)
    if id is not None:
        query = query.filter(Course.id == id)
    courses = query.order_by(Course.code).all()
    return [_course_to_response(c) for c in courses]


@router.get("/courses/{course_id}", response_model=CourseResponse)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with id {course_id} not found",
        )
    return _course_to_response(course)
