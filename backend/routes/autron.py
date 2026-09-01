import json
import os
from datetime import datetime
from typing import Optional

import yaml
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import AutronActivity, AutronLLMConfig, PendingReview, Skill

router = APIRouter(tags=["autron"])

DEFAULT_FLAG_PATH = r"C:\Users\Numan Kabir\Desktop\Autron\enabled.flag"


def get_flag_path() -> str:
    return os.environ.get("AUTRON_FLAG_PATH", DEFAULT_FLAG_PATH)


def read_enabled_flag() -> bool:
    flag_path = get_flag_path()
    if not os.path.exists(flag_path):
        return False
    try:
        with open(flag_path, "r", encoding="utf-8") as f:
            return f.read().strip().lower() == "true"
    except OSError:
        return False


def write_enabled_flag(enabled: bool) -> None:
    flag_path = get_flag_path()
    os.makedirs(os.path.dirname(flag_path), exist_ok=True)
    with open(flag_path, "w", encoding="utf-8") as f:
        f.write("true" if enabled else "false")


def parse_skill_markdown(content: str) -> tuple[str, str, str]:
    name = None
    description = ""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = yaml.safe_load(parts[1]) or {}
            name = frontmatter.get("name")
            description = frontmatter.get("description") or ""
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill markdown must include 'name' in YAML frontmatter",
        )
    return name, description, content


def log_activity(db: Session, summary: str, source: str = "autron") -> None:
    db.add(AutronActivity(summary=summary, source=source))
    db.commit()


def get_or_create_llm_config(db: Session) -> AutronLLMConfig:
    config = db.query(AutronLLMConfig).filter(AutronLLMConfig.id == 1).first()
    if not config:
        config = AutronLLMConfig(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


class SkillSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SkillDetail(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityCreate(BaseModel):
    summary: str
    source: Optional[str] = "autron"


class ActivityResponse(BaseModel):
    id: int
    timestamp: datetime
    summary: str
    source: Optional[str] = None

    class Config:
        from_attributes = True


class PendingReviewCreate(BaseModel):
    action: str = Field(validation_alias="action")
    args: dict = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class PendingReviewResponse(BaseModel):
    id: int
    timestamp: datetime
    action_name: str
    action_args: dict
    status: str

    class Config:
        from_attributes = True


class ToggleRequest(BaseModel):
    enabled: bool


class StatusResponse(BaseModel):
    enabled: bool
    flag_path: str


class LLMConfigResponse(BaseModel):
    provider: str
    model: str
    api_key_set: bool = False
    fallback_provider: Optional[str] = None
    fallback_model: Optional[str] = None


class LLMConfigUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    fallback_provider: Optional[str] = None
    fallback_model: Optional[str] = None


@router.get("/skills", response_model=list[SkillSummary])
def list_skills(db: Session = Depends(get_db)):
    skills = db.query(Skill).order_by(Skill.name).all()
    return skills


@router.get("/skills/{name}", response_model=SkillDetail)
def get_skill(name: str, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.name == name).first()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill '{name}' not found",
        )
    return skill


@router.post("/skills", response_model=SkillDetail, status_code=status.HTTP_201_CREATED)
async def upload_skill(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".md"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .md files are accepted",
        )

    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill file must be valid UTF-8 text",
        ) from exc

    name, description, full_content = parse_skill_markdown(content)

    existing = db.query(Skill).filter(Skill.name == name).first()
    if existing:
        existing.description = description
        existing.content = full_content
        db.commit()
        db.refresh(existing)
        log_activity(db, f"Updated skill: {name}", source="numanos")
        return existing

    skill = Skill(name=name, description=description, content=full_content)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    log_activity(db, f"Uploaded skill: {name}", source="numanos")
    return skill


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: int, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with id {skill_id} not found",
        )
    name = skill.name
    db.delete(skill)
    db.commit()
    log_activity(db, f"Deleted skill: {name}", source="numanos")
    return None


