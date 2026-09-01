from datetime import date as DateType
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MarkBase(BaseModel):
    course_id: int
    component_type: str
    title: str
    obtained: float = Field(ge=0)
    total: float = Field(gt=0)
    mark_date: Optional[DateType] = Field(
        default=None,
        validation_alias="date",
        serialization_alias="date",
    )

    model_config = ConfigDict(populate_by_name=True)


class MarkCreate(BaseModel):
    course_id: int
    component_type: str
    title: str
    obtained: float = Field(ge=0)
    total: float = Field(gt=0)
    mark_date: Optional[DateType] = Field(
        default=None,
        validation_alias="date",
        serialization_alias="date",
    )

    model_config = ConfigDict(populate_by_name=True)


class MarkUpdate(BaseModel):
    component_type: Optional[str] = None
    title: Optional[str] = None
    obtained: Optional[float] = Field(default=None, ge=0)
    total: Optional[float] = Field(default=None, gt=0)
    mark_date: Optional[DateType] = Field(
        default=None,
        validation_alias="date",
        serialization_alias="date",
    )

    model_config = ConfigDict(populate_by_name=True)


class MarkResponse(MarkBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CourseGPAResult(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    credits: int
    theory_score: Optional[float]
    lab_score: Optional[float]
    final_marks: float
    grade: str
    gpa_points: float


class SemesterGPAResponse(BaseModel):
    semester_id: int
    semester_name: str
    semester_year: int
    total_credits: int
    cgpa: float
    courses: list[CourseGPAResult]
