import base64
import io
import logging
import re
import traceback
from typing import Optional, Dict, Any, Tuple

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from docx import Document
except ImportError:
    Document = None

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

import requests
import json
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Course mapping for regex and AI classification
COURSE_MAPPING = {
    "CSC101": "Applications of ICT",
    "CSC103": "Programming Fundamentals",
    "CSC201": "Object-Oriented Programming",
    "CSC203": "Discrete Mathematics",
    "HUM104": "Functional English",
    "HUM112": "Islamic Studies",
    "HUM161": "Fehm-e-Quran I",
    "HUM208": "Civics & Community Engagement",
    "HUM222": "Fundamentals of Int'l Relations",
    "HUM261": "Fehm-e-Quran II",
    "BIO201": "Bioinformatics",
    "ENG201": "Expository Writing",
    "ENG202": "Literature"
}

# Reverse mapping for regex (course name -> code)
COURSE_NAME_TO_CODE = {v.lower(): k for k, v in COURSE_MAPPING.items()}

CATEGORY_MAPPING = {
    "lecture_notes": "Lecture Notes",
    "assignment": "Assignment",
    "past_paper": "Past Paper",
    "reference": "Reference Material",
    "lab_work": "Lab Work",
    "quick_reference": "Quick Reference"
}

# AI Classification prompt (only used as fallback)
CLASSIFICATION_PROMPT = """
Classify this academic text snippet into:
1. Course code (from: CSC101, CSC103, CSC201, CSC203, HUM104, HUM112, HUM161, HUM208, HUM222, HUM261, BIO201, ENG201, ENG202)
2. A top keyword describing the main topic (single word, lowercase)

Return ONLY a JSON object with this exact format:
{
    "course_code": "CSC103",
    "keyword": "arrays"
}

If you cannot determine a field, use null for that field.
"""


def extract_text_from_pdf(file_bytes: bytes, max_pages: int = 2) -> str:
    """Extract text from first N pages of PDF using pdfplumber with PyPDF2 fallback."""
    text = ""
    
    # Try pdfplumber first
    if pdfplumber is not None:
        try:
            print("[PDF] Attempting to extract text with pdfplumber...")
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for i, page in enumerate(pdf.pages):
                    if i >= max_pages:
                        break
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            
            if text.strip():
                print(f"[PDF] pdfplumber extracted {len(text)} characters successfully")
                return text.strip()
            else:
                print("[WARNING] pdfplumber extracted empty text. Trying PyPDF2 fallback...")
        except Exception as e:
            print(f"[PDF ERROR] pdfplumber failed: {e}")
            traceback.print_exc()
            print("[PDF] Trying PyPDF2 fallback...")
    
    # Fallback to PyPDF2
    if PyPDF2 is not None:
        try:
            print("[PDF] Attempting to extract text with PyPDF2...")
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for i in range(min(max_pages, len(pdf_reader.pages))):
                page = pdf_reader.pages[i]
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if text.strip():
                print(f"[PDF] PyPDF2 extracted {len(text)} characters successfully")
                return text.strip()
            else:
                print("[WARNING] PyPDF2 also extracted empty text")
        except Exception as e:
            print(f"[PDF ERROR] PyPDF2 failed: {e}")
            traceback.print_exc()
    
    print("[PDF ERROR] Both pdfplumber and PyPDF2 failed to extract text")
    return ""


def extract_text_from_docx(file_bytes: bytes, max_paragraphs: int = 50) -> str:
    """Extract text from first N paragraphs of DOCX using python-docx."""
    if Document is None:
        print("[DOCX ERROR] python-docx is not installed")
        return ""
    
    text = ""
    try:
        print("[DOCX] Attempting to extract text with python-docx...")
        doc = Document(io.BytesIO(file_bytes))
        for i, paragraph in enumerate(doc.paragraphs):
            if i >= max_paragraphs:
                break
            text += paragraph.text + "\n"
        
        if text.strip():
            print(f"[DOCX] Extracted {len(text)} characters successfully")
            return text.strip()
        else:
            print("[WARNING] python-docx extracted empty text")
    except Exception as e:
        print(f"[DOCX ERROR] python-docx failed: {e}")
        traceback.print_exc()
    
    return ""


def extract_text_content(file_bytes: bytes, file_type: str) -> str:
    """
    Extract text from file based on file type.
    Limited to first 2 pages or ~2000 characters for token efficiency.
    """
    file_type = file_type.lower()
    
    if file_type == "pdf":
        text = extract_text_from_pdf(file_bytes, max_pages=2)
    elif file_type in ["docx", "doc"]:
        text = extract_text_from_docx(file_bytes, max_paragraphs=50)
    elif file_type in ["txt", "text"]:
        text = file_bytes.decode('utf-8', errors='ignore')
        # Limit to first 2000 chars for text files
        text = text[:2000]
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    
    # Limit to ~2000 characters total for token efficiency
    if len(text) > 2000:
        text = text[:2000]
    
    return text


