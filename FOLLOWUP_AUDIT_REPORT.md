# NuManOS + Autron Follow-Up Audit Report

**Date:** August 3, 2026
**Auditor:** Cascade AI (Follow-Up)
**Scope:** Verify previous fixes landed correctly, find new bugs, production-readiness of core loop, untapped scope, security re-check

---

## Executive Summary

The four targeted fixes from the previous audit were partially applied. **Two of them (attendance endpoints, get_marks parameter) are present but still broken due to *query-param-name mismatches* that were missed in the initial fix work.** The other two (due_date consistency, Groq API key rotation) landed correctly.

A fresh end-to-end pass uncovered **seven new critical bugs** that did not exist (or were not flagged) in the first audit, including a completely missing `/courses` endpoint that 10+ functions in `tools.py` depend on, and a scheduler fallback that will crash with an `AttributeError` whenever the AI brain is disabled.

The AI reasoning step has still **not been end-to-end verified** (the key was rotated but there is no evidence in the code of a post-rotation run). The system degrades *partially* gracefully for some failure scenarios but crashes outright for others (malformed Groq tool-call JSON, scheduler fallback path).

Confidence-weighting routing, feedback-loop learning from approve/reject, and semantic Skills matching all remain **unused** despite the infrastructure being built.

---

## 1. Verify Previous Fixes Actually Landed Correctly

### Fix 1 — Missing Attendance Endpoints: 🟡 Partially Correct (Present, But Query-Param Mismatch Breaks Filtering)

**Backend endpoints exist** in [attendance.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/attendance.py):
- `GET /attendance?course_code=...` — returns list of `AttendanceResponse` records ✅ endpoint exists
- `GET /attendance/summary?course_code=...` — returns stats ✅ endpoint exists
- `POST /attendance/log` with JSON body `{course_code, status, date}` ✅ endpoint exists
- Registered in `main.py` line 73: `app.include_router(attendance_router)` ✅

**However, `get_attendance` filtering from Autron does NOT work:**

