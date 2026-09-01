# NuManOS + Autron Full Audit Report

**Date:** August 1, 2026  
**Auditor:** Cascade AI  
**Scope:** NuManOS (backend + frontend) and Autron (Python agent) integration audit

---

## Executive Summary

This audit examined the integration between NuManOS (academic management system) and Autron (autonomous agent). The systems were built incrementally across multiple AI coding sessions, leading to several integration inconsistencies, incomplete migrations, and missing functionality.

**Critical Findings:**
- 8 API endpoint mismatches between Autron and NuManOS
- Incomplete migration from Hermes-based to native Groq agent
- Missing backend endpoints for attendance and marks
- Pending-review approval endpoint is intentionally non-functional
- Security vulnerabilities in file upload validation
- No retry logic for API failures
- Skills loading uses weak keyword matching instead of semantic relevance

---

## 1. Correctness & Integration Bugs

### 1.1 API Endpoint Mismatches

| Autron Tool | Autron Call | NuManOS Endpoint | Status | Issue |
|-------------|------------|------------------|--------|-------|
| `add_deadline` | `POST /deadlines` with `due_datetime` + `due_date` | `POST /deadlines` expects `due_date` | **MISMATCH** | Autron sends both fields, backend only uses `due_date` |
| `update_deadline` | `PUT /deadlines/{id}` with `due_datetime` + `due_date` | `PUT /deadlines/{id}` expects `due_date` | **MISMATCH** | Same dual-field issue |
| `get_attendance` | `GET /attendance?course=code` | **MISSING** | **CRITICAL** | No attendance endpoint exists in backend |
| `log_attendance` | `POST /attendance/log` | **MISSING** | **CRITICAL** | No attendance logging endpoint exists |
| `get_marks` | `GET /marks?course=code` | `GET /marks/{course_id}` | **MISMATCH** | Autron uses query param, backend uses path param |
| `get_gpa` | `GET /gpa/semester/{id}` | `GET /gpa/semester/{id}` | ✅ Match | Correct |
| `route_document` | `POST /documents/route` | `POST /documents/route` | ✅ Match | Correct |
| `record_routing_outcome` | `POST /documents/outcome` | `POST /documents/outcome` | ✅ Match | Correct |
| `get_routing_rules` | `GET /documents/rules` | `GET /documents/rules` | ✅ Match | Correct |
| `get_recent_decisions` | `GET /documents/decisions/recent` | `GET /documents/decisions/recent` | ✅ Match | Correct |
| `parse_whatsapp_export` | `POST /whatsapp/parse-txt` | `POST /whatsapp/parse-txt` | ✅ Match | Correct |
| `save_whatsapp_deadlines` | `POST /whatsapp/save-deadlines` | `POST /whatsapp/save-deadlines` | **STUB** | Returns success but doesn't save |

**Field Name Mismatches:**

1. **Deadline Date Field:**
   - Autron `agent_core.py` TOOL_SCHEMAS (line 67): uses `due_datetime`
   - Autron `tools.py` add_deadline (lines 73-97): sends both `due_datetime` AND `due_date`
   - NuManOS `deadlines.py` DeadlineCreate (line 17): expects `due_date`
   - NuManOS `models.py` Deadline (line 63): stores as `due_datetime`
   - **Impact:** Confusion in field naming, potential for data loss if wrong field used

2. **Marks Query Parameter:**
   - Autron `tools.py` get_marks (line 224): uses `?course=code`
   - NuManOS `marks.py` get_marks_for_course (line 130): uses `/marks/{course_id}`
   - **Impact:** Autron cannot fetch marks by course code without course ID

### 1.2 Pending-Review Endpoint Status

**Location:** `backend/routes/autron.py` lines 283-308

```python
@router.post("/autron/pending-review/{review_id}/approve")
def approve_pending_review(review_id: int, db: Session = Depends(get_db)):
    # ... validation code ...
    entry.status = "approved"
    db.commit()
    # ...
    return {
        "id": entry.id,
        "status": entry.status,
        "message": "Action approved and logged. Execution wiring comes in a later phase."
    }
```

**Status:** Intentionally deferred. The endpoint only sets status to "approved" and logs the action. It does NOT execute the queued action.

**What's Needed to Complete:**
1. Parse `action_name` and `action_args` from the pending review entry
2. Map action names to actual function calls (e.g., "update_deadline" → call the deadline update logic)
3. Execute the action with the provided arguments
4. Handle execution errors and update status accordingly
5. Return execution result to caller