@router.get("/autron/activity", response_model=list[ActivityResponse])
def get_activity(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AutronActivity)
        .order_by(AutronActivity.timestamp.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.post("/autron/activity", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, db: Session = Depends(get_db)):
    entry = AutronActivity(summary=payload.summary, source=payload.source)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/autron/pending-review", response_model=list[PendingReviewResponse])
def get_pending_review(db: Session = Depends(get_db)):
    rows = (
        db.query(PendingReview)
        .filter(PendingReview.status == "pending")
        .order_by(PendingReview.timestamp.desc())
        .all()
    )
    return [
        PendingReviewResponse(
            id=row.id,
            timestamp=row.timestamp,
            action_name=row.action_name,
            action_args=json.loads(row.action_args),
            status=row.status,
        )
        for row in rows
    ]


@router.post("/autron/pending-review", response_model=PendingReviewResponse, status_code=status.HTTP_201_CREATED)
def create_pending_review(payload: PendingReviewCreate, db: Session = Depends(get_db)):
    entry = PendingReview(
        action_name=payload.action,
        action_args=json.dumps(payload.args),
        status="pending",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_activity(
        db,
        f"Queued for review: {payload.action} {json.dumps(payload.args)}",
        source="autron",
    )
    return PendingReviewResponse(
        id=entry.id,
        timestamp=entry.timestamp,
        action_name=entry.action_name,
        action_args=payload.args,
        status=entry.status,
    )


@router.post("/autron/pending-review/{review_id}/approve")
def approve_pending_review(review_id: int, db: Session = Depends(get_db)):
    entry = db.query(PendingReview).filter(PendingReview.id == review_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pending review item {review_id} not found",
        )
    if entry.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Review item is already {entry.status}",
        )

    entry.status = "approved"
    db.commit()
    log_activity(
        db,
        f"Approved action: {entry.action_name} (review #{review_id})",
        source="numanos",
    )
    return {
        "id": entry.id,
        "status": entry.status,
        "message": "Action approved and logged. Execution wiring comes in a later phase.",
    }


@router.post("/autron/pending-review/{review_id}/reject")
def reject_pending_review(review_id: int, db: Session = Depends(get_db)):
    entry = db.query(PendingReview).filter(PendingReview.id == review_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pending review item {review_id} not found",
        )
    if entry.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Review item is already {entry.status}",
        )

    entry.status = "rejected"
    db.commit()
    log_activity(
        db,
        f"Rejected action: {entry.action_name} (review #{review_id})",
        source="numanos",
    )
    return {"id": entry.id, "status": entry.status, "message": "Action rejected."}


@router.get("/autron/status", response_model=StatusResponse)
def get_autron_status():
    return StatusResponse(enabled=read_enabled_flag(), flag_path=get_flag_path())


@router.post("/autron/toggle", response_model=StatusResponse)
def toggle_autron(payload: ToggleRequest, db: Session = Depends(get_db)):
    write_enabled_flag(payload.enabled)
    state = "enabled" if payload.enabled else "disabled"
    log_activity(db, f"Autron {state} via NuManOS dashboard", source="numanos")
    return StatusResponse(enabled=payload.enabled, flag_path=get_flag_path())


@router.get("/autron/llm-config", response_model=LLMConfigResponse)
def get_llm_config(db: Session = Depends(get_db)):
    config = get_or_create_llm_config(db)
    return LLMConfigResponse(
        provider=config.provider,
        model=config.model,
        api_key_set=bool(config.api_key),
        fallback_provider=config.fallback_provider,
        fallback_model=config.fallback_model,
    )


@router.post("/autron/llm-config", response_model=LLMConfigResponse)
def update_llm_config(payload: LLMConfigUpdate, db: Session = Depends(get_db)):
    config = get_or_create_llm_config(db)
    if payload.provider is not None:
        config.provider = payload.provider
    if payload.model is not None:
        config.model = payload.model
    if payload.api_key is not None:
        if payload.api_key.strip() != "":
            config.api_key = payload.api_key
    if payload.fallback_provider is not None:
        config.fallback_provider = payload.fallback_provider
    if payload.fallback_model is not None:
        config.fallback_model = payload.fallback_model
    db.commit()
    db.refresh(config)
    log_activity(
        db,
        f"Updated Autron LLM config: {config.provider}/{config.model} (fallback={config.fallback_provider})",
        source="numanos",
    )
    return LLMConfigResponse(
        provider=config.provider,
        model=config.model,
        api_key_set=bool(config.api_key),
        fallback_provider=config.fallback_provider,
        fallback_model=config.fallback_model,
    )


@router.get("/autron/llm-config-secret")
def get_llm_config_secret(db: Session = Depends(get_db)):
    """
    Internal endpoint that returns the actual stored API key.
    Authenticated by localhost-only / same-machine usage pattern.
    """
    config = get_or_create_llm_config(db)
    return {
        "provider": config.provider,
        "model": config.model,
        "api_key": config.api_key,
        "fallback_provider": config.fallback_provider,
        "fallback_model": config.fallback_model,
    }