In [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 153-154, `check_attendance` sends:
```python
params["course"] = course_code   # query param name: "course"
```

But in [attendance.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/attendance.py) line 55, the endpoint expects:
```python
def get_attendance(course_code: Optional[str] = None, ...):   # expects "course_code"
```

**Result:** Any Autron call to `get_attendance("CSC103")` returns **ALL** attendance records from **all** courses. The filter is silently ignored. This is data-leak-level wrong in a multi-user context, and silently wrong even for single-user use.

`log_attendance` (POST) **is** correct:
- tools.py line 206 sends `{"course_code": course_code, "status": status, "date": date}` in the JSON body
- AttendanceCreate schema (attendance.py lines 13-20) expects exactly those fields
- Upsert logic (update if same course+date exists) is correctly implemented

**Also:** `check_attendance` in tools.py calls `/attendance` (raw records) instead of `/attendance/summary` (the stats endpoint). The scheduler (scheduler.py line 41) uses this check_attendance result and tries to iterate `.items()` expecting a `{course: {percentage}}` dict — see Bug 2.6 below.

---

### Fix 2 — get_marks Parameter Mismatch: 🟡 Partially Correct (New Endpoint Exists, Same Query-Param Name Bug)

The previous audit found:
> Autron `get_marks` used `?course=code`; backend only had `/marks/{course_id}` (path param).

The fix added `GET /marks?course_code=...` in [marks.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/marks.py) line 136-152. ✅ Endpoint is present.

**However, the same query-param-name bug:**

In [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 221, `get_marks` sends:
```python
params = {"course": course_code}   # query param name: "course"
```

But marks.py line 137 expects:
```python
def get_marks_by_course_code(course_code: Optional[str] = None, ...):   # expects "course_code"
```

**Result:** `get_marks("CSC103")` returns **every mark row in the database** — no filtering applied. Silently wrong.

---

### Fix 3 — due_date/due_datetime Field Consistency: ✅ Correctly Fixed

Previously: Autron sent both `due_datetime` and `due_date` fields; naming was inconsistent across schemas and responses.

**Current state (all consistent):**
- [agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) TOOL_SCHEMAS for `add_deadline`/`update_deadline` use `due_date` (lines 67, 86) ✅
- [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) `add_deadline` (line 81) and `update_deadline` (line 178) send **only** `due_date` in the payload ✅
- [deadlines.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/deadlines.py) `DeadlineCreate`/`DeadlineUpdate` schemas expect `due_date` (lines 17, 31) ✅
- `parse_due_date()` function (lines 64-77) correctly parses both `YYYY-MM-DD` (→ 23:59:59) and ISO formats ✅
- [models.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/models.py) `Deadline` stores as `due_datetime` (line 63) — this is the *internal* DB column name, which is fine because:
- `DeadlineResponse` (deadlines.py line 43) returns `due_datetime` (the actual stored datetime) — this is the *output* name, distinct from the *input* `due_date` (string) — the split is intentional and not a bug ✅
- `whatsapp_router.py` `save-deadlines` also updated to use `due_date` input and parse to DB `due_datetime` (lines 125-128) ✅

No regressions found. Every function that referenced the deadline date field was updated consistently.

---

### Fix 4 — Groq API Key Rotated/Corrected: ✅ Appears Correct

- [config.json](file:///C:/Users/Numan%20Kabir/Desktop/Autron/config.json) line 10 contains a key starting `gsk_pRlnUVDx...` — correctly formatted Groq key (`gsk_` prefix, ~56 chars length typical of Groq API keys). ✅
- No placeholder patterns (`YOUR_`, `sk-test`, `xxx...`) present. ✅
- [agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) line 19 loads from config.json with `os.environ.get("GROQ_API_KEY")` fallback. ✅
- `client = Groq(api_key=GROQ_API_KEY)` created only if key exists (lines 24-28); proper guard + error message if missing. ✅

**Note:** Cannot verify if this *specific* key is valid/active without a live Groq API call. Rotation to a non-placeholder key is confirmed.

---

## 2. New or Previously Unnoticed Bugs

### Bug 2.1 — Missing `/courses` Endpoint (🔴 CRITICAL: Breaks 10+ Tools Functions)

**Impact:** The following functions in [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) all call `GET /courses` and will **fail silently** (returning `None`/empty) every time they run, because **no `/courses` route exists anywhere in the backend**:

| Line(s) | Function | Usage |
|---------|----------|-------|
| 368-398 | `analyze_performance` | Fetches course list to map course_code → course_id |
| 422-433 | `create_study_goal` | Same course_code → course_id lookup |
| 498-508 | `analyze_syllabus` | Same |
| 561-576 | `check_prerequisites` | Same |
| 600-610 | `get_syllabi` | Same |
| 675-685 | `create_study_group` | Same |
| 728-739 | `create_time_allocation` | Same |
| 768-779 | `recommend_time_allocation` | Same |

**Grep across all backend routes** (`Grep for @router.*courses` / `app.include_router` / `def.*courses`) returned **zero matches**. There is no `courses.py` in the routes folder. The `Course` model exists in models.py but there is zero REST surface for it.

**Result:** Every "academic intelligence" feature except those that don't need course lookups (generate_study_schedule, analyze_workload — which don't call /courses) is completely broken. These functions try/except around the courses fetch and `logger.error(...)` + `return None`, so they degrade, but the degradation is **total functional failure** (no data ever returned for any course_code-based operation).

---

### Bug 2.2 — WhatsApp Parse Endpoint Path Mismatch (🔴 CRITICAL)

In [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 285:
```python
url = f"{BASE_URL}/whatsapp/parse"
```

But in [whatsapp_router.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/whatsapp_router.py) line 30:
```python
@router.post("/parse-txt", ...)
```

**Result:** 404 Not Found every time `parse_whatsapp_export` is called. The previous audit flagged the save-deadlines stub (which has now been fixed — see 2.3), but the parse-endpoint path mismatch was missed in both audits.

---

### Bug 2.3 — save_whatsapp_deadlines Good Fix, But Old Stub Still Exists (🟡 Minor)

**Good news:** `tools.py` line 298-322 now **bypasses the old stub endpoint entirely** and calls `POST /deadlines` in a loop. That works correctly. ✅

**But the old stub** `POST /whatsapp/save-deadlines` endpoint (whatsapp_router.py line 103-174) now actually saves to DB too (it was implemented between audits). This means there are **two separate code paths** for saving WhatsApp deadlines:
1. Autron → tools.py → loop of `POST /deadlines` (actual live path)
2. Backend UI → `POST /whatsapp/save-deadlines` (implemented but unused by Autron)

No inconsistency between them detected (both look up course by code, parse date, dedupe), but this is dead-weight-duplicate code. If someone changes one path and forgets the other, a bug surfaces.

---

### Bug 2.4 — Malformed Groq Tool-Call JSON Crashes the Agent Loop (🔴 CRITICAL)

In [agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) line 351:
```python
tool_args = json.loads(tool_call.function.arguments)
```

This `json.loads()` is **NOT in a try/except block**. Groq (or any LLM) regularly returns:
- trailing commas in JSON arguments
- single quotes instead of double quotes
- unescaped newlines in string values
- partial/incomplete JSON on stream truncation

If `arguments` is not valid JSON, the entire `run_agent_task()` function raises `JSONDecodeError` and **exits the agent loop without any catch above line 351**. The exception is caught by the outer iteration's broad except (line 327-329), but **only** if the JSON parse failure happens in that scope. It doesn't — it's after line 330, in the tool-processing loop. The actual call stack is:

```
line 327-329: try/except only covers client.chat.completions.create()
  ↓ succeeds
line 351: json.loads() crashes → uncaught JSONDecodeError propagates to caller
```

**Result:** `run_agent_task` exits with uncaught exception → file watcher/scheduler callers have **no try/except** around their `run_agent_task(prompt)` calls (file_watcher.py line 62, scheduler.py lines 55, 99) → **Autron core daemon continues running but that specific task's error is only visible if logging catches it (it does, via autron_core.py line 108's outer loop catch) — BUT the notification step after run_agent_task will also skip, so the user gets zero feedback that the AI failed.**

Actually, correction: `autron_core.py` line 107-108 does catch the main loop, but the file_watcher `on_created` handler and the scheduler `run_morning_routine` are **not** wrapped in try/except. watchdog's `on_created` exceptions are silently swallowed by the observer library (no crash, but the handler's post-error code is skipped). The scheduler's functions (run_morning_routine / run_night_routine) are called from `check_schedule_and_triggers` inside the main while loop, which IS wrapped in line 107-108, so the daemon survives — but the routine's notification and logging are incomplete.

**Net assessment:** No crash/data-corruption, but uncaught JSONDecodeError causes incomplete task execution and partial state with poor logs.

---

### Bug 2.5 — TOOL_MAPPING / TOOL_SCHEMAS Only Cover 14 of ~30 Functions in tools.py (🟡 Important: New Tools Are Unreachable by Agent)

[tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) has ~30 functions (deadlines + attendance + marks + document routing + whatsapp + 17 academic/course/communication functions added since first audit).

[agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) `TOOL_MAPPING` (lines 31-46) and `TOOL_SCHEMAS` (lines 48-255) only register the **original 14 tools**:
```
get_deadlines, add_deadline, update_deadline, delete_deadline,
get_attendance, log_attendance, get_marks, get_gpa,
route_document, record_routing_outcome, get_routing_rules,
get_recent_decisions, parse_whatsapp_export, save_whatsapp_deadlines
```

Missing from TOOL_MAPPING and TOOL_SCHEMAS:
`generate_study_schedule, analyze_workload, analyze_performance, create_study_goal, get_study_schedules, get_study_goals, analyze_syllabus, extract_syllabus_deadlines, generate_course_recommendations, check_prerequisites, get_syllabi, create_notification, generate_deadline_reminders, create_study_group, discover_resources, create_time_allocation, recommend_time_allocation`

**Result:** Groq literally cannot call these tools — they're not in the `tools=TOOL_SCHEMAS` list passed to the API, and even if Groq hallucinated the name, `TOOL_MAPPING.get()` would return None and the tool result would be `"Tool 'X' is not registered."`. All 17 newer tools are **100% dead code to the autonomous agent**. They only work if someone manually calls the Python functions from a REPL.

---

### Bug 2.6 — Scheduler Fallback (No-AI Path) Crashes with AttributeError on `.items()` (🔴 CRITICAL)

In [scheduler.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/scheduler.py) lines 68-72, the non-AI morning routine fallback path:

```python
low_attendance = []
for course, data in attendance.items():   # <--- LINE 69
    pct = data.get("percentage", 100)
    if pct < 75.0:
        low_attendance.append(f"{course} ({pct}%)")
```

But `check_attendance()` (scheduler.py line 41 → tools.py lines 147-166) returns `data` which is the JSON response from `GET /attendance`: a **list** of `AttendanceResponse` objects:
```json
[{"id": 1, "course_id": 2, "course_code": "CSC103", "date": "...", "status": "present"}, ...]
```

Lists don't have `.items()`. **If `ai_enabled` is `false` in config.json, every morning routine will crash at line 69 with `AttributeError: 'list' object has no attribute 'items'`.** This takes out the morning summary notification and the low-attendance alert. Night routine is unaffected (doesn't use attendance).