### 1.3 Leftover Hermes References

**Status:** Incomplete migration - hybrid approach exists

**Files with Hermes References:**

1. **`Autron/ai_brain.py`** (lines 10-47):
   - Full `run_hermes_task()` function that shells out to `hermes` CLI via subprocess
   - Reads `hermes_command` from config.json
   - This is NOT migrated to native Groq - it's still calling external Hermes

2. **`Autron/agent_core.py`** (lines 396-399):
   - Stub `HermesAIBrain` class for backward compatibility
   - Comment says "to satisfy legacy class imports/instantiations"

3. **`Autron/autron_core.py`** (line 30):
   - Imports `HermesAIBrain` from agent_core
   - Uses it when `ai_enabled` config is True

4. **`Autron/file_watcher.py`** (lines 48, 66):
   - Comments reference "Hermes Brain" and "Hermes Executive Action"
   - Actually calls `run_agent_task` from agent_core (which uses Groq)

5. **`Autron/scheduler.py`** (lines 46, 92):
   - Comments reference "Hermes AI Brain"
   - Actually calls `run_agent_task` from agent_core (which uses Groq)

**Migration Status:**
- `agent_core.py` has been updated to use native Groq API
- `ai_brain.py` still has old Hermes subprocess code
- The system is in a hybrid state where both exist
- **Recommendation:** Remove `ai_brain.py` entirely and update all imports to use `agent_core.py` directly

### 1.4 Hardcoded Paths and Values

**Hardcoded Paths:**
1. **`backend/routes/autron.py` line 16:**
   ```python
   DEFAULT_FLAG_PATH = r"C:\Users\Numan Kabir\Desktop\Autron\enabled.flag"
   ```
   - User-specific hardcoded path
   - Should use environment variable `AUTRON_FLAG_PATH`

2. **`backend/routes/document_router.py` line 268:**
   ```python
   with open("C:\\Users\\Numan Kabir\\Desktop\\NuManOS\\backend\\crash_log.txt", "w") as f:
   ```
   - User-specific hardcoded crash log path
   - Should use relative path or environment variable

3. **`Autron/tools.py` line 30:**
   ```python
   CONFIG = {"api_base_url": "http://127.0.0.1:8000"}
   ```
   - Hardcoded localhost URL
   - Should use environment variable

**Hardcoded API Keys:**
- No hardcoded API keys found in code
- Both systems correctly read from environment variables or config.json

---

## 2. Security

### 2.1 API Key Storage

**Groq API Key:**
- **Autron/agent_core.py line 19:** Reads from `config.json` or `GROQ_API_KEY` env var ✅
- **Autron/tools.py line 23:** Reads from `config.json` or defaults ✅
- **backend/routes/whatsapp_router.py line 54:** Reads from `GROQ_API_KEY` env var ✅
- **Not committed to any tracked file** ✅

**Assessment:** API keys are stored securely via environment variables and config.json (which should be in .gitignore).

### 2.2 File Upload Validation

**Location:** `backend/routes/autron.py` lines 165-198

**Current Validation:**
```python
if not file.filename or not file.filename.lower().endswith(".md"):
    raise HTTPException(status_code=400, detail="Only .md files are accepted")

raw = await file.read()
try:
    content = raw.decode("utf-8")
except UnicodeDecodeError:
    raise HTTPException(status_code=400, detail="Skill file must be valid UTF-8 text")
```

**Missing Validations:**
- ❌ No file size limit (could upload 1GB file)
- ❌ No content type validation beyond extension check
- ❌ No validation that content is actually markdown
- ❌ No rate limiting on uploads
- ❌ No sanitization of markdown content (XSS potential if rendered)

**Recommendations:**
1. Add max file size limit (e.g., 1MB for skill files)
2. Validate content-type header
3. Add rate limiting per IP
4. Sanitize markdown before storage if it will be rendered

### 2.3 Destructive Action Guardrails

**Location:** `Autron/agent_core.py` lines 355-368

**Current Implementation:**
```python
if tool_name in ["update_deadline", "delete_deadline"]:
    logger.info(f"Blocking destructive tool '{tool_name}' and queuing for review.")
    try:
        review_res = requests.post(
            f"{BASE_URL}/autron/pending-review",
            json={"action": tool_name, "args": tool_args},
            timeout=10
        )
        # ...
```

**Assessment:** ✅ Guardrails are implemented correctly
- Destructive tools are explicitly blocked
- They are queued for review instead of executed
- The blocking is in the agent_core.py execution logic, not just in prompts

