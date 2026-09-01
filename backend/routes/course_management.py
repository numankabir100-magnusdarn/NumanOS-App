from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import os
import requests

from database import get_db
from models import Syllabus, CourseRecommendation, PrerequisiteCheck, Course, Mark

router = APIRouter(prefix="/course-management", tags=["course-management"])


# Pydantic Schemas
class SyllabusCreate(BaseModel):
    course_id: Optional[int] = None
    syllabus_text: Optional[str] = None
    file_path: Optional[str] = None


class SyllabusResponse(BaseModel):
    id: int
    course_id: Optional[int]
    syllabus_text: Optional[str]
    file_path: Optional[str]
    total_topics: int
    completed_topics: int
    completion_percentage: float
    last_updated: datetime
    ai_analyzed: bool
    
    class Config:
        from_attributes = True


class CourseRecommendationCreate(BaseModel):
    course_id: Optional[int] = None
    recommendation_type: str
    reason: Optional[str] = None
    confidence: float = 0.0
    suggested_semester: Optional[str] = None


class CourseRecommendationResponse(BaseModel):
    id: int
    course_id: Optional[int]
    recommendation_type: str
    reason: Optional[str]
    confidence: float
    suggested_semester: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class PrerequisiteCheckResponse(BaseModel):
    id: int
    course_id: Optional[int]
    prerequisite_course_id: Optional[int]
    prerequisite_course_code: Optional[str]
    is_satisfied: bool
    minimum_grade_required: Optional[str]
    actual_grade: Optional[str]
    notes: Optional[str]
    checked_at: datetime
    
    class Config:
        from_attributes = True


