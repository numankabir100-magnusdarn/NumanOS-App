from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from database import Base, engine
from routes.marks import router as marks_router
from routes.courses import router as courses_router
from routes.document_router import router as document_router
from routes.whatsapp_router import router as whatsapp_router
from routes.deadlines import router as deadlines_router
from routes.attendance import router as attendance_router
from routes.autron import router as autron_router
from routes.academic_intelligence import router as academic_intelligence_router
from routes.document_intelligence import router as document_intelligence_router
from routes.course_management import router as course_management_router
from routes.communication_resources import router as communication_resources_router
from routes.semester import router as semester_router

Base.metadata.create_all(bind=engine)


def ensure_schema():
    """Automatically add missing columns to the database on startup."""
    inspector = inspect(engine)
    
    # Check DocumentDecision table
    decision_columns = [col['name'] for col in inspector.get_columns('document_decisions')]
    if 'ai_analyzed' not in decision_columns:
        print("[MIGRATION] Adding column 'ai_analyzed' to document_decisions...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE document_decisions ADD COLUMN ai_analyzed BOOLEAN DEFAULT 0"))
            conn.commit()
        print("[MIGRATION] Column 'ai_analyzed' added.")

    # Check DocumentRule table (Audit: ensure all columns from models.py exist)
    required_rule_columns = ['rule_id', 'pattern_signature', 'target_module', 'confidence_weight', 'gain_count', 'loss_count', 'last_outcome', 'last_updated']
    rule_columns = [col['name'] for col in inspector.get_columns('document_rules')]
    for col in required_rule_columns:
        if col not in rule_columns:
            print(f"[MIGRATION] Adding missing column '{col}' to document_rules...")
            with engine.connect() as conn:
                col_type = "FLOAT" if col in ['confidence_weight', 'weight_delta'] else "INTEGER"
                if col == 'last_outcome':
                    col_type = "VARCHAR(50)"
                elif col == 'last_updated':
                    col_type = "DATETIME"
                conn.execute(text(f"ALTER TABLE document_rules ADD COLUMN {col} {col_type} DEFAULT NULL"))
                conn.commit()

    # Check AutronLLMConfig table (add api_key and fallback_model if missing)
    try:
        llm_columns = [col['name'] for col in inspector.get_columns('autron_llm_config')]
    except Exception:
        llm_columns = []
    for col_def in [
        ("api_key", "VARCHAR(500)"),
        ("fallback_model", "VARCHAR(100)"),
    ]:
        col_name, col_type = col_def
        if col_name not in llm_columns:
            print(f"[MIGRATION] Adding missing column '{col_name}' to autron_llm_config...")
            try:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE autron_llm_config ADD COLUMN {col_name} {col_type} DEFAULT NULL"))
                    conn.commit()
                print(f"[MIGRATION] Column '{col_name}' added.")
            except Exception as exc:
                print(f"[MIGRATION] Warning: failed to add '{col_name}': {exc}")

    # Check Semester table (add wrap-up columns if missing)
    try:
        sem_columns = [col['name'] for col in inspector.get_columns('semesters')]
    except Exception:
        sem_columns = []
    semester_col_defs = [
        ("number", "INTEGER"),
        ("title", "VARCHAR(200)"),
        ("start_date", "DATE"),
        ("end_date", "DATE"),
        ("status", "VARCHAR(20) DEFAULT 'active'"),
        ("archived_at", "DATETIME"),
    ]
    for col_name, col_type in semester_col_defs:
        if col_name not in sem_columns:
            print(f"[MIGRATION] Adding missing column '{col_name}' to semesters...")
            try:
                with engine.connect() as conn:
                    default_clause = ""
                    if col_name == "status":
                        default_clause = ""
                    else:
                        default_clause = " DEFAULT NULL"
                    conn.execute(text(f"ALTER TABLE semesters ADD COLUMN {col_name} {col_type}{default_clause}"))
                    conn.commit()
                print(f"[MIGRATION] Column '{col_name}' added.")
            except Exception as exc:
                print(f"[MIGRATION] Warning: failed to add '{col_name}': {exc}")


# Call this function right after engine creation
ensure_schema()

app = FastAPI(
    title="NuManOS API",
    description="Local academic management system backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(marks_router)
app.include_router(courses_router)
app.include_router(document_router)
app.include_router(whatsapp_router)
app.include_router(deadlines_router)
app.include_router(attendance_router)
app.include_router(autron_router)
app.include_router(academic_intelligence_router)
app.include_router(document_intelligence_router)
app.include_router(course_management_router)
app.include_router(communication_resources_router)
app.include_router(semester_router)


@app.get("/")
def root():
    return {"message": "NuManOS API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
