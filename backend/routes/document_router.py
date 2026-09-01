from datetime import datetime
from typing import Optional
import re
import logging
import traceback
import sys

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import DocumentDecision, DocumentRule
from utils.document_analyzer import analyze_document

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])

# Valid courses and categories from frontend
VALID_COURSES = [
    "CSC101", "CSC103", "HUM104", "HUM112", "HUM161", "HUM208", "HUM222",
    "CSC201", "CSC203", "BIO201", "ENG201", "ENG202", "HUM261"
]

VALID_CATEGORIES = [
    "lecture_notes", "assignment", "past_paper", "reference", "lab_work", "quick_reference"
]

# Stopwords for keyword extraction
STOPWORDS = {'the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'}


class RouteRequest(BaseModel):
    file_name: str
    extracted_features: dict
    file_content: Optional[str] = None


class RouteResponse(BaseModel):
    chosen_path: str
    decision_id: int
    confidence_weight: float
    needs_manual_review: bool
    ai_analyzed: bool = False


class OutcomeRequest(BaseModel):
    decision_id: int
    outcome: str
    override_target: Optional[str] = None


class RuleResponse(BaseModel):
    rule_id: int
    pattern_signature: str
    target_module: str
    confidence_weight: float
    gain_count: int
    loss_count: int
    last_outcome: Optional[str]
    last_updated: datetime


class DecisionResponse(BaseModel):
    decision_id: int
    file_name: str
    chosen_path: str
    outcome: str
    weight_delta: float
    timestamp: datetime
    rule_id: Optional[int]
    pattern_signature: Optional[str]


def extract_course_code(filename: str) -> Optional[str]:
    """Extract course code from filename using regex."""
    match = re.search(r'(CSC|HUM|BIO|ENG)\d{3}', filename, re.IGNORECASE)
    if match:
        return match.group(0).upper()
    return None


def extract_top_keyword(filename: str) -> str:
    """Extract top keyword from filename by removing extension, splitting, filtering stopwords."""
    # Remove extension
    name_without_ext = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Split by non-alphanumeric characters
    words = re.split(r'[^a-zA-Z0-9]+', name_without_ext)
    
    # Filter out stopwords and empty strings, keep only alphanumeric
    filtered_words = [
        word.lower() for word in words 
        if word and word.lower() not in STOPWORDS and word.isalnum()
    ]
    
    # Take the longest remaining word
    if filtered_words:
        return max(filtered_words, key=len)
    
    return "general"


def build_pattern_signature(file_type: str, course_code: Optional[str], top_keyword: str) -> str:
    """Build pattern signature from file type, course code, and keyword."""
    return f"{file_type}:{course_code or 'unknown'}:{top_keyword}"


def find_closest_match(signature: str, valid_values: list[str]) -> str:
    """Find closest matching value from valid list using simple string similarity."""
    signature_lower = signature.lower()
    
    for value in valid_values:
        if value.lower() in signature_lower or signature_lower in value.lower():
            return value
    
    # Try partial matching
    for value in valid_values:
        if any(word in value.lower() for word in signature_lower.split(":")):
            return value
    
    return "Uncategorized"


