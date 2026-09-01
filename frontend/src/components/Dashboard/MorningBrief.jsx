import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Zap } from 'lucide-react';
import { callAI } from '../../services/aiService';

const SYSTEM_PROMPT = `You are NuManOS AI — personal academic assistant for Muhammad Numan Kabir, BS Computer Science student at COMSATS University Islamabad (CIIT/SP26-BCS-081/ISB).

Semester 1 CGPA: 3.59 | Dean's List ✅

Results:
- CSC101 ICT: 81 (A-)
- CSC103 Programming: 74 (B) ⚠️ weakest
- HUM104 English: 87 (A)
- HUM112 Islamic Studies: 90 (A)
- HUM161 Quran: 99 (A+)
- HUM208 Civics: 83 (A-)
- HUM222 IR: 77 (B+)

Known issues: CSC103 midterm was 8.5/25 — poor exam prep
Upcoming Semester 2: OOP, Discrete Math, Bioinformatics, Writing, Literature, Quran II
Target CGPA: 3.80+

COMSATS formula: Theory(Quiz15%+Assign10%+Mid25%+Final50%) × 0.75 + Lab(Assign25%+Mid25%+Final50%) × 0.25

Generate a concise, motivating morning brief. Keep it under 150 words. Be encouraging and specific.`;

const STORAGE_KEY = 'morningBriefLastShown';

const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const MorningBrief = () => {
  const [show, setShow] = useState(false);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('');

  useEffect(() => {
    const today = getTodayISO();
    let lastShown = '';
    try {
      lastShown = localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      lastShown = '';
    }

    if (lastShown === today) {
      return;
    }

    setShow(true);
    try {
      localStorage.setItem(STORAGE_KEY, today);
    } catch {}
    generateBrief();
  }, []);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const { result, provider: providerName } = await callAI(
        [{ role: 'user', content: 'Generate my morning brief for today. Include greeting, any urgent deadlines, my current GPA status, and one motivational thought.' }],
        SYSTEM_PROMPT
      );
      setBrief(result);
      setProvider(providerName);
    } catch (error) {
      setBrief('Good morning, Numan! 👋 Ready to crush it today? Your CGPA is 3.59 and you\'re on the Dean\'s List. Focus on improving CSC103 — that\'s your weakest area. Let\'s get to work! 💪');
      setProvider('Offline');
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card p-8 max-w-lg w-full mx-4 animate-slide-up">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-[#6c63ff]/20">
              <Sparkles className="text-[#6c63ff]" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Morning Brief</h2>
              <p className="text-sm text-[#8888aa]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-[#8888aa] hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="text-[#6c63ff] mx-auto mb-4 animate-spin" size={32} />
            <p className="text-[#8888aa]">Generating your brief...</p>
          </div>
        ) : (
          <>
            <div className="bg-[#12121a] rounded-lg p-6 mb-6">
              <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">{brief}</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-sm text-[#8888aa]">
                <Zap size={16} className="text-[#6c63ff]" />
                <span>via {provider}</span>
              </div>
            </div>

            <button
              onClick={() => setShow(false)}
              className="w-full bg-[#6c63ff] text-white py-3 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold"
            >
              Let's get to work 💪
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MorningBrief;
