const KEYS = {
  AI_KEY_GROQ: 'numanOS_ai_key_groq',
  AI_KEY_GEMINI: 'numanOS_ai_key_gemini',
  AI_KEY_OPENROUTER: 'numanOS_ai_key_openrouter',
  AI_KEY_CLOUDFLARE: 'numanOS_ai_key_cloudflare',
  AI_PRIMARY: 'numanOS_ai_primary',
  AI_SECONDARY: 'numanOS_ai_secondary',
  AI_TERTIARY: 'numanOS_ai_tertiary',
  AI_STRATEGY: 'numanOS_ai_strategy',
  AI_TASK_ROUTES: 'numanOS_ai_task_routes',
  AI_USAGE: 'numanOS_ai_usage',
  AI_REQUEST_LOG: 'numanOS_ai_request_log',
  AI_CLOUDFLARE_ACCOUNT_ID: 'numanOS_ai_cloudflare_account_id',
  DEADLINES: 'numanOS_deadlines',
  ATTENDANCE: 'numanOS_attendance',
  ATTENDANCE_HISTORY: 'numanOS_attendance_history',
  TEACHER_NOTES: 'numanOS_teacher_notes',
  DOCUMENTS: 'numanOS_documents',
  CONCEPTS: 'numanOS_concepts',
  QUICK_REFERENCE: 'numanOS_quick_reference',
  THEME: 'numanOS_theme',
  PROFILE: 'numanOS_profile',
  LAST_BRIEF_DATE: 'numanOS_last_brief_date',
};

const MIGRATION_MAP = {
  'numanos_attendance': 'ATTENDANCE',
  'numanos_attendance_history': 'ATTENDANCE_HISTORY',
  'numanos_concepts': 'CONCEPTS',
  'numanos_teacher_notes': 'TEACHER_NOTES',
  'numanos_deadlines': 'DEADLINES',
  'numanos_documents': 'DOCUMENTS',
  'numanos_quick_reference': 'QUICK_REFERENCE',
};

const migrateData = () => {
  Object.entries(MIGRATION_MAP).forEach(([oldKey, newKey]) => {
    const oldData = localStorage.getItem(oldKey);
    const newData = localStorage.getItem(KEYS[newKey]);
    
    if (oldData && !newData) {
      localStorage.setItem(KEYS[newKey], oldData);
      localStorage.removeItem(oldKey);
    }
  });
};

migrateData();

export const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(KEYS[key]);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(KEYS[key], JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  remove: (key) => localStorage.removeItem(KEYS[key]),
  
  getString: (key) => {
    try {
      return localStorage.getItem(KEYS[key]) || '';
    } catch { return ''; }
  },
  setString: (key, value) => {
    try {
      localStorage.setItem(KEYS[key], value);
      return true;
    } catch { return false; }
  },
};

export { KEYS };