@router.post("/documents/route", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
def route_document(payload: RouteRequest, db: Session = Depends(get_db)):
    try:
        print(f"[ROUTE] Received file_name: {payload.file_name}")
        print(f"[ROUTE] file_content length: {len(payload.file_content) if payload.file_content else 0}")
        logger.info(f"Routing document: {payload.file_name}")
        
        # Extract features from filename
        file_type = payload.extracted_features.get("file_type", "unknown")
        course_code = extract_course_code(payload.file_name)
        top_keyword = extract_top_keyword(payload.file_name)
        
        # Use regex-first analysis if file content is provided
        ai_analysis = None
        content_was_provided = False
        if payload.file_content:
            content_was_provided = True
            try:
                logger.info("Performing regex-first document analysis")
                ai_analysis = analyze_document(payload.file_content, file_type)
                
                # Use analysis results regardless of whether AI was used
                # (regex results are in ai_analysis even when ai_used=False)
                if ai_analysis:
                    logger.info(f"Analysis result: ai_used={ai_analysis.get('ai_used')}, course={ai_analysis.get('course_code')}, keyword={ai_analysis.get('keyword')}")
                    
                    # Use extracted features if valid
                    if ai_analysis.get("course_code") and ai_analysis.get("course_code") in VALID_COURSES:
                        course_code = ai_analysis.get("course_code")
                        logger.info(f"Using extracted course code: {course_code}")
                    
                    if ai_analysis.get("keyword"):
                        top_keyword = ai_analysis.get("keyword")
                        logger.info(f"Using extracted keyword: {top_keyword}")
            except Exception as e:
                logger.warning(f"Document analysis failed: {e}, falling back to filename extraction")
        
        # If content was provided but analysis failed to extract anything meaningful,
        # don't fallback to filename - mark as unreadable
        if content_was_provided and ai_analysis:
            if not ai_analysis.get("course_code") and not ai_analysis.get("keyword"):
                logger.warning("Content was provided but analysis extracted nothing. Marking as unreadable.")
                course_code = None
                top_keyword = "unreadable"
        
        # Build pattern signature with proper format (no pdf:pdf)
        pattern_signature = build_pattern_signature(file_type, course_code, top_keyword)
        logger.info(f"Pattern signature: {pattern_signature}")
        
        # Look for existing rule
        rule = db.query(DocumentRule).filter(
            DocumentRule.pattern_signature == pattern_signature
        ).first()
        
        if rule:
            chosen_path = rule.target_module
            rule_id = rule.rule_id
            confidence = rule.confidence_weight
            needs_review = confidence < 0.4
            logger.info(f"Found existing rule: {rule.rule_id}, confidence: {confidence}")
        else:
            # Create new rule with intelligent target selection
            target_module = "Uncategorized"
            
            # If marked as unreadable, use low confidence and route to Uncategorized
            if top_keyword == "unreadable":
                logger.info("Document marked as unreadable, routing to Uncategorized with low confidence")
                target_module = "Uncategorized"
                confidence = 0.1
            else:
                # Try analysis-suggested target first (regex or AI)
                if ai_analysis and ai_analysis.get("target") and ai_analysis.get("target") in VALID_COURSES + VALID_CATEGORIES:
                    target_module = ai_analysis.get("target")
                    logger.info(f"Using analysis-suggested target: {target_module}")
                elif course_code and course_code in VALID_COURSES:
                    target_module = course_code
                    logger.info(f"Using course code as target: {target_module}")
                else:
                    # Try to find closest course match
                    target_module = find_closest_match(pattern_signature, VALID_COURSES)
                    if target_module == "Uncategorized":
                        # Try categories
                        target_module = find_closest_match(pattern_signature, VALID_CATEGORIES)
                    logger.info(f"Using matched target: {target_module}")
                confidence = 0.5
            
            rule = DocumentRule(
                pattern_signature=pattern_signature,
                target_module=target_module,
                confidence_weight=confidence,
                gain_count=0,
                loss_count=0,
                last_updated=datetime.utcnow()
            )
            db.add(rule)
            db.commit()
            db.refresh(rule)
            
            chosen_path = target_module
            rule_id = rule.rule_id
            needs_review = confidence < 0.4
            logger.info(f"Created new rule: {rule.rule_id}, confidence: {confidence}")
        
        # Prepare extracted features for storage
        features_to_store = {
            **payload.extracted_features,
            "ai_used": ai_analysis.get("ai_used", False) if ai_analysis else False,
            "ai_response": ai_analysis.get("ai_response") if ai_analysis else None,
            "course_code": course_code,
            "top_keyword": top_keyword,
            "pattern_signature": pattern_signature
        }
        
        # Create decision record
        decision = DocumentDecision(
            file_name=payload.file_name,
            extracted_features=str(features_to_store),
            chosen_path=chosen_path,
            rule_id_used=rule_id,
            outcome="pending",
            weight_delta=0.0,
            timestamp=datetime.utcnow(),
            ai_analyzed=ai_analysis.get("ai_used", False) if ai_analysis else False
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)
        
        logger.info(f"Created decision: {decision.decision_id}")
        
        return RouteResponse(
            chosen_path=chosen_path,
            decision_id=decision.decision_id,
            confidence_weight=confidence,
            needs_manual_review=needs_review,
            ai_analyzed=ai_analysis.get("ai_used", False) if ai_analysis else False
        )
        
    except Exception as e:
        # Write crash log to file
        with open("C:\\Users\\Numan Kabir\\Desktop\\NuManOS\\backend\\crash_log.txt", "w") as f:
            f.write(f"ERROR: {e}\n")
            f.write(traceback.format_exc())
        # Re-raise so FastAPI still returns 500, but we have the log
        raise


@router.post("/documents/outcome", response_model=RuleResponse)
def record_outcome(payload: OutcomeRequest, db: Session = Depends(get_db)):
    logger.info(f"Recording outcome for decision {payload.decision_id}: {payload.outcome}")
    
    decision = db.query(DocumentDecision).filter(
        DocumentDecision.decision_id == payload.decision_id
    ).first()
    
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )
    
    if payload.outcome not in ["gain", "loss"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outcome must be 'gain' or 'loss'"
        )
    
    # Update decision
    decision.outcome = payload.outcome
    
    # Update rule if linked
    if decision.rule_id_used:
        rule = db.query(DocumentRule).filter(
            DocumentRule.rule_id == decision.rule_id_used
        ).first()
        
        if rule:
            old_confidence = rule.confidence_weight
            
            if payload.outcome == "gain":
                rule.confidence_weight = min(1.0, rule.confidence_weight + 0.1)
                rule.gain_count += 1
                logger.info(f"Rule {rule.rule_id}: gain, confidence {old_confidence} -> {rule.confidence_weight}")
            else:  # loss
                if payload.override_target:
                    # Override target and reset confidence
                    rule.target_module = payload.override_target
                    rule.confidence_weight = 0.5
                    rule.loss_count += 1
                    logger.info(f"Rule {rule.rule_id}: loss with override, target -> {payload.override_target}, confidence reset to 0.5")
                else:
                    # Standard decrement
                    rule.confidence_weight = max(0.0, rule.confidence_weight - 0.15)
                    rule.loss_count += 1
                    logger.info(f"Rule {rule.rule_id}: loss, confidence {old_confidence} -> {rule.confidence_weight}")
            
            rule.last_outcome = payload.outcome
            rule.last_updated = datetime.utcnow()
            
            decision.weight_delta = rule.confidence_weight - old_confidence
    
    db.commit()
    db.refresh(decision)
    
    if decision.rule_id_used:
        db.refresh(rule)
        return RuleResponse(
            rule_id=rule.rule_id,
            pattern_signature=rule.pattern_signature,
            target_module=rule.target_module,
            confidence_weight=rule.confidence_weight,
            gain_count=rule.gain_count,
            loss_count=rule.loss_count,
            last_outcome=rule.last_outcome,
            last_updated=rule.last_updated
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No rule associated with this decision"
        )


