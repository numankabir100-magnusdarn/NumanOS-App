from datetime import date

from typing import Optional



from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy.orm import Session



from database import get_db

from models import Course, Mark, Semester

from schemas import (

    CourseGPAResult,

    MarkCreate,

    MarkResponse,

    MarkUpdate,

    SemesterGPAResponse,

)



router = APIRouter(tags=["marks"])



THEORY_WEIGHTS = {

    "quiz": 0.15,

    "assignment": 0.10,

    "midterm": 0.25,

    "terminal": 0.50,

}



LAB_WEIGHTS = {

    "lab_assignment": 0.25,

    "lab_midterm": 0.25,

    "lab_terminal": 0.50,

}





def _component_percentage(obtained: float, total: float) -> float:

    if total <= 0:

        return 0.0

    return (obtained / total) * 100.0





def _weighted_score(marks: list[Mark], weights: dict[str, float]) -> Optional[float]:

    score = 0.0

    used_weight = 0.0



    for component_type, weight in weights.items():

        component_marks = [mark for mark in marks if mark.component_type == component_type]

        if not component_marks:

            continue



        percentages = [_component_percentage(mark.obtained, mark.total) for mark in component_marks]

        average_percentage = sum(percentages) / len(percentages)

        score += average_percentage * weight

        used_weight += weight



    if used_weight == 0:

        return None



    return score / used_weight * sum(weights.values())





def calculate_theory_score(marks: list[Mark]) -> Optional[float]:

    theory_marks = [mark for mark in marks if mark.component_type in THEORY_WEIGHTS]

    if not theory_marks:

        return None

    return _weighted_score(theory_marks, THEORY_WEIGHTS)





def calculate_lab_score(marks: list[Mark]) -> Optional[float]:

    lab_marks = [mark for mark in marks if mark.component_type in LAB_WEIGHTS]

    if not lab_marks:

        return None

    return _weighted_score(lab_marks, LAB_WEIGHTS)





def calculate_final_marks(course: Course, marks: list[Mark]) -> float:

    theory_score = calculate_theory_score(marks)

    lab_score = calculate_lab_score(marks)



    if theory_score is None and lab_score is None:

        return 0.0



    if course.lab_weight <= 0 or lab_score is None:

        return round(theory_score or 0.0, 2)



    if theory_score is None:

        return round(lab_score, 2)



    final_marks = (theory_score / 100 * 75) + (lab_score / 100 * 25)

    return round(final_marks, 2)





def marks_to_grade(final_marks: float) -> tuple[str, float]:

    if final_marks >= 90:

        return "A+", 4.0

    if final_marks >= 85:

        return "A", 4.0

    if final_marks >= 80:

        return "A-", 3.67

    if final_marks >= 75:

        return "B+", 3.33

    if final_marks >= 71:

        return "B", 3.0

    if final_marks >= 68:

        return "B-", 2.67

    if final_marks >= 64:

        return "C+", 2.33

    if final_marks >= 60:

        return "C", 2.0

    if final_marks >= 56:

        return "C-", 1.67

    if final_marks >= 52:

        return "D+", 1.33

    if final_marks >= 50:

        return "D", 1.0

    return "F", 0.0





def _get_mark_or_404(mark_id: int, db: Session) -> Mark:

    mark = db.query(Mark).filter(Mark.id == mark_id).first()

    if not mark:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mark not found")

    return mark





def _get_course_or_404(course_id: int, db: Session) -> Course:

    course = db.query(Course).filter(Course.id == course_id).first()

    if not course:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    return course





@router.get("/marks", response_model=list[MarkResponse])
def get_marks_by_course_code(
    course_code: str = Query(..., description="Course code like CSC103"),
    db: Session = Depends(get_db),
):
    """
    Get marks for a course by course code (for Autron tools.py compatibility).
    Autron calls GET /marks?course_code=... instead of GET /marks/{course_id}.
    """
    course = db.query(Course).filter(Course.code == course_code).first()
    if not course:
        raise HTTPException(status_code=404, detail=f"Course with code '{course_code}' not found")
    marks = db.query(Mark).filter(Mark.course_id == course.id).all()
    return marks


@router.get("/marks/{course_id}", response_model=list[MarkResponse])

def get_marks_for_course(course_id: int, db: Session = Depends(get_db)):

    _get_course_or_404(course_id, db)

    return db.query(Mark).filter(Mark.course_id == course_id).order_by(Mark.id).all()





@router.post("/marks", response_model=MarkResponse, status_code=status.HTTP_201_CREATED)

def create_mark(payload: MarkCreate, db: Session = Depends(get_db)):

    _get_course_or_404(payload.course_id, db)



    mark = Mark(

        course_id=payload.course_id,

        component_type=payload.component_type,

        title=payload.title,

        obtained=payload.obtained,

        total=payload.total,

        date=payload.mark_date,

    )

    db.add(mark)

    db.commit()

    db.refresh(mark)

    return mark





@router.put("/marks/{mark_id}", response_model=MarkResponse)

def update_mark(mark_id: int, payload: MarkUpdate, db: Session = Depends(get_db)):

    mark = _get_mark_or_404(mark_id, db)

    update_data = payload.model_dump(exclude_unset=True)



    if "mark_date" in update_data:

        update_data["date"] = update_data.pop("mark_date")



    for field, value in update_data.items():

        setattr(mark, field, value)



    db.commit()

    db.refresh(mark)

    return mark





@router.delete("/marks/{mark_id}", status_code=status.HTTP_204_NO_CONTENT)

def delete_mark(mark_id: int, db: Session = Depends(get_db)):

    mark = _get_mark_or_404(mark_id, db)

    db.delete(mark)

    db.commit()





@router.get("/gpa/semester/{semester_id}", response_model=SemesterGPAResponse)

def get_semester_gpa(semester_id: int, db: Session = Depends(get_db)):

    semester = db.query(Semester).filter(Semester.id == semester_id).first()

    if not semester:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")



    courses = db.query(Course).filter(Course.semester_id == semester_id).all()

    if not courses:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="No courses found for this semester",

        )



    course_results: list[CourseGPAResult] = []

    total_quality_points = 0.0

    total_credits = 0



    for course in courses:

        marks = db.query(Mark).filter(Mark.course_id == course.id).all()

        theory_score = calculate_theory_score(marks)

        lab_score = calculate_lab_score(marks)

        final_marks = calculate_final_marks(course, marks)

        grade, gpa_points = marks_to_grade(final_marks)



        total_quality_points += gpa_points * course.credits

        total_credits += course.credits



        course_results.append(

            CourseGPAResult(

                course_id=course.id,

                course_code=course.code,

                course_name=course.name,

                credits=course.credits,

                theory_score=round(theory_score, 2) if theory_score is not None else None,

                lab_score=round(lab_score, 2) if lab_score is not None else None,

                final_marks=final_marks,

                grade=grade,

                gpa_points=gpa_points,

            )

        )



    cgpa = round(total_quality_points / total_credits, 2) if total_credits else 0.0



    return SemesterGPAResponse(

        semester_id=semester.id,

        semester_name=semester.name,

        semester_year=semester.year,

        total_credits=total_credits,

        cgpa=cgpa,

        courses=course_results,

    )