**Bypass Risk:** ⚠️ Medium
- A differently-worded agent prompt could potentially cause the agent to call a different tool that achieves the same effect
- Example: If there was a "bulk_update_deadlines" tool that wasn't marked as destructive, it could be used as a bypass
- **Recommendation:** Add a decorator or registry system that marks tools as destructive at definition time, making it harder to bypass

### 2.4 SQL Injection Risks

**Assessment:** ✅ Low risk - SQLAlchemy ORM is used throughout
- All database queries use SQLAlchemy ORM with parameter binding
- No raw SQL string concatenation found
- FastAPI Pydantic models provide input validation

**One Concern:**
- `backend/routes/document_router.py` line 268: Crash log writes to file path - not SQL but could be path traversal if user-controlled input reaches it
- Currently the path is hardcoded, so no immediate risk

---

## 3. Reliability

### 3.1 Backend Down Handling

**Location:** `Autron/tools.py` - all API call functions

**Current Error Handling:**
```python
try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data
except Exception as e:
    logger.error(f"Error fetching deadlines from NuManOS: {e}")
    return []  # Returns empty list on failure
```

**Assessment:** ⚠️ Partially graceful
- ✅ Catches exceptions and logs errors
- ✅ Returns safe default values (empty list, None, False)
- ❌ No retry logic
- ❌ No exponential backoff
- ❌ No circuit breaker pattern
- ❌ Agent continues execution even if critical data fetch fails

**Impact:** If backend is down, agent may make decisions based on incomplete data (empty lists), potentially leading to incorrect actions.

**Recommendation:** Add retry logic with exponential backoff for critical endpoints.

### 3.2 Groq API Rate Limiting

**Location:** `Autron/agent_core.py` lines 318-329

**Current Handling:**
```python
try:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        tools=TOOL_SCHEMAS,
        tool_choice="auto"
    )
except Exception as e:
    logger.error(f"Groq API completion call failed: {e}")
    return f"Error communicating with Groq API: {e}"
```

**Assessment:** ❌ No retry logic
- Single failure causes entire agent task to fail
- No handling of rate limit (429) errors
- No handling of timeout errors
- No fallback to secondary provider

**Recommendation:** 
1. Add retry logic with exponential backoff
2. Handle 429 errors specifically with longer delays
3. Implement fallback to secondary provider if configured

### 3.3 File Watcher Partial File Handling

**Location:** `Autron/file_watcher.py` lines 40-41

**Current Implementation:**
```python
# Wait briefly to ensure file download/copy completes
time.sleep(1)
```

**Assessment:** ❌ Insufficient for large files
- Fixed 1-second delay is not enough for large files (e.g., 100MB PDF)
- No check if file is still being written to
- Could read partial/corrupt file content
- No file size stabilization check

**Recommendation:**
1. Implement file size stabilization check (wait until file size stops changing)
2. Add configurable delay based on file size
3. Try to open file exclusively to check if it's still locked by another process
4. Add maximum wait timeout with error logging

---

## 4. Agentic Capability Gaps

### 4.1 Current vs Stated Goal

**Stated Goal:** "Any document uploaded or dropped should be auto-analyzed and routed to the right action (deadline, marks, attendance, schedule) with no manual step."

**Current Capabilities:**
| Action | Supported | Notes |
|--------|-----------|-------|
| Extract deadlines from documents | ✅ Partial | Only via WhatsApp export or AI analysis |
| Extract marks/grades | ❌ No | No tool to parse marks from documents |
| Extract attendance info | ❌ No | No tool to parse attendance from documents |
| Extract schedule info | ❌ No | No tool to parse calendar/schedule from documents |
| Route to correct location | ✅ Yes | Document routing works |
| Auto-save to database | ⚠️ Partial | Deadlines can be saved, but marks/attendance cannot |