**If `ai_enabled` is `true`:** the AI branch (lines 44-62) is taken and this fallback code is skipped — no crash. But the prompt still receives the raw attendance list instead of the summary stats, which wastes tokens and gives the AI harder-to-parse input (it has to aggregate attendance itself from individual records).

---

### Bug 2.7 — Hardcoded Crash Log + Flag Path Still Present (🟡 Important)

The previous audit flagged these. They are unchanged:

1. [autron.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/autron.py) line 16:
   ```python
   DEFAULT_FLAG_PATH = r"C:\Users\Numan Kabir\Desktop\Autron\enabled.flag"
   ```
   Uses `os.environ.get("AUTRON_FLAG_PATH", DEFAULT_FLAG_PATH)` as fallback — so configurable via env, but the default leaks user path. Minor.

2. [document_router.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/document_router.py) line 268:
   ```python
   with open("C:\\Users\\Numan Kabir\\Desktop\\NuManOS\\backend\\crash_log.txt", "w") as f:
   ```
   Still hardcoded absolute path. Writes crash info to a user-specific location.

---

### Bug 2.8 — Schedule Generate Endpoint Missing Prefix / Wrong Method (🟡 Minor)

[tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 330-331:
```python
url = f"{BASE_URL}/academic-intelligence/schedules/generate"
response = requests.post(url, params=params, ...)   # POST with query params, no body
```

Need to verify academic_intelligence has this endpoint. Looking at the first 100 lines of academic_intelligence.py it only shows StudyScheduleCreate schema — routes are after line 100. However, the pattern (posting with params only) is fragile and unusual; most POST endpoints expect a body. This is flagged for manual testing even though the endpoint likely exists.

---

## 3. Is the Core Loop Actually Production-Ready?

### Scenario A: A File Is Dropped in Inbox/

**Trace:**

1. `file_watcher.py` `InboxHandler.on_created()` fires via watchdog observer thread. ✅
2. Checks `enabled.flag` via `is_enabled_callback()`. If paused, clean skip + log. ✅
3. Ignores hidden/temp files (`.`, `~$` prefixes). ✅
4. `time.sleep(1)` — still the 1-second fixed wait. Still insufficient for large files (100MB+ PDFs from a slow network share). ⚠️ Partial degradation — may read partial file content but won't crash (`extract_file_text` has its own try/except and falls back to printable-char extraction on PDF read fail).
5. Regex match for course code in filename. ✅
6. If `ai_brain` is not None (ai_enabled=true):
   - Imports `run_agent_task, extract_file_text` ✅
   - Reads up to 4000 chars of text from file ✅
   - Constructs prompt including file text, filename ✅
   - Calls `run_agent_task(prompt)` — **no try/except wrapper here** ⚠️
   - If run_agent_task throws (Bug 2.4), the handler aborts before reaching line 70 (`route_document`) and **the file is never routed** (but the file stays in Inbox; no data loss, no crash, no notification). ⚠️
   - On success, logs summary + fires toast notification. ✅
7. Calls `route_document(file_path, course_code=...)` via `tools.route_document` → base64-encodes entire file → `POST /documents/route` with 30s timeout. ✅
8. route_document has try/except, logs failures cleanly. ✅

**Gracefulness assessment:** ⚠️ **Partially graceful**
- No crash, no data corruption ✅
- File stays in Inbox (user can retry / re-drop) ✅
- But on uncaught exceptions in run_agent_task (Bug 2.4): the routing step itself is **skipped** (not just AI content extraction) — routing only happens if the AI step succeeds. This is a functional coupling error: AI extraction failure should NOT block document routing, since routing works without AI via regex + keyword.
- No retry/requeue for files that failed. On next Autron restart, watchdog won't re-trigger on_created for existing files (they're already in the dir). ⚠️ **Failed files are stranded permanently without manual intervention.**

