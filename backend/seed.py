from datetime import date

from database import Base, SessionLocal, engine
from models import Course, Mark, Semester

THEORY_COMPONENTS = [
    ("quiz", "Quiz Average"),
    ("assignment", "Assignments"),
    ("midterm", "Midterm Exam"),
    ("terminal", "Terminal Exam"),
]

LAB_COMPONENTS = [
    ("lab_assignment", "Lab Assignments"),
    ("lab_midterm", "Lab Midterm"),
    ("lab_terminal", "Lab Terminal"),
]


def create_theory_marks(course_id: int, score: float, mark_date: date) -> list[Mark]:
    return [
        Mark(
            course_id=course_id,
            component_type=component_type,
            title=title,
            obtained=score,
            total=100.0,
            date=mark_date,
        )
        for component_type, title in THEORY_COMPONENTS
    ]


def create_lab_marks(course_id: int, score: float, mark_date: date) -> list[Mark]:
    return [
        Mark(
            course_id=course_id,
            component_type=component_type,
            title=title,
            obtained=score,
            total=100.0,
            date=mark_date,
        )
        for component_type, title in LAB_COMPONENTS
    ]


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(Semester).first()
        if existing:
            print("Database already seeded. Skipping.")
            return

        semester = Semester(name="Spring", year=2026, is_active=True)
        db.add(semester)
        db.flush()

        courses_data = [
            {
                "code": "CSC101",
                "name": "Applications of ICT",
                "credits": 3,
                "theory_weight": 75.0,
                "lab_weight": 25.0,
                "teacher_name": "Umar Iqbal",
                "final_marks": 81.0,
                "has_lab": True,
            },
            {
                "code": "CSC103",
                "name": "Programming Fundamentals",
                "credits": 4,
                "theory_weight": 75.0,
                "lab_weight": 25.0,
                "teacher_name": "Dr. Rasool Bukhsh",
                "final_marks": 74.0,
                "has_lab": True,
            },
            {
                "code": "HUM104",
                "name": "Functional English",
                "credits": 3,
                "theory_weight": 100.0,
                "lab_weight": 0.0,
                "teacher_name": "Maria Khan",
                "final_marks": 87.0,
                "has_lab": False,
            },
            {
                "code": "HUM112",
                "name": "Islamic Studies",
                "credits": 2,
                "theory_weight": 100.0,
                "lab_weight": 0.0,
                "teacher_name": "Sana",
                "final_marks": 90.0,
                "has_lab": False,
            },
            {
                "code": "HUM161",
                "name": "Fehm-e-Quran I",
                "credits": 1,
                "theory_weight": 100.0,
                "lab_weight": 0.0,
                "teacher_name": "Dr. Zainab Sadiq",
                "final_marks": 99.0,
                "has_lab": False,
            },
            {
                "code": "HUM208",
                "name": "Civics & Community Engagement",
                "credits": 2,
                "theory_weight": 100.0,
                "lab_weight": 0.0,
                "teacher_name": "Jasmeen Bangash",
                "final_marks": 83.0,
                "has_lab": False,
            },
            {
                "code": "HUM222",
                "name": "Fundamentals of Int'l Relations",
                "credits": 2,
                "theory_weight": 100.0,
                "lab_weight": 0.0,
                "teacher_name": "Muhammad Younas",
                "final_marks": 77.0,
                "has_lab": False,
            },
        ]

        result_date = date(2026, 6, 15)

        for course_data in courses_data:
            course = Course(
                semester_id=semester.id,
                code=course_data["code"],
                name=course_data["name"],
                credits=course_data["credits"],
                theory_weight=course_data["theory_weight"],
                lab_weight=course_data["lab_weight"],
                teacher_name=course_data["teacher_name"],
            )
            db.add(course)
            db.flush()

            final_marks = course_data["final_marks"]
            db.add_all(create_theory_marks(course.id, final_marks, result_date))

            if course_data["has_lab"]:
                db.add_all(create_lab_marks(course.id, final_marks, result_date))

        db.commit()
        print("Seed complete: Spring 2026 semester with 7 courses loaded.")
        print("Expected CGPA after Semester 1: 3.59")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
