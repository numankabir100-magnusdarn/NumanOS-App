from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import os
import requests

from database import get_db
from models import DocumentSummary, DocumentTag, DocumentContent, DocumentReference

router = APIRouter(prefix="/document-intelligence", tags=["document-intelligence"])


# Pydantic Schemas
class DocumentSummaryCreate(BaseModel):
    file_path: Optional[str] = None
    document_id: Optional[int] = None
    summary_text: str
    key_points: Optional[str] = None
    topics: Optional[str] = None
    difficulty_level: str = "medium"


class DocumentSummaryResponse(BaseModel):
    id: int
    document_id: Optional[int]
    file_path: Optional[str]
    summary_text: str
    key_points: Optional[str]
    topics: Optional[str]
    difficulty_level: str
    estimated_reading_time: int
    created_at: datetime
    ai_generated: bool
    
    class Config:
        from_attributes = True


class DocumentTagCreate(BaseModel):
    file_path: Optional[str] = None
    document_id: Optional[int] = None
    tag_name: str
    tag_category: str = "general"
    confidence: float = 1.0


class DocumentTagResponse(BaseModel):
    id: int
    document_id: Optional[int]
    file_path: Optional[str]
    tag_name: str
    tag_category: str
    confidence: float
    ai_generated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentContentCreate(BaseModel):
    file_path: Optional[str] = None
    document_id: Optional[int] = None
    content_type: str
    content_value: str
    context: Optional[str] = None
    page_number: Optional[int] = None


class DocumentContentResponse(BaseModel):
    id: int
    document_id: Optional[int]
    file_path: Optional[str]
    content_type: str
    content_value: str
    context: Optional[str]
    page_number: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentReferenceCreate(BaseModel):
    source_file_path: Optional[str] = None
    source_document_id: Optional[int] = None
    target_file_path: Optional[str] = None
    target_document_id: Optional[int] = None
    reference_type: str
    similarity_score: float = 0.0
    reason: Optional[str] = None


class DocumentReferenceResponse(BaseModel):
    id: int
    source_document_id: Optional[int]
    source_file_path: Optional[str]
    target_document_id: Optional[int]
    target_file_path: Optional[str]
    reference_type: str
    similarity_score: float
    reason: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Document Summary Endpoints
@router.post("/summaries", response_model=DocumentSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_document_summary(summary: DocumentSummaryCreate, db: Session = Depends(get_db)):
    """Create a document summary."""
    # Estimate reading time (rough estimate: 200 words per minute)
    word_count = len(summary.summary_text.split())
    estimated_time = max(1, word_count // 200)
    
    new_summary = DocumentSummary(
        **summary.dict(),
        estimated_reading_time=estimated_time
    )
    db.add(new_summary)
    db.commit()
    db.refresh(new_summary)
    return new_summary


@router.get("/summaries", response_model=List[DocumentSummaryResponse])
def get_document_summaries(file_path: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all document summaries, optionally filtered by file path."""
    query = db.query(DocumentSummary)
    
    if file_path:
        query = query.filter(DocumentSummary.file_path == file_path)
    
    return query.order_by(DocumentSummary.created_at.desc()).all()


@router.post("/summaries/generate", response_model=DocumentSummaryResponse)
def generate_document_summary(file_path: str, db: Session = Depends(get_db)):
    """
    AI-generate a document summary using Groq.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Read file content
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    # Truncate if too long
    if len(content) > 10000:
        content = content[:10000] + "... [truncated]"
    
    # Call Groq for summarization
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
    
    system_prompt = """
    You are an academic document summarizer. Summarize the given document content.
    Return a JSON object with:
    - summary: A concise 2-3 sentence summary
    - key_points: Array of 3-5 key points
    - topics: Array of 2-4 main topics
    - difficulty: "beginner", "intermediate", or "advanced"
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
                    {"role": "user", "content": f"Document content:\n\n{content}"}
                ],
                "max_tokens": 1000
            }
        )
        response.raise_for_status()
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
        
        # Parse JSON response (simplified - would need better parsing in production)
        import json
        parsed = json.loads(ai_response)
        
        word_count = len(content.split())
        estimated_time = max(1, word_count // 200)
        
        summary = DocumentSummary(
            file_path=file_path,
            summary_text=parsed.get("summary", ""),
            key_points=json.dumps(parsed.get("key_points", [])),
            topics=json.dumps(parsed.get("topics", [])),
            difficulty_level=parsed.get("difficulty", "medium"),
            estimated_reading_time=estimated_time,
            ai_generated=True
        )
        
        db.add(summary)
        db.commit()
        db.refresh(summary)
        return summary
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summarization failed: {str(e)}")


# Document Tag Endpoints
@router.post("/tags", response_model=DocumentTagResponse, status_code=status.HTTP_201_CREATED)
def create_document_tag(tag: DocumentTagCreate, db: Session = Depends(get_db)):
    """Create a document tag."""
    new_tag = DocumentTag(**tag.dict())
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag


@router.get("/tags", response_model=List[DocumentTagResponse])
def get_document_tags(file_path: Optional[str] = None, tag_category: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all document tags, optionally filtered."""
    query = db.query(DocumentTag)
    
    if file_path:
        query = query.filter(DocumentTag.file_path == file_path)
    if tag_category:
        query = query.filter(DocumentTag.tag_category == tag_category)
    
    return query.order_by(DocumentTag.created_at.desc()).all()


@router.post("/tags/generate", response_model=List[DocumentTagResponse])
def generate_document_tags(file_path: str, db: Session = Depends(get_db)):
    """
    AI-generate document tags using Groq.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Read file content
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    if len(content) > 5000:
        content = content[:5000] + "... [truncated]"
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
    
    system_prompt = """
    You are an academic document tagger. Generate relevant tags for the given document.
    Return a JSON array of objects with:
    - tag_name: The tag text
    - tag_category: "topic", "importance", "type", or "general"
    - confidence: 0.0 to 1.0
    
    Generate 5-8 relevant tags.
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
                    {"role": "user", "content": f"Document content:\n\n{content}"}
                ],
                "max_tokens": 500
            }
        )
        response.raise_for_status()
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
        
        import json
        parsed = json.loads(ai_response)
        
        tags = []
        for tag_data in parsed:
            tag = DocumentTag(
                file_path=file_path,
                tag_name=tag_data.get("tag_name", ""),
                tag_category=tag_data.get("tag_category", "general"),
                confidence=tag_data.get("confidence", 1.0),
                ai_generated=True
            )
            db.add(tag)
            tags.append(tag)
        
        db.commit()
        
        for tag in tags:
            db.refresh(tag)
        
        return tags
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI tagging failed: {str(e)}")


