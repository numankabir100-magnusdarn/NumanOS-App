from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class Semester(Base):
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    number = Column(Integer, nullable=True)
    title = Column(String(200), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), default="active", nullable=False)
    archived_at = Column(DateTime, nullable=True)

    courses = relationship("Course", back_populates="semester", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    credits = Column(Integer, nullable=False)
    theory_weight = Column(Float, default=75.0, nullable=False)
    lab_weight = Column(Float, default=25.0, nullable=False)
    teacher_name = Column(String(100), nullable=True)
    teacher_email = Column(String(150), nullable=True)
    submission_pref = Column(String(50), nullable=True)
    teacher_notes = Column(Text, nullable=True)

    semester = relationship("Semester", back_populates="courses")
    marks = relationship("Mark", back_populates="course", cascade="all, delete-orphan")
    deadlines = relationship("Deadline", back_populates="course", cascade="all, delete-orphan")
    attendance_records = relationship(
        "Attendance", back_populates="course", cascade="all, delete-orphan"
    )
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan")


class Mark(Base):
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    component_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    obtained = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    date = Column(Date, nullable=True)

    course = relationship("Course", back_populates="marks")


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(200), nullable=False)
    due_datetime = Column(DateTime, nullable=False)
    platform = Column(String(100), nullable=True)
    link = Column(String(500), nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    marks_obtained = Column(Float, nullable=True)

    course = relationship("Course", back_populates="deadlines")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)

    course = relationship("Course", back_populates="attendance_records")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    category = Column(String(100), nullable=True)
    tags = Column(String(500), nullable=True)

    course = relationship("Course", back_populates="documents")


class DocumentDecision(Base):
    __tablename__ = "document_decisions"

    decision_id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    extracted_features = Column(Text, nullable=True)
    chosen_path = Column(String(200), nullable=False)
    rule_id_used = Column(Integer, ForeignKey("document_rules.rule_id"), nullable=True)
    outcome = Column(String(20), default="pending", nullable=False)
    weight_delta = Column(Float, default=0.0, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    ai_analyzed = Column(Boolean, default=False, nullable=False)

    rule = relationship("DocumentRule", back_populates="decisions")


class DocumentRule(Base):
    __tablename__ = "document_rules"

    rule_id = Column(Integer, primary_key=True, index=True)
    pattern_signature = Column(String(500), nullable=False, unique=True, index=True)
    target_module = Column(String(200), nullable=False)
    confidence_weight = Column(Float, default=0.5, nullable=False)
    gain_count = Column(Integer, default=0, nullable=False)
    loss_count = Column(Integer, default=0, nullable=False)
    last_outcome = Column(String(50), nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False)

    decisions = relationship("DocumentDecision", back_populates="rule")


class AutronActivity(Base):
    __tablename__ = "autron_activity"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    summary = Column(Text, nullable=False)
    source = Column(String(50), default="autron", nullable=True)


class AutronLLMConfig(Base):
    __tablename__ = "autron_llm_config"

    id = Column(Integer, primary_key=True, default=1)
    provider = Column(String(100), default="groq", nullable=False)
    model = Column(String(100), default="llama3-8b-8192", nullable=False)
    api_key = Column(String(500), nullable=True)
    fallback_provider = Column(String(100), nullable=True)
    fallback_model = Column(String(100), nullable=True)


class PendingReview(Base):
    __tablename__ = "pending_reviews"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    action_name = Column(String(200), nullable=False)
    action_args = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentSummary(Base):
    __tablename__ = "document_summaries"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)
    summary_text = Column(Text, nullable=False)
    key_points = Column(Text, nullable=True)
    topics = Column(Text, nullable=True)
    difficulty_level = Column(String(50), default="medium", nullable=False)
    estimated_reading_time = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ai_generated = Column(Boolean, default=False, nullable=False)


class DocumentTag(Base):
    __tablename__ = "document_tags"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)
    tag_name = Column(String(200), nullable=False)
    tag_category = Column(String(100), default="general", nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    ai_generated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentContent(Base):
    __tablename__ = "document_content"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)
    content_type = Column(String(100), nullable=False)
    content_value = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    ai_generated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentReference(Base):
    __tablename__ = "document_references"

    id = Column(Integer, primary_key=True, index=True)
    source_document_id = Column(Integer, nullable=True)
    source_file_path = Column(String(500), nullable=True)
    target_document_id = Column(Integer, nullable=True)
    target_file_path = Column(String(500), nullable=True)
    reference_type = Column(String(100), nullable=False)
    similarity_score = Column(Float, default=0.0, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Syllabus(Base):
    __tablename__ = "syllabi"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, nullable=True)
    syllabus_text = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    total_topics = Column(Integer, default=0, nullable=False)
    completed_topics = Column(Integer, default=0, nullable=False)
    completion_percentage = Column(Float, default=0.0, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False)
    ai_analyzed = Column(Boolean, default=False, nullable=False)


class CourseRecommendation(Base):
    __tablename__ = "course_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, nullable=True)
    recommendation_type = Column(String(100), nullable=False)
    reason = Column(Text, nullable=True)
    confidence = Column(Float, default=0.0, nullable=False)
    suggested_semester = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PrerequisiteCheck(Base):
    __tablename__ = "prerequisite_checks"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, nullable=True)
    prerequisite_course_id = Column(Integer, nullable=True)
    prerequisite_course_code = Column(String(20), nullable=True)
    is_satisfied = Column(Boolean, default=False, nullable=False)
    minimum_grade_required = Column(String(20), nullable=True)
    actual_grade = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
