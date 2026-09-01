import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Zap, Sparkles, Shuffle, Cloud, BookOpen, FileText, Target, AlertTriangle, XCircle } from 'lucide-react';
import { callAI, getActiveProviderStatus } from '../../services/aiService';
import { storage } from '../../services/storageService';

const courses = [
  { code: "CSC101", name: "Applications of ICT", credits: 3, marks: 81, grade: "A-" },
  { code: "CSC103", name: "Programming Fundamentals", credits: 4, marks: 74, grade: "B" },
  { code: "HUM104", name: "Functional English", credits: 3, marks: 87, grade: "A" },
  { code: "HUM112", name: "Islamic Studies", credits: 2, marks: 90, grade: "A" },
  { code: "HUM161", name: "Fehm-e-Quran I", credits: 1, marks: 99, grade: "A+" },
  { code: "HUM208", name: "Civics & Community Engagement", credits: 2, marks: 83, grade: "A-" },
  { code: "HUM222", name: "Fundamentals of Int'l Relations", credits: 2, marks: 77, grade: "B+" }
];

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

Be concise, specific, encouraging. Reference actual marks when advising.`;

const quickPrompts = [
  "📊 Analyze my GPA",
  "⚠️ What needs my attention?",
  "📅 Build me a study plan",
  "🎯 How to reach 3.8 CGPA?",
  "📝 Quiz me on Programming"
];

const AIAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState('');
  const [providerError, setProviderError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef(null);

  const [quizState, setQuizState] = useState({
    course: 'CSC103',
    topic: '',
    questionCount: 5,
    difficulty: 'medium',
    questions: [],
    currentQuestion: 0,
    score: 0,
    answered: false,
    selectedAnswer: null
  });

  const [assignmentState, setAssignmentState] = useState({
    course: 'CSC103',
    title: '',
    content: '',
    results: null
  });

  const [examState, setExamState] = useState({
    course: 'CSC103',
    daysUntilExam: 7,
    plan: null
  });

  useEffect(() => {
    const provider = storage.getString('AI_LAST_PROVIDER_NAME');
    setActiveProvider(provider || 'Not configured');
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (promptText = null) => {
    const message = promptText || input;
    if (!message.trim()) return;

    // Check provider status before sending
    const status = await getActiveProviderStatus();
    if (!status.online) {
      if (status.reason === 'model_not_found') {
        setProviderError('Groq is misconfigured. Please check your Model name in AI Manager.');
      } else if (status.reason === 'no_key') {
        setProviderError('No API key configured. Please configure an AI provider in AI Manager.');
      } else if (status.reason === 'invalid_key') {
        setProviderError('Invalid API key. Please check your API key in AI Manager.');
      } else {
        setProviderError('AI provider is offline. Please check your connection or try another provider.');
      }
      return;
    }

    setProviderError(null);
    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { result, provider } = await callAI([userMessage], SYSTEM_PROMPT);
      setActiveProvider(provider);
      setMessages(prev => [...prev, { role: 'assistant', content: result, provider }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error.message}. Please configure an AI provider in Settings.`,
        provider: 'Error'
      }]);
    }

    setLoading(false);
  };

  const handleQuickPrompt = (prompt) => {
    handleSend(prompt);
  };

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const prompt = `Generate ${quizState.questionCount} ${quizState.difficulty} multiple choice questions about ${quizState.topic || quizState.course} for a quiz. Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "explanation"
    }
  ]
}`;

      const { result } = await callAI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);
      
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const quizData = JSON.parse(jsonMatch[0]);
        setQuizState(prev => ({
          ...prev,
          questions: quizData.questions || [],
          currentQuestion: 0,
          score: 0,
          answered: false,
          selectedAnswer: null
        }));
      }
    } catch (error) {
      console.error('Quiz generation error:', error);
    }
    setLoading(false);
  };

  const handleQuizAnswer = (selectedIndex) => {
    if (quizState.answered) return;

    const currentQ = quizState.questions[quizState.currentQuestion];
    const isCorrect = selectedIndex === currentQ.correct;

    setQuizState(prev => ({
      ...prev,
      answered: true,
      selectedAnswer: selectedIndex,
      score: prev.score + (isCorrect ? 1 : 0)
    }));
  };

  const nextQuestion = () => {
    if (quizState.currentQuestion < quizState.questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
        answered: false,
        selectedAnswer: null
      }));
    }
  };

  const checkAssignment = async (checkType) => {
    setLoading(true);
    try {
      const prompt = `Check this ${checkType} for the assignment "${assignmentState.title}" in ${assignmentState.course}:\n\n${assignmentState.content}\n\nProvide specific feedback and suggestions for improvement.`;
      
      const { result } = await callAI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);
      setAssignmentState(prev => ({
        ...prev,
        results: { type: checkType, feedback: result }
      }));
    } catch (error) {
      console.error('Assignment check error:', error);
    }
    setLoading(false);
  };

  const generateExamPlan = async () => {
    setLoading(true);
    try {
      const course = courses.find(c => c.code === examState.course);
      const prompt = `Generate a day-by-day study plan for ${examState.daysUntilExam} days until my ${examState.course} exam. My current marks: ${course?.marks} (${course?.grade}). Focus on weak areas and provide specific topics to cover each day.`;
      
      const { result } = await callAI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);
      setExamState(prev => ({ ...prev, plan: result }));
    } catch (error) {
      console.error('Exam plan error:', error);
    }
    setLoading(false);
  };

  const getProviderIcon = (provider) => {
    if (provider.includes('Groq')) return Zap;
    if (provider.includes('Gemini')) return Sparkles;
    if (provider.includes('OpenRouter')) return Shuffle;
    if (provider.includes('Cloudflare')) return Cloud;
    return Bot;
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)]">
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Bot className="text-[#6c63ff]" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-white">NuManOS AI</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#8888aa]">Powered by</span>
                {(() => {
                  const Icon = getProviderIcon(activeProvider);
                  return <Icon size={16} className="text-[#6c63ff]" />;
                })()}
                <span className="text-sm text-[#6c63ff] font-semibold">{activeProvider}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 h-[calc(100%-6rem)]">
          <div className="col-span-2 glass-card flex flex-col animate-slide-up">
            {activeTab === 'chat' && (
              <>
                {providerError && (
                  <div className="flex items-center gap-3 bg-[#ff4757]/10 border border-[#ff4757]/30 rounded-lg p-4 m-4">
                    <AlertTriangle className="text-[#ff4757]" size={20} />
                    <span className="text-[#ff4757] text-sm">{providerError}</span>
                    <button
                      onClick={() => setProviderError(null)}
                      className="ml-auto text-[#8888aa] hover:text-white"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <Bot className="text-[#6c63ff] mx-auto mb-4" size={48} />
                      <p className="text-white text-lg mb-4">How can I help you today?</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {quickPrompts.map((prompt, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuickPrompt(prompt)}
                            className="px-4 py-2 bg-[#12121a] text-[#8888aa] rounded-full hover:bg-[#6c63ff] hover:text-white transition-colors text-sm"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-[#6c63ff] flex items-center justify-center flex-shrink-0">
                          <Bot size={16} className="text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] p-4 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-[#6c63ff] text-white'
                            : 'bg-[#12121a] text-white'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.role === 'assistant' && msg.provider && msg.provider !== 'Error' && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-[#8888aa]">
                            {(() => {
                              const Icon = getProviderIcon(msg.provider);
                              return <Icon size={12} />;
                            })()}
                            <span>via {msg.provider}</span>
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-[#00d4aa] flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-[#0a0a0f]" />
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#6c63ff] flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-white" />
                      </div>
                      <div className="bg-[#12121a] p-4 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#6c63ff] rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-[#6c63ff] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-[#6c63ff] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <p className="text-sm text-[#8888aa] mt-2">NuManOS AI is thinking...</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-[#1e1e2e]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask me anything about your studies..."
                      className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={loading || !input.trim()}
                      className="bg-[#6c63ff] text-white p-3 rounded-lg hover:bg-[#5a52e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="glass-card p-4 animate-slide-up overflow-y-auto">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                  activeTab === 'chat' ? 'bg-[#6c63ff] text-white' : 'bg-[#12121a] text-[#8888aa]'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                  activeTab === 'quiz' ? 'bg-[#6c63ff] text-white' : 'bg-[#12121a] text-[#8888aa]'
                }`}
              >
                Quiz
              </button>
              <button
                onClick={() => setActiveTab('assignment')}
                className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                  activeTab === 'assignment' ? 'bg-[#6c63ff] text-white' : 'bg-[#12121a] text-[#8888aa]'
                }`}
              >
                Check
              </button>
              <button
                onClick={() => setActiveTab('exam')}
                className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
                  activeTab === 'exam' ? 'bg-[#6c63ff] text-white' : 'bg-[#12121a] text-[#8888aa]'
                }`}
              >
                Plan
              </button>
            </div>

            {activeTab === 'quiz' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Course</label>
                  <select
                    value={quizState.course}
                    onChange={(e) => setQuizState({ ...quizState, course: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  >
                    {courses.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Topic</label>
                  <input
                    type="text"
                    value={quizState.topic}
                    onChange={(e) => setQuizState({ ...quizState, topic: e.target.value })}
                    placeholder="e.g., Arrays, Functions"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Questions</label>
                    <select
                      value={quizState.questionCount}
                      onChange={(e) => setQuizState({ ...quizState, questionCount: parseInt(e.target.value) })}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                    >
                      {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Difficulty</label>
                    <select
                      value={quizState.difficulty}
                      onChange={(e) => setQuizState({ ...quizState, difficulty: e.target.value })}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                    >
                      {['easy', 'medium', 'hard'].map(d => <option key={d} value={d} capitalize>{d}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={generateQuiz}
                  disabled={loading}
                  className="w-full bg-[#6c63ff] text-white py-2 rounded-lg hover:bg-[#5a52e0] transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Generate Quiz'}
                </button>

                {quizState.questions.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888aa]">Question {quizState.currentQuestion + 1}/{quizState.questions.length}</span>
                      <span className="text-[#6c63ff]">Score: {quizState.score}</span>
                    </div>
                    <div className="w-full bg-[#1e1e2e] rounded-full h-2">
                      <div
                        className="bg-[#6c63ff] h-2 rounded-full transition-all"
                        style={{ width: `${((quizState.currentQuestion + 1) / quizState.questions.length) * 100}%` }}
                      />
                    </div>
                    {(() => {
                      const q = quizState.questions[quizState.currentQuestion];
                      return (
                        <div className="space-y-3">
                          <p className="text-white font-semibold">{q.question}</p>
                          {q.options.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuizAnswer(idx)}
                              disabled={quizState.answered}
                              className={`w-full text-left p-3 rounded-lg transition-colors ${
                                quizState.answered
                                  ? idx === q.correct
                                    ? 'bg-[#2ed573] text-[#0a0a0f]'
                                    : idx === quizState.selectedAnswer
                                    ? 'bg-[#ff4757] text-white'
                                    : 'bg-[#12121a] text-[#8888aa]'
                                  : 'bg-[#12121a] text-white hover:bg-[#1e1e2e]'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                          {quizState.answered && (
                            <div className="p-3 bg-[#12121a] rounded-lg">
                              <p className="text-sm text-[#8888aa]">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {quizState.answered && quizState.currentQuestion < quizState.questions.length - 1 && (
                      <button
                        onClick={nextQuestion}
                        className="w-full bg-[#6c63ff] text-white py-2 rounded-lg hover:bg-[#5a52e0] transition-colors"
                      >
                        Next Question
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assignment' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Course</label>
                  <select
                    value={assignmentState.course}
                    onChange={(e) => setAssignmentState({ ...assignmentState, course: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  >
                    {courses.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Assignment Title</label>
                  <input
                    type="text"
                    value={assignmentState.title}
                    onChange={(e) => setAssignmentState({ ...assignmentState, title: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Assignment Content</label>
                  <textarea
                    value={assignmentState.content}
                    onChange={(e) => setAssignmentState({ ...assignmentState, content: e.target.value })}
                    placeholder="Paste your assignment here..."
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white h-32 resize-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => checkAssignment('structure')}
                    disabled={loading || !assignmentState.content}
                    className="bg-[#12121a] text-white py-2 rounded-lg hover:bg-[#1e1e2e] transition-colors text-sm disabled:opacity-50"
                  >
                    Structure
                  </button>
                  <button
                    onClick={() => checkAssignment('completeness')}
                    disabled={loading || !assignmentState.content}
                    className="bg-[#12121a] text-white py-2 rounded-lg hover:bg-[#1e1e2e] transition-colors text-sm disabled:opacity-50"
                  >
                    Completeness
                  </button>
                  <button
                    onClick={() => checkAssignment('suggestions')}
                    disabled={loading || !assignmentState.content}
                    className="bg-[#12121a] text-white py-2 rounded-lg hover:bg-[#1e1e2e] transition-colors text-sm disabled:opacity-50"
                  >
                    Suggestions
                  </button>
                </div>
                {assignmentState.results && (
                  <div className="p-3 bg-[#12121a] rounded-lg">
                    <p className="text-sm text-white whitespace-pre-wrap">{assignmentState.results.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'exam' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Course</label>
                  <select
                    value={examState.course}
                    onChange={(e) => setExamState({ ...examState, course: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  >
                    {courses.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Days Until Exam</label>
                  <input
                    type="number"
                    value={examState.daysUntilExam}
                    onChange={(e) => setExamState({ ...examState, daysUntilExam: parseInt(e.target.value) })}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white"
                  />
                </div>
                <button
                  onClick={generateExamPlan}
                  disabled={loading}
                  className="w-full bg-[#6c63ff] text-white py-2 rounded-lg hover:bg-[#5a52e0] transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Generate Study Plan'}
                </button>
                {examState.plan && (
                  <div className="p-3 bg-[#12121a] rounded-lg">
                    <p className="text-sm text-white whitespace-pre-wrap">{examState.plan}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