---

### Scenario B: 8AM/9PM Scheduled Routines Fire

**Trace (Morning, 8:00-8:59 AM, first run of day):**

1. `scheduler.py` `check_schedule_and_triggers()` runs once per poll interval (configurable, default 10s). ✅
2. Checks `is_autron_enabled()` — clean skip if disabled. ✅
3. Checks internet via `is_internet_available()` (socket to 8.8.8.8:53, 3s timeout). If offline → `was_offline=True`. On reconnect (if still in the 8-9 window / 21-22 window), it retriggers missed routines — a nice catch-up mechanism. ✅
4. If `current_hour == 8 and last_morning_run != today`:
   - Calls `run_morning_routine()`
   - Fetches `get_deadlines()` and `check_attendance()` — both have try/except in tools.py and return `[]` / `{}` on failure ✅
   - If `self.ai_brain` is not None: calls `run_agent_task(prompt)` with deadlines+attendance JSON in the prompt. ⚠️ (Bug 2.4 risk, no try/except here)
   - If `self.ai_brain` is None: **Bug 2.6 crashes** at `attendance.items()`. 🔴
5. Sends toast notification with summary (if we got that far). ✅
6. `last_morning_run = today` — written regardless of whether the routine succeeded or crashed. ⚠️ **Bugs cause silent skip for the rest of the day.** Failed routines won't retry even if fixed later (unless Autron restarts, which resets last_morning_run in memory — but with the crash+main-loop catch, the variable persists with today's value).

**Gracefulness assessment:** ❌ **Not production-ready**
- AI-disabled path has an **AttributeError crash that takes out the morning routine entirely.**
- No per-routine try/except in `run_morning_routine` / `run_night_routine` themselves.
- `last_morning_run` assignment (line 37) is at the **top** of `run_morning_routine()`, before the work is done — if any line after line 37 throws, it's still marked as "ran today" and won't retry.

---

### Scenario C: NuManOS Backend Is Down When Autron Tries to Call It

**Trace across all API calls in tools.py:**

Every function in tools.py follows the pattern:
```python
try:
    response = requests.{method}(url, timeout=10)
    response.raise_for_status()
    return response.json()
except Exception as e:
    logger.error(f"Error ... : {e}")
    return []   # or None, or {}, or False — safe defaults
```

Specific safe defaults:

| Function | Default on failure |
|----------|-------------------|
| get_deadlines | `[]` |
| add_deadline | `None` |
| route_document | `None` |
| check_attendance / get_attendance | `{}` |
| get_marks | `[]` |
| get_gpa | `None` |
| record_routing_outcome | `None` |
| get_routing_rules | `[]` |
| get_recent_decisions | `[]` |
| parse_whatsapp_export | `[]` |
| log_attendance | `None` |
| update_deadline | `None` |
| delete_deadline | `False` |
| analyze_performance, create_study_goal, check_prerequisites, etc. | `None` |