**Missing Tools:**
1. `parse_marks_document` - Extract marks/grades from syllabus or grade report
2. `parse_attendance_document` - Extract attendance records from class roster
3. `parse_schedule_document` - Extract exam dates, class times from schedule
4. `add_mark` - Create mark entries (backend exists but Autron doesn't use it)
5. `log_attendance` - Create attendance entries (backend doesn't exist)

### 4.2 Skills Loading Mechanism

**Location:** `Autron/agent_core.py` lines 258-298

**Current Implementation:**
```python
def load_relevant_skills(prompt: str) -> str:
    # ...
    for skill in skills:
        name = skill.get("name", "")
        desc = skill.get("description", "")
        
        # Check if description or name seems relevant to the prompt (keyword matching)
        relevance_keywords = [w.lower() for w in (name + " " + desc).split() if len(w) > 3]
        if any(kw in prompt.lower() for kw in relevance_keywords):
            # Fetch full skill body
```

**Assessment:** ❌ Weak keyword-only matching
- Only checks if any word from skill name/description appears in prompt
- No semantic understanding of relevance
- Could miss relevant skills with different terminology
- Could include irrelevant skills with overlapping keywords

**Recommendation (Cheap Improvement):**
Use Groq itself to pick relevant skills in one extra call:
```python
def load_relevant_skills(prompt: str) -> str:
    # Fetch all skill summaries
    skills = requests.get(f"{BASE_URL}/skills").json()
    
    # Ask Groq to pick relevant ones
    skill_list = "\n".join([f"- {s['name']}: {s.get('description', '')}" for s in skills])
    selection_prompt = f"""
    Given this user request: "{prompt}"
    And these available skills:
    {skill_list}
    
    Return ONLY a JSON array of skill names that are relevant to this request.
    If none are relevant, return an empty array [].
    """
    
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": selection_prompt}],
        response_format={"type": "json_object"}
    )
    
    selected_names = json.loads(response.choices[0].message.content)
    # Fetch full content for selected skills only
```

### 4.3 Unknown Case Tracking

**Current State:** ❌ No mechanism exists

**Problem:** When the agent encounters a situation it doesn't know how to handle, it just fails or gives a generic error. There's no systematic way to:
1. Track what the agent failed to handle
2. Review these failures
3. Turn them into new skills

**Recommendation (Minimal Addition):**
Add a "unknown_cases" table and endpoint:
```python
# In backend/models.py
class UnknownCase(Base):
    __tablename__ = "unknown_cases"
    id = Column(Integer, primary_key=True)
    prompt = Column(Text)
    error_message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)

# In agent_core.py error handling
except Exception as e:
    # Log unknown case for review
    requests.post(f"{BASE_URL}/autron/unknown-cases", json={
        "prompt": prompt,
        "error_message": str(e)
    })
    logger.error(f"Agent failed: {e}")
```

### 4.4 Document Rules Confidence Weighting

**Location:** `backend/routes/document_router.py` lines 177-229

**Current Usage:**
```python
if rule:
    chosen_path = rule.target_module
    rule_id = rule.rule_id
    confidence = rule.confidence_weight
    needs_review = confidence < 0.4
```

**Assessment:** ✅ Confidence weighting IS used in routing
- Existing rules use their confidence_weight directly
- Low confidence (< 0.4) triggers manual review flag
- Confidence is updated via outcome recording (lines 275-348)

**However:** ❌ NOT used in agent_core.py decision-making
- The agent's tool selection doesn't consider rule confidence
- The agent doesn't query routing rules before making decisions
- The learning system exists but the agent doesn't leverage it

**Gap:** The document routing system learns from feedback, but the autonomous agent doesn't use this learned knowledge when deciding how to handle documents.

**Recommendation:** Add a tool to query routing rules and their confidence:
```python
{
    "name": "get_routing_rules",
    "description": "Get document routing rules with confidence scores to inform routing decisions"
}
```

---

## 5. Code Quality & Consistency

### 5.1 Inconsistent Naming

| Concept | Used In | Variations Found |
|---------|---------|------------------|
| Deadline date field | `due_date`, `due_datetime` | Both used interchangeably in Autron |
| Course identifier | `course_code`, `course_id` | Autron uses code, backend uses ID internally |
| AI Brain class | `HermesAIBrain`, `GroqAIBrain` | Both exist, causing confusion |
| Activity log | `autron_activity`, `AutronActivity` | Table vs model naming inconsistency |

### 5.2 Dead Code

1. **`Autron/ai_brain.py`** - Entire file is legacy
   - `run_hermes_task()` function (lines 10-47) - no longer used
   - `extract_file_text()` duplicated in agent_core.py
   - `HermesAIBrain` class is just a stub

2. **`backend/routes/whatsapp_router.py` save-deadlines endpoint** (lines 89-96)
   - Returns success but doesn't actually save
   - Comment says "For now, simply return success"
   - Never implemented

3. **`backend/routes/document_router.py` migrate-rules endpoint** (lines 385-455)
   - One-time migration tool
   - Should be removed after migration complete

### 5.3 Unused Imports

1. **`backend/routes/document_router.py` line 6:**
   ```python
   import traceback
   import sys
   ```
   - `sys` is imported but never used
   - `traceback` is only used in one exception handler

2. **`Autron/agent_core.py` line 8:**
   ```python
   import yaml
   ```
   - Only used in skill parsing, could be imported locally

### 5.4 Duplicate Logic

1. **File text extraction:**
   - `Autron/ai_brain.py` lines 50-74
   - `Autron/agent_core.py` lines 402-426
   - Identical logic duplicated

2. **Notification sending:**
   - `Autron/tools.py` lines 36-53
   - Could be centralized into a utility module

3. **Config loading:**
   - `Autron/agent_core.py` lines 12-17
   - `Autron/tools.py` lines 22-31
   - Similar pattern, could be shared

### 5.5 Inconsistent Error Handling

| File | Error Handling Style |
|------|---------------------|
| `Autron/tools.py` | try/except returning empty/default values |
| `Autron/agent_core.py` | try/except returning error messages |
| `backend/routes/autron.py` | HTTPException with status codes |
| `backend/routes/document_router.py` | HTTPException + crash log file |

**Recommendation:** Standardize on HTTPException for API errors and specific exception classes for internal errors.

---

## 6. Priority Recommendations

### Critical (Fix Immediately)

1. **Create missing backend endpoints:**
   - `GET /attendance` - Return attendance summary by course
   - `POST /attendance/log` - Log attendance records
   - Fix `POST /whatsapp/save-deadlines` to actually save to database

2. **Fix API endpoint mismatches:**
   - Standardize on `due_date` field name (remove `due_datetime` from Autron)
   - Fix `get_marks` to use course_id instead of course_code query param
   - Or add course_code lookup in backend

3. **Complete Hermes migration:**
   - Remove `Autron/ai_brain.py` entirely
   - Update all imports to use `agent_core.py` directly
   - Remove Hermes references from comments

### High Priority

4. **Add retry logic:**
   - Exponential backoff for API calls in tools.py
   - Retry logic for Groq API in agent_core.py
   - Circuit breaker pattern for backend down scenarios

5. **Improve file upload security:**
   - Add file size limits to skill upload
   - Add rate limiting
   - Sanitize markdown content

6. **Complete pending-review execution:**
   - Implement actual action execution after approval
   - Map action names to function calls
   - Handle execution errors

### Medium Priority

7. **Improve skills loading:**
   - Replace keyword matching with Groq-based selection
   - Or implement embedding-based similarity

8. **Add unknown case tracking:**
   - Create unknown_cases table
   - Log agent failures for review
   - Build review UI

9. **Fix file watcher reliability:**
   - Implement file size stabilization check
   - Add configurable delays
   - Handle large files properly

### Low Priority

10. **Code cleanup:**
    - Remove dead code
    - Consolidate duplicate logic
    - Standardize error handling
    - Fix hardcoded paths

---

## 7. Testing Recommendations

### Integration Tests Needed

1. **End-to-end document routing:**
   - Drop file in Autron Inbox
   - Verify routing to correct location
   - Verify confidence weight updates

2. **Agent tool execution:**
   - Test all tools with valid inputs
   - Test error handling with invalid inputs
   - Test destructive action guardrails

3. **API contract tests:**
   - Verify Autron tools.py calls match NuManOS endpoints
   - Test field name consistency
   - Test error response formats

4. **Offline scenarios:**
   - Test behavior when backend is down
   - Test behavior when Groq API is rate-limited
   - Test file watcher with network issues

---

## 8. Conclusion

The NuManOS and Autron systems show signs of incremental development across multiple sessions, resulting in:

**Strengths:**
- Solid foundation with SQLAlchemy ORM and FastAPI
- Good separation of concerns in backend routing
- Document routing learning system is well-designed
- Guardrails for destructive actions are in place

**Weaknesses:**
- Incomplete migration from Hermes to native Groq
- Missing critical backend endpoints
- No retry logic for failures
- Weak semantic matching for skills
- File upload security gaps

**Overall Assessment:** The systems are functional but not production-ready. The integration between Autron and NuManOS has several mismatches that need resolution before reliable autonomous operation can be achieved.

**Estimated Effort to Fix Critical Issues:** 2-3 days of focused development
**Estimated Effort for Full Production Readiness:** 1-2 weeks

---

**End of Audit Report**