def extract_course_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract course code and name from text using regex.
    Returns (course_code, course_name) or (None, None).
    """
    # First, try to find course code pattern
    course_code_pattern = r'(CSC|HUM|BIO|ENG)\d{3}'
    match = re.search(course_code_pattern, text, re.IGNORECASE)
    
    if match:
        course_code = match.group(0).upper()
        course_name = COURSE_MAPPING.get(course_code)
        logger.info(f"Regex found course: {course_code} - {course_name}")
        return course_code, course_name
    
    # If no course code, try to find course name in text
    text_lower = text.lower()
    for course_name, code in COURSE_NAME_TO_CODE.items():
        if course_name in text_lower:
            logger.info(f"Regex found course by name: {code} - {course_name}")
            return code, COURSE_MAPPING[code]
    
    return None, None


def extract_keyword_from_text(text: str) -> str:
    """
    Extract top keyword from text using simple heuristics.
    Returns the longest meaningful word (not a stopword).
    """
    # Common stopwords to filter out
    stopwords = {'the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'}
    
    # Split by non-alphanumeric characters
    words = re.split(r'[^a-zA-Z0-9]+', text)
    
    # Filter out stopwords and empty strings, keep only alphanumeric
    filtered_words = [
        word.lower() for word in words 
        if word and word.lower() not in stopwords and word.isalnum() and len(word) > 2
    ]
    
    # Take the longest remaining word
    if filtered_words:
        return max(filtered_words, key=len)
    
    return "general"


def classify_with_ai(text: str) -> Dict[str, Any]:
    """
    Classify document using Groq AI (fallback only when regex fails).
    This should rarely be called due to regex-first approach.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not found, skipping AI classification")
        return None
    
    try:
        logger.info(f"AI fallback called with text length: {len(text)}")
        logger.info(f"Text snippet: {text[:200]}...")
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama3-8b-8192",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a document classifier. Return only valid JSON."
                    },
                    {
                        "role": "user",
                        "content": CLASSIFICATION_PROMPT + "\n\nDocument text:\n" + text
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 150
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            logger.info(f"AI response: {content}")
            
            # Parse JSON response
            try:
                classification = json.loads(content)
                logger.info(f"AI classification successful: {classification}")
                return classification
            except json.JSONDecodeError:
                logger.error(f"Failed to parse AI response as JSON: {content}")
                return None
        else:
            logger.error(f"Groq API error: {response.status_code} - {response.text}")
            return None
            
    except requests.exceptions.Timeout:
        logger.error("Groq API request timed out")
        return None
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return None


def analyze_document(file_content_base64: str, file_type: str) -> Dict[str, Any]:
    """
    Analyze document using regex-first approach, AI as fallback.
    Token-efficient: only uses AI when regex fails.
    
    Args:
        file_content_base64: Base64 encoded file content
        file_type: File type (pdf, docx, etc.)
    
    Returns:
        Dictionary with course_code, keyword, target, ai_used, ai_response
    """
    result = {
        "course_code": None,
        "keyword": None,
        "target": None,
        "ai_used": False,
        "ai_response": None
    }
    
    try:
        # Decode base64
        file_bytes = base64.b64decode(file_content_base64)
        
        # Extract text (limited to first 2 pages / ~2000 chars)
        text = extract_text_content(file_bytes, file_type)
        
        if not text or len(text) < 20:
            logger.warning("Extracted text is too short for analysis")
            return result
        
        logger.info(f"Extracted text length: {len(text)} characters")
        
        # REGEX-FIRST: Try to extract course and keyword without AI
        course_code, course_name = extract_course_from_text(text)
        keyword = extract_keyword_from_text(text)
        
        if course_code:
            # Regex succeeded - no AI needed
            result["course_code"] = course_code
            result["keyword"] = keyword
            result["target"] = course_code  # Use course code as target
            result["ai_used"] = False
            logger.info(f"Regex extraction successful: {course_code}, {keyword} (0 tokens used)")
            return result
        
        # AI FALLBACK: Only if regex failed
        logger.info("Regex failed, using AI fallback")
        classification = classify_with_ai(text)
        
        if classification:
            result["course_code"] = classification.get("course_code")
            result["keyword"] = classification.get("keyword")
            result["ai_used"] = True
            result["ai_response"] = classification
            
            # Use course code as target if valid
            if result["course_code"] and result["course_code"] in COURSE_MAPPING:
                result["target"] = result["course_code"]
            
            logger.info(f"AI fallback successful: {result} (small token cost)")
        else:
            # Both regex and AI failed, use keyword from text
            result["keyword"] = keyword
            logger.warning("Both regex and AI failed, using keyword only")
        
    except Exception as e:
        logger.error(f"Error analyzing document: {e}")
    
    return result