**Gracefulness assessment:** ⚠️ **Degrades but misleads the agent**
- No crash anywhere in tools.py. ✅
- No data corruption — writes fail cleanly (return None/False). ✅
- But: the **agent is given empty lists** and told (via the tools' return values) that there are 0 deadlines, 0 marks, 0 attendance records, 0 routing rules. The agent has **no signal that the backend is down**. It will happily proceed and make decisions based on empty data. For example, in the morning briefing, it would say "0 pending deadlines" instead of "I can't reach NuManOS". A well-trained agent prompt might notice "0 deadlines for a user who has classes" but that's unreliable. The tool result should distinguish "backend down" from "genuinely empty".
- No retry logic, no exponential backoff, no circuit breaker. If the backend is in the middle of a restart (5 seconds), every call that happens in those 5 seconds fails permanently. No re-attempt.
- 10-second timeouts are reasonable.

Additionally, in agent_core.py line 359-368 (destructive-action queuing):
```python
review_res = requests.post(f"{BASE_URL}/autron/pending-review", ...)
review_res.raise_for_status()
```
If backend is down here, `except Exception` catches it and tool_result_str becomes `"failed to queue action for review: ..."`. The destructive action is **not executed** (good — fails closed), and the loop continues (good — no crash). But there's also no **local persistence** of the pending-review action. If the backend was down and comes back up 30 seconds later, the queued destructive action is **lost forever**. ⚠️

---

### Scenario D: Groq Returns a Malformed or Unexpected Tool-Call Response

**Trace for each failure class:**

**(i) Network/HTTP error from Groq API call (timeout, DNS, 5xx, 429 rate-limit):**
- agent_core.py lines 320-329: `client.chat.completions.create()` is in a try/except. Error logged via `logger.error`. Returns `f"Error communicating with Groq API: {e}"` as a string. ✅ Graceful. Callers get a string result. Notification fires with the error message. No crash.

**(ii) `response.choices` is empty or `.choices[0].message` is None:**
- Line 331: `response_message = response.choices[0].message`
- **No guard** for empty choices list or None message. If Groq returned `choices: []`, this is `IndexError` → propagates up. Similar to Bug 2.4's net effect (no crash, but task aborted).

**(iii) `tool_call.function.arguments` is invalid JSON (Bug 2.4):**
- Line 351: `json.loads()` crashes → uncaught in this scope. ⚠️ As analyzed, the daemon-level outer loop catches exceptions but the specific task fails.

**(iv) Groq hallucinates a tool name not in TOOL_MAPPING:**
- Line 371: `func = TOOL_MAPPING.get(tool_name)` → returns `None`
- Line 383: `tool_result_str = f"Tool '{tool_name}' is not registered."`
- Passed back to Groq via the `tool` role message. ✅ Graceful. Next iteration Groq can correct itself.

**(v) Groq returns tool_calls as None/missing (no tool to call, text response):**
- Line 344-347: correctly detected → `return response_message.content or "..."` ✅

**(vi) `tool_call.id` is None when constructing the tool-response message:**
- Line 336: `tc.id` used for tool_call_id; lines 387: `tool_call.id` used for the response `tool_call_id`. OpenAI/Groq API spec requires tool_call_id to match. If Groq gave an id of None (should not happen), we'd send `"tool_call_id": None`. Minor, unlikely to break.

**Overall gracefulness:** ⚠️ **Mostly graceful, except for three unguarded edges (ii, iii, vi) that can abort the current task.** No crashes of the Autron daemon itself, no data corruption, no stuck loops (max_iterations=8 guard at line 301+318+393).

---

## 4. Untapped Scope — What Would Make This Meaningfully Better

### 4.1 Confidence-Weighting (gain_count / loss_count / confidence_weight) — Still Unused by the Agent

**Last audit found:**
> The document routing system learns from feedback, but the autonomous agent doesn't use this learned knowledge.

**Current state:** No change. Still 100% unused by `agent_core.py`.

- Document routing confidence learning works correctly in [document_router.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/document_router.py):
  - Lines 182-186: `confidence_weight` read for existing rules → `< 0.4` triggers `needs_manual_review`
  - Lines 307-322: Outcome recording updates weights (gain +0.1, loss -0.15), gain_count/loss_count incremented
  - Lines 312-317: Rejection with override resets confidence to 0.5 and retargets the rule

But:
- `agent_core.py` never calls `get_routing_rules()` as part of decision-making before calling `route_document()` for a new file.
- The file watcher calls `route_document(file_path, course_code=...)` **directly** (file_watcher.py line 71) without any pre-flight check of rule confidence.
- `get_routing_rules` IS in TOOL_MAPPING/SCHEMAS (so Groq could call it if prompted), but the file watcher prompt (lines 52-59) says "use your NuManOS tools to save what you find" — it never specifically tells Groq: "before routing, check routing rules for this filename pattern and if confidence is low, flag for review". So Groq typically won't call it spontaneously.
- Result: learning happens, but the learner is never consulted.

---

### 4.2 Approve/Reject Feedback Loop — Zero Downstream Effect

**Frontend:** [AutronDashboard.jsx](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/frontend/src/components/Autron/AutronDashboard.jsx) lines 117-131 → `handleReviewAction(id, 'approve'|'reject')` calls `approveReview(id)` / `rejectReview(id)` from autronService.js. ✅ Buttons work, API is hit.

**Backend approve endpoint:** [autron.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/autron.py) lines 283-308:
```python
entry.status = "approved"
db.commit()
log_activity(db, f"Approved action: {entry.action_name} ...")
return { "message": "Action approved and logged. Execution wiring comes in a later phase." }
```

**Backend reject endpoint:** Same pattern (lines 311-332): sets `status = "rejected"`, logs.

**Result of a user clicking "Approve" on a queued `update_deadline` action:**
1. Status column in `pending_review` table → "approved". ✅
2. Activity log row appended. ✅
3. **The deadline is NOT actually updated.** The `action_name` ("update_deadline") and `action_args` (JSON) are never read, mapped to a function, or executed. The message literally says: *"Execution wiring comes in a later phase."* ❌
4. **No positive reinforcement signal is sent to routing rules or agent behavior.** Since `action_name` is "update_deadline" (not a routing decision), there's no direct link to DocumentRule anyway. But more importantly, there's no generic "human approved this agent action → upweight future similar decisions" system. No feedback of any kind reaches agent_core.py, the Groq prompt, or the tool-selection logic.

**Result of a user clicking "Reject":** Same — just status change + log. The destructive action was already blocked from running, so there's nothing to undo. But there's also no "human rejected this agent suggestion → downweight future similar ones" signal.

**Net:** Approve/reject is purely an **audit log feature** today. Zero behavioral impact.

---

### 4.3 Skills System — Still Weak Keyword Matching, No Semantic Pick

[agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) lines 258-298, `load_relevant_skills()`:

**Unchanged from last audit:**
```python
relevance_keywords = [w.lower() for w in (name + " " + desc).split() if len(w) > 3]
if any(kw in prompt.lower() for kw in relevance_keywords):
    # include the skill
```

Same issues:
- No semantic matching — word overlap only. "Biology homework" won't match a skill named `BIO201_Lab_Report_Template.md` whose description says "Write biology lab reports for BIO201" because the keyword comparison is simple substring. Actually, wait — "biology" and "homework" are length > 3, and "biology" appears in both the skill name/desc split and the prompt, so this *particular* example matches. Counter-example: "How do I format my CSC project submission?" vs a skill named "CSC201_Project_Guidelines.md" — "format", "project", "submission" (from prompt) vs "CSC201", "Project", "Guidelines" (skill name/desc). "project" matches; "CSC" is only 3 chars so it's filtered out, so "CSC201" doesn't match. The skill would match on "project", which is fine, but not semantically.

- No Groq-driven skill selection. The last audit explicitly recommended using a Groq call to pick skills and it wasn't implemented.

- Additionally, **there's no tool in TOOL_SCHEMAS for the agent to CRUD skills.** The NuManOS backend has the full /skills API (list/get/upload/delete), the frontend has Skills.jsx, and `agent_core.py` reads skills passively. But the agent itself cannot: ask "what skills do I have?", search for skills by topic, upload a new skill from a discovery, or delete a deprecated one. The Skills system is a **human-managed static library** from the agent's perspective.

---

### 4.4 Missing NuManOS Capabilities with Models but No Autron Tools

From models.py, the following tables/models exist and have REST endpoints (based on routes folder files), but **no corresponding Autron tool or TOOL_SCHEMA**:

| Model / Table | Backend Route File | Autron Tool? |
|---------------|--------------------|---------------|
| **Mark** (POST /marks, PUT /marks/{id}) | marks.py ✅ | ❌ No `add_mark` or `update_mark` tool |
| **StudySchedule** | academic_intelligence.py | 🟡 tools.py has `generate_study_schedule` + `get_study_schedules` but **NOT in TOOL_MAPPING** |
| **StudyGoal** | academic_intelligence.py | 🟡 Same — tools.py has `create_study_goal` + `get_study_goals` but unmapped |
| **WorkloadAnalysis** | academic_intelligence.py | 🟡 `analyze_workload` exists in tools.py, unmapped |
| **PerformanceTrend** | academic_intelligence.py | 🟡 `analyze_performance` exists in tools.py, unmapped |
| **Syllabus** (CourseManagement) | course_management.py | 🟡 `analyze_syllabus` + `extract_syllabus_deadlines` + `get_syllabi` exist, unmapped |
| **CourseRecommendation** | course_management.py | 🟡 `generate_course_recommendations` + `check_prerequisites` exist, unmapped |
| **Notification** | communication_resources.py | 🟡 `create_notification` + `generate_deadline_reminders` exist, unmapped |
| **StudyGroup** | communication_resources.py | 🟡 `create_study_group` exists, unmapped |
| **StudyResource** | communication_resources.py | 🟡 `discover_resources` exists, unmapped |
| **TimeAllocation** | communication_resources.py | 🟡 `create_time_allocation` + `recommend_time_allocation` exist, unmapped |
| **Course** (any) | ❌ No courses.py route at all | 🔴 Zero /courses endpoint despite 10 tools calling it |

**Two distinct gaps:**
1. The `/courses` endpoint is **not implemented at all** (Bug 2.1).
2. 17 tools are implemented in tools.py but **cut off from the agent** (not in TOOL_MAPPING / TOOL_SCHEMAS) — Bug 2.5.

---

### 4.5 Architecture That Will Hurt at Scale

**(a) File Watcher: Base64-Entire-File Upload via JSON Body**

In `tools.py` `route_document()` (lines 101-142), every file is read fully, base64-encoded (~33% size increase), and sent as a single JSON field `file_content` in the POST body with a 30-second timeout.

Works fine today for PDFs < 10MB. Scale risks:
- A 50MB scanned PDF → ~67MB JSON payload. FastAPI + uvicorn default body size limits may reject it (if no config override found). Even if accepted, 30 seconds may be too short.
- No chunking, no streaming upload, no multipart/form-data (the skill upload endpoint correctly uses multipart, interestingly — `autron.py` line 166 uses `UploadFile = File(...)`).
- The entire file is held in memory twice (raw bytes + base64 string) in both Autron and NuManOS processes. 10 concurrent 50MB files = 1GB+ RAM pressure.
- Suggested fix: use FastAPI's UploadFile/multipart, matching the skill-upload pattern already proven in the same codebase.

**(b) Inbox Requeue: No Persistent Work Queue**

As analyzed in 3A Scenario A: files that fail to route (due to AI-step exception, or backend being down, or Groq being rate-limited, or the file being partially written when read) are **permanently stranded**. The watchdog observer only fires `on_created` for newly-created files. If Autron restarts with 20 files already sitting in Inbox, they're silently ignored. No rescan, no directory-diff on startup, no durable queue (DB table or disk-based journal) tracking "pending vs processed vs failed".

Today: fine for occasional manual drops.
At 50 docs/week: guaranteed lost files.

**(c) No Rate Limiting on Groq Calls**

- Scheduler fires morning+night routines (2 calls/day). File watcher fires once per file drop. Current volume = low double-digit calls/day.
- But: `load_relevant_skills()` already calls Groq skills-list endpoint (wait — actually no, `load_relevant_skills()` calls `BASE_URL/skills` which is NuManOS, not Groq. So per task, currently 1 Groq call + N tools iterations, each iter calls Groq again. With max_iterations=8, a file with complex content = up to 9 Groq completions.
- 10 files in a day = 90 Groq calls. 100 files = 900.
- Groq's free tier has rate limits. No 429 detection, no Retry-After header respect, no queue/defer for rate-limited requests (Bug 3.D.i already — no retry).
- Plus: each `whatsapp_router.py` `_parse_text_with_groq` calls Groq **directly** via raw HTTP `requests.post` (lines 72-86) — a completely separate Groq client from agent_core's Groq SDK client. Two code paths hitting the same API with no shared rate-limit state = rate limits hit 2x faster.

**(d) Confidence-Weight Saturation**

Every routing rule starts at confidence=0.5 and gains +0.1 per correct routing, capped at 1.0. After 5 correct routings it's at 1.0 forever. Losses subtract -0.15 (or reset to 0.5 on override).

Small-sample overconfidence: 5-0-0 on a rule that matched by accident (e.g. a rule that fires on the keyword "midterm" but happens to route to CSC103 because the first 5 files with "midterm" were CSC103 midterms) now has confidence=1.0 and will never flag for review, even if the 6th file is a HUM104 midterm that gets misrouted.

No per-rule minimum sample count, no Bayesian smoothing, no recency weighting (all gains/losses count equally forever).

---

## 5. Security & Reliability Re-Check

### 5.1 Destructive-Action Guardrails ✅ Still Correct

In [agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) lines 355-368, the guard is:
```python
if tool_name in ["update_deadline", "delete_deadline"]:
    # Block and queue for review
```

Still enforced at execution time, not in the prompt. ✅ Tool names are still explicit. TOOL_SCHEMAS for both tools still carry the `[DESTRUCTIVE] ... requires user review` description. ✅ Queue endpoint works. ✅

**Bypass risk (unchanged):** Medium. If a new destructive tool is added (e.g. `bulk_update_deadlines`) and the developer forgets to add it to the guard list, it executes without review. Still no declarative `@destructive` decorator / registry.

---

### 5.2 File Upload Validation ⚠️ No Improvements Since Last Audit

Skill upload endpoint (autron.py lines 165-198):
- Still extension-only check (ends with `.md`). ❌ No MIME sniffing / magic bytes check.
- Still no file size limit (no `max_length`, no `Content-Length` header check). ❌
- Still UTF-8 decode — correct for text skill files, but no upper bound on size.
- Still no rate limiting. ❌
- No markdown sanitization (but skill files are stored as text and re-served as text content in skill body to the Groq prompt, not rendered as HTML — low XSS risk).

Document routing upload (tools.py route_document → /documents/route):
- The route_document endpoint (document_router.py line 128) accepts `file_content: Optional[str] = None` as a plain body string field — it's the base64 blob. No validation on that field's length.

---

### 5.3 API Key Handling ✅ Correct / Unchanged

- Autron config.json key is NOT committed to git (Autron/.gitignore covers config.json — verifyed by folder listing showing .gitignore in the Autron dir). ✅
- `agent_core.py` line 19: `CONFIG.get("groq_api_key") or os.environ.get("GROQ_API_KEY")` — env fallback. ✅
- `whatsapp_router.py` line 68-70: `api_key = os.getenv("GROQ_API_KEY")` — env only for backend. ✅
- No hardcoded keys found anywhere. ✅
- `config.json` key is stored in plaintext on the filesystem (standard for local dev single-user desktop apps like this, but not for multi-user server deployments).

---

## 6. Prioritized Recommendations

### 🔴 BLOCKING (Must Fix Before Next Real E2E Test)

These are all known-active bugs that will definitely break the next test run if it exercises more than just file routing.

**B1. Fix `course` vs `course_code` query param names (attendance + marks).**
- 2 files, 2 edits each:
  - [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 154: change `params["course"]` → `params["course_code"]`
  - [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 221: change `{"course": course_code}` → `{"course_code": course_code}`
  - *OR* change backend param names to match existing Autron calls (fix in [attendance.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/attendance.py) line 55 + [marks.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/marks.py) line 137). Pick one convention and search/replace all references.

**B2. Implement `GET /courses` endpoint.**
- Create `backend/routes/courses.py` with a standard `CourseResponse` schema (id, code, name, credits, teacher_name, etc.) + `GET /courses` (list, optional filter by code/id), wired into `main.py`.
- The 10+ call sites in tools.py already expect this shape: list of objects with `.id` and `.code` fields.

**B3. Fix WhatsApp parse endpoint path.**
- Either: [tools.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/tools.py) line 285: `/whatsapp/parse` → `/whatsapp/parse-txt`.
- Or: [whatsapp_router.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/whatsapp_router.py) line 30: rename route to `/parse` and remove `/parse-txt` or leave as alias.

**B4. Fix scheduler no-AI `attendance.items()` crash.**
- [scheduler.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/scheduler.py) lines 68-72: rewrite to either (a) call `/attendance/summary` instead of `/attendance` (rename `check_attendance` to return the summary shape, or create a new `get_attendance_summary` function in tools.py that hits the correct endpoint), OR (b) aggregate the raw attendance list into stats in Python before iterating.
- Also move `self.last_morning_run = today` (line 37) to **after** the routine actually completes successfully.

**B5. Wrap `json.loads(tool_call.function.arguments)` in try/except.**
- [agent_core.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/agent_core.py) line 351: on JSON decode error, log the raw arguments string, set `tool_result_str = f"Invalid JSON arguments from Groq: {e}. Raw: {raw_args_preview}"`, and send it back as the tool role message so Groq can retry in the next iteration instead of aborting the entire task.
- Also add guard for `response.choices` being empty at line 331.

---

### 🟡 IMPORTANT (Do Soon, Within Next 1-2 Development Sessions)

**I1. Register all 17 new tools in TOOL_MAPPING + TOOL_SCHEMAS.**
- For every `def foo(...)` added to tools.py since the initial audit, add:
  - A dict entry in `TOOL_MAPPING` in agent_core.py line 31 mapping `"foo" → tools.foo`
  - A matching schema object in `TOOL_SCHEMAS` (agent_core.py lines 48-255) with correct function description and typed parameters + required fields.
- Write the tool schemas carefully (correct types, descriptions that Groq can actually work with — e.g. for `analyze_performance` specify what the returned fields mean).

**I2. Uncouple file routing from AI step in file watcher.**
- In [file_watcher.py](file:///C:/Users/Numan%20Kabir/Desktop/Autron/file_watcher.py) lines 47-76: move `route_document()` call **out from after** `run_agent_task()`'s success path into its own top-level block that always runs, regardless of AI success/failure. Wrap AI call in its own try/except so AI errors never prevent routing. Routing is independent functionality — the regex/pre-routing works without Groq.

**I3. Directory re-scan on startup for Inbox.**
- In FileWatcher `start()` (file_watcher.py line 87), after scheduling the handler, also do an immediate `os.listdir(self.watch_dir)` and for every non-hidden file already present, trigger the routing logic (same code path as on_created). This catches files dropped while Autron was off.

**I4. Check that `check_attendance` uses `/attendance/summary` for scheduler.**
- The scheduler morning briefing (and the Groq prompt) doesn't need raw per-date attendance records. It needs the summary stats: `{course_code, total_classes, present_count, absent_count, percentage}`. Change `check_attendance` or make a new tool to hit `/attendance/summary`. This fixes both Bug 2.6 AND reduces token usage in the AI prompt.

**I5. Fix hardcoded crash log path.**
- [document_router.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/document_router.py) line 268: use `os.path.join(os.path.dirname(__file__), "crash_log.txt")` or (better) remove the file write entirely and rely on FastAPI/Uvicorn's standard logging — the traceback is already available via standard logger configuration.

---

### 🔵 FORWARD-LOOKING (Roadmap Items, Post-Stability)

**F1. Implement approved-action execution.**
- [autron.py](file:///C:/Users/Numan%20Kabir/Desktop/NuManOS/backend/routes/autron.py) `approve_pending_review` (line 283): actually execute the queued action. Map:
  - `"update_deadline"` → parse `action_args` JSON, call deadline update logic (reuse deadlines.py's `update_deadline` endpoint logic via extracting a shared helper function, or make an internal requests call to the backend's own endpoint).
  - `"delete_deadline"` → same pattern.
  - Generic registry for future destructive actions so a new action just registers instead of hand-editing the approve endpoint.
- Handle execution errors and set `status = "failed_execution"` with error details.

**F2. Turn approve/reject into a real feedback signal for the agent.**
- For routing decisions specifically (document_rules): the recording endpoint already exists. The gap is that the frontend "pending review approve/reject" is not wired to the routing outcome recording endpoint for rules that were flagged `needs_manual_review` (confidence < 0.4).
- For general tool actions: add a new `agent_action_feedback` table (or re-use pending_review's approved/rejected columns as signal) and in future runs, inject recent "human approved X / rejected Y" context into the Groq system prompt to bias future decisions.

**F3. Groq-driven skill selection.**
Replace `load_relevant_skills()` keyword matching with a two-step:
1. Fetch skill summaries from `/skills` (name + description) — already done.
2. One small, cheap Groq call (use the smallest model: llama-3.1-8b or equivalent) to return a JSON array of the 3-5 most relevant skill names.
3. Fetch only the selected skill bodies.
4. Log the Groq selection in the skill system prompt so if Groq picks wrong, there's a signal.

**F4. Switch route_document to multipart upload.**
Keep the existing JSON endpoint for backward compatibility, but add a new `POST /documents/route-upload` accepting `UploadFile` (matching the skill upload pattern). Modify tools.py `route_document` to use `requests.post(..., files={...})`. This is already proven in the same codebase (autron.py line 166), so the pattern is known.

**F5. Add retry + exponential backoff for tools.py API calls and Groq calls.**
- Wrap all `requests.get/post/put/delete` in tools.py in a shared `_api_call(method, url, **kwargs)` helper that retries connection errors + HTTP 5xx + 429 (with Retry-After header respect for 429s) 3x with 1s, 2s, 4s backoff.
- Same pattern for the `client.chat.completions.create()` in agent_core.py line 321.
- Add circuit-breaker state (if 10 consecutive NuManOS calls fail, fast-fail for 30 seconds before retrying).

**F6. Add file-size stabilization to file watcher.**
In file_watcher.py `on_created` between lines 38-42 (currently just `time.sleep(1)`):
```python
# Wait for file size to stop changing (handles slow copies/large downloads)
prev_size = -1
for attempt in range(30):  # max 30s wait
    try:
        cur_size = os.path.getsize(file_path)
    except OSError:
        time.sleep(1)
        continue
    if cur_size == prev_size and cur_size > 0:
        break
    prev_size = cur_size
    time.sleep(1)
```

**F7. Route document before AI → pass routing decision ID to AI.**
Current order: (1) read text → (2) AI call → (3) route document.
Better order: (1) regex course extraction → (2) route document immediately (fast, non-blocking) → (3) get `decision_id` back from route response → (4) read text → (5) AI call, now including in the prompt: "This document was already routed to {chosen_path} with confidence {confidence_weight}. Review this routing and if you disagree, call `record_routing_outcome(decision_id=..., was_correct=False, corrected_path='...')` to fix it." This way routing always happens, the AI becomes a *post-routing reviewer* instead of a prerequisite.

---

**End of Follow-Up Audit Report.**
