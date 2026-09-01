from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import Deadline, Course

router = APIRouter(tags=["deadlines"])


class DeadlineCreate(BaseModel):
    course_id: int
    title: str
    due_datetime: str
    platform: Optional[str] = None
    link: Optional[str] = None
    status: str = "pending"
    marks_obtained: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def handle_due_date_alias(cls, data: dict) -> dict:
        if "due_date" in data and "due_datetime" not in data:
            data["due_datetime"] = data.pop("due_date")
        return data


class DeadlineUpdate(BaseModel):
    title: Optional[str] = None
    due_datetime: Optional[str] = None
    platform: Optional[str] = None
    link: Optional[str] = None
    status: Optional[str] = None
    marks_obtained: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def handle_due_date_alias(cls, data: dict) -> dict:
        if "due_date" in data and "due_datetime" not in data:
            data["due_datetime"] = data.pop("due_date")
        return data


class DeadlineResponse(BaseModel):
    id: int
    course_id: int
    title: str
    due_datetime: datetime
    platform: Optional[str]
    link: Optional[str]
    status: str
    marks_obtained: Optional[float]

    class Config:
        from_attributes = True


def _parse_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.utcnow()


def _get_deadline_or_404(deadline_id: int, db: Session) -> Deadline:
    d = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return d


@router.get("/deadlines", response_model=List[DeadlineResponse])
def list_deadlines(
    course_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Deadline)
    if course_id is not None:
        q = q.filter(Deadline.course_id == course_id)
    if status:
        q = q.filter(Deadline.status == status)
    return q.order_by(Deadline.due_datetime.asc()).all()


@router.get("/deadlines/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(deadline_id: int, db: Session = Depends(get_db)):
    return _get_deadline_or_404(deadline_id, db)


@router.post("/deadlines", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
def create_deadline(payload: DeadlineCreate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    d = Deadline(
        course_id=payload.course_id,
        title=payload.title.strip(),
        due_datetime=_parse_dt(payload.due_datetime),
        platform=payload.platform,
        link=payload.link,
        status=payload.status or "pending",
        marks_obtained=payload.marks_obtained,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.put("/deadlines/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(deadline_id: int, payload: DeadlineUpdate, db: Session = Depends(get_db)):
    d = _get_deadline_or_404(deadline_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "due_datetime" in data and data["due_datetime"]:
        data["due_datetime"] = _parse_dt(data["due_datetime"])
    for k, v in data.items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/deadlines/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deadline(deadline_id: int, db: Session = Depends(get_db)):
    d = _get_deadline_or_404(deadline_id, db)
    db.delete(d)
    db.commit()
    return None