@router.get("/documents/rules", response_model=list[RuleResponse])
def get_all_rules(db: Session = Depends(get_db)):
    rules = db.query(DocumentRule).order_by(
        DocumentRule.confidence_weight.desc()
    ).all()
    return rules


@router.get("/documents/decisions/recent", response_model=list[DecisionResponse])
def get_recent_decisions(limit: int = 20, db: Session = Depends(get_db)):
    decisions = db.query(DocumentDecision).order_by(
        DocumentDecision.timestamp.desc()
    ).limit(limit).all()
    
    result = []
    for decision in decisions:
        pattern_sig = None
        if decision.rule:
            pattern_sig = decision.rule.pattern_signature
        
        result.append(DecisionResponse(
            decision_id=decision.decision_id,
            file_name=decision.file_name,
            chosen_path=decision.chosen_path,
            outcome=decision.outcome,
            weight_delta=decision.weight_delta,
            timestamp=decision.timestamp,
            rule_id=decision.rule_id_used,
            pattern_signature=pattern_sig
        ))
    
    return result


@router.post("/documents/migrate-rules")
def migrate_rules(db: Session = Depends(get_db)):
    """
    Migrate existing DocumentRule rows with bad pattern signatures.
    Finds rules with duplicate file types (e.g., pdf:pdf) and regenerates signatures.
    """
    logger.info("Starting rule migration")
    
    # Find rules with bad signatures (same file type repeated)
    bad_rules = []
    for rule in db.query(DocumentRule).all():
        parts = rule.pattern_signature.split(':')
        if len(parts) >= 2 and parts[0] == parts[1]:
            bad_rules.append(rule)
    
    logger.info(f"Found {len(bad_rules)} rules with bad signatures")
    
    migrated_count = 0
    deprecated_count = 0
    
    for rule in bad_rules:
        old_signature = rule.pattern_signature
        logger.info(f"Processing rule {rule.rule_id}: {old_signature}")
        
        # Try to find a related decision to get the filename
        decision = db.query(DocumentDecision).filter(
            DocumentDecision.rule_id_used == rule.rule_id
        ).first()
        
        if decision:
            # Re-extract from filename
            file_type = old_signature.split(':')[0]
            course_code = extract_course_code(decision.file_name)
            top_keyword = extract_top_keyword(decision.file_name)
            
            # Build new signature
            new_signature = build_pattern_signature(file_type, course_code, top_keyword)
            
            # Check if new signature already exists
            existing = db.query(DocumentRule).filter(
                DocumentRule.pattern_signature == new_signature
            ).first()
            
            if existing:
                # Mark old rule as deprecated and set low confidence
                rule.pattern_signature = f"DEPRECATED:{old_signature}"
                rule.confidence_weight = 0.1
                rule.last_updated = datetime.utcnow()
                deprecated_count += 1
                logger.info(f"Rule {rule.rule_id} deprecated (new signature already exists)")
            else:
                # Update to new signature
                rule.pattern_signature = new_signature
                rule.last_updated = datetime.utcnow()
                migrated_count += 1
                logger.info(f"Rule {rule.rule_id} migrated: {old_signature} -> {new_signature}")
        else:
            # No decision available, just set low confidence to decay
            rule.confidence_weight = 0.1
            rule.last_updated = datetime.utcnow()
            deprecated_count += 1
            logger.info(f"Rule {rule.rule_id} set to low confidence (no decision available)")
    
    db.commit()
    logger.info(f"Migration complete: {migrated_count} migrated, {deprecated_count} deprecated")
    
    return {
        "migrated": migrated_count,
        "deprecated": deprecated_count,
        "total_processed": len(bad_rules)
    }