# Document Content Endpoints
@router.post("/content", response_model=DocumentContentResponse, status_code=status.HTTP_201_CREATED)
def create_document_content(content: DocumentContentCreate, db: Session = Depends(get_db)):
    """Create extracted document content."""
    new_content = DocumentContent(**content.dict())
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return new_content


@router.get("/content", response_model=List[DocumentContentResponse])
def get_document_content(file_path: Optional[str] = None, content_type: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all document content, optionally filtered."""
    query = db.query(DocumentContent)
    
    if file_path:
        query = query.filter(DocumentContent.file_path == file_path)
    if content_type:
        query = query.filter(DocumentContent.content_type == content_type)
    
    return query.order_by(DocumentContent.created_at.desc()).all()


@router.post("/content/extract", response_model=List[DocumentContentResponse])
def extract_document_content(file_path: str, db: Session = Depends(get_db)):
    """
    AI-extract key content (formulas, definitions, concepts) from document.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    if len(content) > 5000:
        content = content[:5000] + "... [truncated]"
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not found")
    
    system_prompt = """
    You are an academic content extractor. Extract key content from the document.
    Return a JSON array of objects with:
    - content_type: "formula", "definition", "concept", or "example"
    - content_value: The actual content
    - context: Brief context (optional)
    
    Extract 3-5 key items.
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
                    {"role": "user", "content": f"Document content:\n\n{content}"}
                ],
                "max_tokens": 1000
            }
        )
        response.raise_for_status()
        data = response.json()
        ai_response = data["choices"][0]["message"]["content"]
        
        import json
        parsed = json.loads(ai_response)
        
        extracted_content = []
        for item in parsed:
            content = DocumentContent(
                file_path=file_path,
                content_type=item.get("content_type", "concept"),
                content_value=item.get("content_value", ""),
                context=item.get("context"),
                ai_generated=True
            )
            db.add(content)
            extracted_content.append(content)
        
        db.commit()
        
        for content in extracted_content:
            db.refresh(content)
        
        return extracted_content
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI content extraction failed: {str(e)}")


# Document Reference Endpoints
@router.post("/references", response_model=DocumentReferenceResponse, status_code=status.HTTP_201_CREATED)
def create_document_reference(reference: DocumentReferenceCreate, db: Session = Depends(get_db)):
    """Create a document reference."""
    new_reference = DocumentReference(**reference.dict())
    db.add(new_reference)
    db.commit()
    db.refresh(new_reference)
    return new_reference


@router.get("/references", response_model=List[DocumentReferenceResponse])
def get_document_references(source_file_path: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all document references, optionally filtered."""
    query = db.query(DocumentReference)
    
    if source_file_path:
        query = query.filter(DocumentReference.source_file_path == source_file_path)
    
    return query.order_by(DocumentReference.created_at.desc()).all()


@router.post("/references/find-similar", response_model=List[DocumentReferenceResponse])
def find_similar_documents(file_path: str, db: Session = Depends(get_db)):
    """
    AI-find similar documents and create references.
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(file_path, 'r', encoding='latin-1') as f:
            content = f.read()
    
    if len(content) > 3000:
        content = content[:3000]
    
    # Get other documents (simplified - would need to query document table)
    # For now, return empty since we don't have a document list
    return []