# Syllabus Endpoints
@router.post("/syllabi", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
def create_syllabus(syllabus: SyllabusCreate, db: Session = Depends(get_db)):
    """Create a syllabus entry."""
    new_syllabus = Syllabus(**syllabus.dict())
    db.add(new_syllabus)
    db.commit()
    db.refresh(new_syllabus)
    return new_syllabus


@router.get("/syllabi", response_model=List[SyllabusResponse])
def get_syllabi(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get all syllabi, optionally filtered by course."""
    query = db.query(Syllabus)
    
    if course_id:
        query = query.filter(Syllabus.course_id == course_id)
    
    return query.order_by(Syllabus.last_updated.desc()).all()


@router.post("/syllabi/analyze", response_model=SyllabusResponse)
def analyze_syllabus(file_path: str, course_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    AI-analyze a syllabus file to extract topics and deadlines.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
    
    system_prompt = """
    You are an academic syllabus analyzer. Analyze the syllabus content.
    Return a JSON object with:
    - total_topics: Number of main topics/modules
    - topics: Array of topic names
    - deadlines: Array of deadline descriptions (if any)
    """
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama3-8b-8192",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Syllabus content:\n\n{content}"}
                ],
                "max_tokens": 1000
            }
        )
        response.raise_for_status()
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
        
        import json
        parsed = json.loads(ai_response)
        
        total_topics = parsed.get("total_topics", len(parsed.get("topics", [])))
        
        syllabus = Syllabus(
            course_id=course_id,
            syllabus_text=content,
            file_path=file_path,
            total_topics=total_topics,
            completed_topics=0,
            completion_percentage=0.0,
            ai_analyzed=True
        )
        
        db.add(syllabus)
        db.commit()
        db.refresh(syllabus)
        return syllabus
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI syllabus analysis failed: {str(e)}")


@router.put("/syllabi/{syllabus_id}/progress")
def update_syllabus_progress(syllabus_id: int, completed_topics: int, db: Session = Depends(get_db)):
    """Update syllabus completion progress."""
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    syllabus.completed_topics = completed_topics
    syllabus.completion_percentage = (completed_topics / syllabus.total_topics) * 100 if syllabus.total_topics > 0 else 0
    syllabus.last_updated = datetime.utcnow()
    
    db.commit()
    db.refresh(syllabus)
    return syllabus


@router.post("/syllabi/{syllabus_id}/extract-deadlines")
def extract_syllabus_deadlines(syllabus_id: int, db: Session = Depends(get_db)):
    """
    Extract deadlines from a syllabus and create them in the deadlines table.
    """
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    if not syllabus.syllabus_text:
        raise HTTPException(status_code=400, detail="No syllabus text to analyze")
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
    
    system_prompt = """
    You are a deadline extractor from syllabi. Extract all deadlines, exams, assignment due dates.
    Return a JSON array of objects with:
    - title: Description of the deadline
    - due_date: Date in YYYY-MM-DD format
    - course_code: Course code if mentioned
    """
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama3-8b-8192",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Syllabus content:\n\n{syllabus.syllabus_text}"}
                ],
                "max_tokens": 1000
            }
        )
        response.raise_for_status()
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
        
        import json
        from models import Deadline
        parsed = json.loads(ai_response)
        
        created_count = 0
        for deadline_data in parsed:
            # Check if course exists
            course_code = deadline_data.get("course_code")
            course = None
            if course_code:
                course = db.query(Course).filter(Course.code == course_code).first()
            
            if course or syllabus.course_id:
                new_deadline = Deadline(
                    title=deadline_data.get("title", "Syllabus Deadline"),
                    course_id=course.id if course else syllabus.course_id,
                    due_datetime=datetime.strptime(deadline_data.get("due_date", "2026-12-31"), "%Y-%m-%d"),
                    platform="Syllabus",
                    status="pending"
                )
                db.add(new_deadline)
                created_count += 1
        
        db.commit()
        return {"message": f"Created {created_count} deadlines from syllabus", "count": created_count}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deadline extraction failed: {str(e)}")


# Course Recommendation Endpoints
@router.post("/recommendations", response_model=CourseRecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_course_recommendation(recommendation: CourseRecommendationCreate, db: Session = Depends(get_db)):
    """Create a course recommendation."""
    new_recommendation = CourseRecommendation(**recommendation.dict())
    db.add(new_recommendation)
    db.commit()
    db.refresh(new_recommendation)
    return new_recommendation


@router.get("/recommendations", response_model=List[CourseRecommendationResponse])
def get_course_recommendations(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get all course recommendations, optionally filtered."""
    query = db.query(CourseRecommendation)
    
    if course_id:
        query = query.filter(CourseRecommendation.course_id == course_id)
    
    return query.order_by(CourseRecommendation.created_at.desc()).all()


@router.post("/recommendations/generate", response_model=List[CourseRecommendationResponse])
def generate_course_recommendations(db: Session = Depends(get_db)):
    """
    AI-generate course recommendations based on current performance.
    """
    # Get all courses and their marks
    courses = db.query(Course).all()
    
    recommendations = []
    
    for course in courses:
        marks = db.query(Mark).filter(Mark.course_id == course.id).all()
        if not marks:
            continue
        
        average_score = sum(m.obtained for m in marks if m.obtained) / len(marks)
        
        # Generate recommendations based on performance
        if average_score >= 90:
            rec_type = "advanced"
            reason = f"Excellent performance in {course.code} - consider advanced courses"
            confidence = 0.9
        elif average_score >= 75:
            rec_type = "elective"
            reason = f"Good performance in {course.code} - consider related electives"
            confidence = 0.8
        elif average_score < 60:
            rec_type = "remedial"
            reason = f"Needs improvement in {course.code} - consider remedial work"
            confidence = 0.7
        else:
            continue
        
        recommendation = CourseRecommendation(
            course_id=course.id,
            recommendation_type=rec_type,
            reason=reason,
            confidence=confidence
        )
        db.add(recommendation)
        recommendations.append(recommendation)
    
    db.commit()
    
    for rec in recommendations:
        db.refresh(rec)
    
    return recommendations


# Prerequisite Check Endpoints
@router.post("/prerequisites/check", response_model=List[PrerequisiteCheckResponse])
def check_prerequisites(course_id: int, db: Session = Depends(get_db)):
    """
    Check if prerequisites are satisfied for a course.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Simplified prerequisite checking - in real system, would have prerequisite mapping
    # For now, check if user has good grades in foundational courses
    foundational_courses = db.query(Course).filter(
        Course.code.like("CSC1%") | Course.code.like("HUM1%")
    ).all()
    
    checks = []
    
    for found_course in foundational_courses:
        marks = db.query(Mark).filter(Mark.course_id == found_course.id).all()
        if marks:
            average_score = sum(m.obtained for m in marks if m.obtained) / len(marks)
            grade = "A" if average_score >= 90 else "B" if average_score >= 80 else "C" if average_score >= 70 else "D"
            
            check = PrerequisiteCheck(
                course_id=course_id,
                prerequisite_course_id=found_course.id,
                prerequisite_course_code=found_course.code,
                is_satisfied=average_score >= 60,
                minimum_grade_required="C",
                actual_grade=grade,
                notes=f"Average score: {average_score:.1f}%"
            )
            db.add(check)
            checks.append(check)
    
    db.commit()
    
    for check in checks:
        db.refresh(check)
    
    return checks


@router.get("/prerequisites", response_model=List[PrerequisiteCheckResponse])
def get_prerequisite_checks(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get all prerequisite checks, optionally filtered."""
    query = db.query(PrerequisiteCheck)
    
    if course_id:
        query = query.filter(PrerequisiteCheck.course_id == course_id)
    
    return query.order_by(PrerequisiteCheck.checked_at.desc()).all()
