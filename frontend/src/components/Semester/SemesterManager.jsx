import React, { useState, useEffect, useCallback } from 'react';
import { 
  Archive, 
  Calendar, 
  PlusCircle, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  X,
  Trash2,
  Download,
  Sparkles
} from 'lucide-react';
import {
  listSemesters,
  getActiveSemester,
  getSemesterSummary,
  createSemester,
  addCoursesToSemester,
  getCarryOverSuggestions,
  wrapupSemester,
} from '../../services/semesterService';

const SemesterManager = () => {
  const [semesters, setSemesters] = useState([]);
  const [activeSem, setActiveSem] = useState(null);
  const [activeSummary, setActiveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wrapLoading, setWrapLoading] = useState(false);
  const [wrapResult, setWrapResult] = useState(null);
  const [showConfirmWrap, setShowConfirmWrap] = useState(false);

  const [newForm, setNewForm] = useState({
    number: '',
    title: '',
    start_date: '',
    end_date: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [prevSemId, setPrevSemId] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [newCourses, setNewCourses] = useState([
    { code: '', name: '', credits: 3, teacher_name: '', teacher_email: '', included: true },
  ]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [listRes, activeRes] = await Promise.all([
        listSemesters().catch(() => ({ data: [] })),
        getActiveSemester().catch(() => ({ data: null })),
      ]);
      const list = listRes.data || [];
      setSemesters(list);
      const active = activeRes.data;
      setActiveSem(active);
      if (active) {
        try {
          const sumRes = await getSemesterSummary(active.id);
          setActiveSummary(sumRes.data);
        } catch (e) {
          setActiveSummary(null);
        }
        const archived = list.filter(s => s.status === 'archived' && s.id !== active.id);
        if (archived.length > 0) setPrevSemId(archived[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleWrapUp = async () => {
    if (!activeSem) return;
    setWrapLoading(true);
    setShowConfirmWrap(false);
    try {
      const res = await wrapupSemester(activeSem.id);
      const blob = new Blob([res.data], { type: 'application/zip' });
      const sizeBytes = blob.size;
      const sizeKB = Math.round(sizeBytes / 1024);
      const filename =
        res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ||
        `NuManOS_Semester_${activeSem.id}.zip`;
      const savedTo = res.headers['x-saved-to'];
      triggerDownload(blob, filename);
      setWrapResult({ filename, savedTo, sizeKB });
      await loadAll();
    } catch (e) {
      console.error('Wrap-up failed', e);
      alert('Wrap-up failed: ' + (e.response?.data?.detail || e.message));
    }
    setWrapLoading(false);
  };

  const loadSuggestions = useCallback(async () => {
    if (!prevSemId) {
      setSuggestions([]);
      return;
    }
    setSuggestLoading(true);
    try {
      const res = await getCarryOverSuggestions(prevSemId);
      const withIncluded = (res.data || []).map(s => ({ ...s, included: true }));
      setSuggestions(withIncluded);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    }
    setSuggestLoading(false);
  }, [prevSemId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const toggleSuggestion = (idx) => {
    const next = [...suggestions];
    next[idx].included = !next[idx].included;
    setSuggestions(next);
  };

  const updateSuggestion = (idx, field, value) => {
    const next = [...suggestions];
    next[idx][field] = value;
    setSuggestions(next);
  };

  const updateNewCourse = (idx, field, value) => {
    const next = [...newCourses];
    next[idx][field] = value;
    setNewCourses(next);
  };

  const addNewCourseRow = () => {
    setNewCourses([...newCourses, { code: '', name: '', credits: 3, teacher_name: '', teacher_email: '', included: true }]);
  };

  const removeNewCourseRow = (idx) => {
    if (newCourses.length === 1) {
      setNewCourses([{ code: '', name: '', credits: 3, teacher_name: '', teacher_email: '', included: true }]);
      return;
    }
    const next = newCourses.filter((_, i) => i !== idx);
    setNewCourses(next);
  };

  const handleStartSemester = async () => {
    const { number, title, start_date, end_date } = newForm;
    if (!number || !title || !start_date || !end_date) {
      alert('Please fill number, title, start date, and end date.');
      return;
    }
    const carriedCourses = suggestions.filter(s => s.included && s.code && s.name);
    const newCourseRows = newCourses.filter(c => c.included && c.code && c.name);
    const allCourses = [
      ...carriedCourses.map(s => ({
        code: s.code,
        name: s.name,
        credits: Number(s.credits),
        theory_weight: s.theory_weight ?? 75,
        lab_weight: s.lab_weight ?? 25,
        teacher_name: s.teacher_name || null,
        teacher_email: s.teacher_email || null,
        submission_pref: null,
      })),
      ...newCourseRows.map(c => ({
        code: c.code,
        name: c.name,
        credits: Number(c.credits),
        theory_weight: 75,
        lab_weight: 25,
        teacher_name: c.teacher_name || null,
        teacher_email: c.teacher_email || null,
        submission_pref: null,
      })),
    ];
    if (allCourses.length === 0) {
      alert('Please include at least one course (carry-over or new).');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await createSemester({
        number: Number(number),
        title,
        start_date,
        end_date,
      });
      try {
        await addCoursesToSemester(created.data.id, allCourses);
      } catch (e) {
        console.warn('Courses add failed', e);
      }
      setNewForm({ number: '', title: '', start_date: '', end_date: '' });
      setSuggestions([]);
      setNewCourses([{ code: '', name: '', credits: 3, teacher_name: '', teacher_email: '', included: true }]);
      alert('New semester started successfully!');
      await loadAll();
    } catch (e) {
      console.error(e);
      alert('Failed to create semester: ' + (e.response?.data?.detail || e.message));
    }
    setCreateLoading(false);
  };

  if (loading) {
    return (
      <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8 flex items-center justify-center">
        <Loader2 className="text-[#6c63ff] animate-spin" size={48} />
      </div>
    );
  }

  const archivedSems = semesters.filter(s => s.status === 'archived');

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Calendar className="text-[#6c63ff]" size={28} />
            Semester Manager
          </h1>
          <p className="text-[#8888aa]">Wrap up the current semester and set up the next one.</p>
        </div>

        {/* SECTION A — Wrap Up */}
        <div className="glass-card p-6 mb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Archive className="text-[#6c63ff]" size={22} />
              Section A — Wrap Up Current Semester
            </h2>
            {activeSem && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                activeSem.status === 'archived' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-900/40 text-green-400'
              }`}>
                {activeSem.status?.toUpperCase()}
              </span>
            )}
          </div>

          {!activeSem ? (
            <div className="py-12 text-center">
              <AlertCircle size={48} className="mx-auto text-yellow-400 mb-4" />
              <p className="text-[#8888aa] mb-4">No active semester. Create one in Section B below.</p>
            </div>
          ) : (
            <div>
              {activeSummary && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#12121a] p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-[#8888aa] mb-1">
                      <BookOpen size={16} /> Courses
                    </div>
                    <p className="text-2xl font-bold text-white">{activeSummary.course_count}</p>
                  </div>
                  <div className="bg-[#12121a] p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-[#8888aa] mb-1">
                      <Calendar size={16} /> Deadlines
                    </div>
                    <p className="text-2xl font-bold text-white">{activeSummary.deadline_count}</p>
                  </div>
                  <div className="bg-[#12121a] p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-[#8888aa] mb-1">
                      <CheckCircle size={16} /> Attendance
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {activeSummary.attendance_percentage != null
                        ? `${activeSummary.attendance_percentage}%`
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-[#8888aa]">
                      {activeSummary.attendance_present}/{activeSummary.attendance_total} present
                    </p>
                  </div>
                  <div className="bg-[#12121a] p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-[#8888aa] mb-1">
                      <Sparkles size={16} /> Docs
                    </div>
                    <p className="text-2xl font-bold text-white">{activeSummary.document_count}</p>
                    <p className="text-xs text-[#8888aa]">+ {activeSummary.decision_count} decisions</p>
                  </div>
                </div>
              )}

              <div className="bg-[#12121a] rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-[#8888aa] uppercase mb-1">Active Semester</p>
                    <p className="text-white font-semibold">{activeSummary?.title || activeSem.title || `${activeSem.name} ${activeSem.year}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8888aa] uppercase mb-1">Start Date</p>
                    <p className="text-white">{activeSummary?.start_date || activeSem.start_date || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8888aa] uppercase mb-1">End Date</p>
                    <p className="text-white">{activeSummary?.end_date || activeSem.end_date || '—'}</p>
                  </div>
                </div>
                {activeSummary?.course_count > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#1e1e2e]">
                    <p className="text-xs text-[#8888aa] uppercase mb-2">Courses</p>
                    <div className="flex flex-wrap gap-2">
                      {activeSummary.course_list.map(c => (
                        <span key={c.id} className="px-3 py-1 bg-[#1e1e2e] rounded-md text-sm text-white">
                          <span className="text-[#6c63ff] font-semibold">{c.code}</span>
                          <span className="text-[#8888aa] mx-1">·</span>
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {wrapResult ? (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-400 mt-1" size={20} />
                    <div>
                      <p className="text-green-300 font-semibold">
                        Semester wrapped up & archived successfully!
                      </p>
                      <p className="text-white mt-1">
                        <Download size={14} className="inline mr-1" />
                        <strong>{wrapResult.filename}</strong> ({wrapResult.sizeKB} KB)
                      </p>
                      {wrapResult.savedTo && !wrapResult.savedTo.startsWith('save_failed') && (
                        <p className="text-[#8888aa] text-sm mt-1">
                          Copy saved to: <span className="text-white">{wrapResult.savedTo}</span>
                        </p>
                      )}
                      <button
                        onClick={() => setWrapResult(null)}
                        className="mt-3 text-xs text-[#8888aa] hover:text-white"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeSem.status === 'archived' ? (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-300">This semester is already archived. Start a new one in Section B.</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmWrap(true)}
                  disabled={wrapLoading}
                  className="bg-gradient-to-r from-[#6c63ff] to-[#00d4aa] hover:opacity-90 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-lg flex items-center gap-2"
                >
                  {wrapLoading ? <Loader2 className="animate-spin" size={18} /> : <Archive size={18} />}
                  {wrapLoading ? 'Wrapping up...' : 'Wrap Up & Archive Semester'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* SECTION B — Start New */}
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <PlusCircle className="text-[#00d4aa]" size={22} />
            Section B — Start New Semester
          </h2>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm text-[#8888aa] mb-2">Semester Number</label>
              <input
                type="number"
                min={1}
                value={newForm.number}
                onChange={e => setNewForm({ ...newForm, number: e.target.value })}
                className="w-full bg-[#12121a] text-white border border-[#1e1e2e] rounded-lg px-4 py-2 focus:border-[#6c63ff] outline-none"
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="block text-sm text-[#8888aa] mb-2">Title</label>
              <input
                type="text"
                value={newForm.title}
                onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                className="w-full bg-[#12121a] text-white border border-[#1e1e2e] rounded-lg px-4 py-2 focus:border-[#6c63ff] outline-none"
                placeholder="e.g. Fall 2026"
              />
            </div>
            <div>
              <label className="block text-sm text-[#8888aa] mb-2">Start Date</label>
              <input
                type="date"
                value={newForm.start_date}
                onChange={e => setNewForm({ ...newForm, start_date: e.target.value })}
                className="w-full bg-[#12121a] text-white border border-[#1e1e2e] rounded-lg px-4 py-2 focus:border-[#6c63ff] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-[#8888aa] mb-2">End Date</label>
              <input
                type="date"
                value={newForm.end_date}
                onChange={e => setNewForm({ ...newForm, end_date: e.target.value })}
                className="w-full bg-[#12121a] text-white border border-[#1e1e2e] rounded-lg px-4 py-2 focus:border-[#6c63ff] outline-none"
              />
            </div>
          </div>

          {/* Carry-over */}
          {archivedSems.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-[#6c63ff]" />
                  Carry Over Courses From Previous Semester
                </h3>
                <div className="flex items-center gap-3">
                  <select
                    value={prevSemId}
                    onChange={e => setPrevSemId(e.target.value)}
                    className="bg-[#12121a] text-white border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm"
                  >
                    <option value="">— Select previous semester —</option>
                    {archivedSems.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title || `${s.name} ${s.year}`} (id={s.id})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadSuggestions}
                    disabled={!prevSemId || suggestLoading}
                    className="bg-[#1e1e2e] hover:bg-[#2a2a3e] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    {suggestLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    Suggest
                  </button>
                </div>
              </div>
              {suggestions.length > 0 && (
                <div className="bg-[#12121a] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e1e2e] text-[#8888aa]">
                      <tr>
                        <th className="p-3 text-left w-10">
                          <span className="sr-only">Include</span>
                        </th>
                        <th className="p-3 text-left">Code</th>
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left w-20">Credits</th>
                        <th className="p-3 text-left">Teacher</th>
                        <th className="p-3 text-left">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestions.map((s, idx) => (
                        <tr key={idx} className={s.included ? '' : 'opacity-40'}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={s.included}
                              onChange={() => toggleSuggestion(idx)}
                              className="w-4 h-4 accent-[#6c63ff]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={s.code}
                              onChange={e => updateSuggestion(idx, 'code', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={s.name}
                              onChange={e => updateSuggestion(idx, 'name', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min={1}
                              value={s.credits}
                              onChange={e => updateSuggestion(idx, 'credits', Number(e.target.value))}
                              className="w-20 bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={s.teacher_name || ''}
                              onChange={e => updateSuggestion(idx, 'teacher_name', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={s.teacher_email || ''}
                              onChange={e => updateSuggestion(idx, 'teacher_email', e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-[#1e1e2e] text-xs text-[#8888aa]">
                    {suggestions.filter(s => s.included).length} of {suggestions.length} selected. Uncheck to exclude, or click any field to edit.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New courses */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <PlusCircle size={18} className="text-[#00d4aa]" />
                Brand New Courses
              </h3>
              <button
                onClick={addNewCourseRow}
                className="text-sm bg-[#1e1e2e] hover:bg-[#2a2a3e] text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <PlusCircle size={14} /> Add Row
              </button>
            </div>
            <div className="bg-[#12121a] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1e1e2e] text-[#8888aa]">
                  <tr>
                    <th className="p-3 text-left w-10">#</th>
                    <th className="p-3 text-left">Code *</th>
                    <th className="p-3 text-left">Name *</th>
                    <th className="p-3 text-left w-20">Credits</th>
                    <th className="p-3 text-left">Teacher</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {newCourses.map((c, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-[#8888aa]">{idx + 1}</td>
                      <td className="p-3">
                        <input
                          value={c.code}
                          onChange={e => updateNewCourse(idx, 'code', e.target.value)}
                          placeholder="CSC101"
                          className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={c.name}
                          onChange={e => updateNewCourse(idx, 'name', e.target.value)}
                          placeholder="Course name"
                          className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={c.credits}
                          onChange={e => updateNewCourse(idx, 'credits', Number(e.target.value))}
                          className="w-20 bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={c.teacher_name}
                          onChange={e => updateNewCourse(idx, 'teacher_name', e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={c.teacher_email}
                          onChange={e => updateNewCourse(idx, 'teacher_email', e.target.value)}
                          className="w-full bg-transparent border border-transparent hover:border-[#1e1e2e] focus:border-[#6c63ff] text-white px-2 py-1 rounded outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => removeNewCourseRow(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleStartSemester}
            disabled={createLoading}
            className="bg-gradient-to-r from-[#00d4aa] to-[#6c63ff] hover:opacity-90 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-lg flex items-center gap-2"
          >
            {createLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
            {createLoading ? 'Creating...' : 'Start Semester'}
          </button>
        </div>
      </div>

      {/* Wrap-up confirm dialog */}
      {showConfirmWrap && activeSem && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6">
          <div className="glass-card max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Confirm Wrap-Up</h3>
              <button onClick={() => setShowConfirmWrap(false)} className="text-[#8888aa] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="text-[#cccccc] space-y-3 mb-6">
              <p>
                You're about to archive{" "}
                <span className="text-white font-semibold">
                  {activeSummary?.title || activeSem.title || `${activeSem.name} ${activeSem.year}`}
                </span>
                .
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Deadlines, attendance, marks, documents and decisions → exported as JSON</li>
                <li>Document files on disk → copied into a <code className="text-[#6c63ff]">documents/</code> subfolder</li>
                <li>Everything bundled into a .zip, saved to <code className="text-[#6c63ff]">C:\Users\Numan Kabir\Desktop\NuManOS_Archives\</code></li>
                <li>Browser will also download a copy</li>
                <li className="text-[#00d4aa]">Database rows are <strong>kept</strong> — only marked as <em>archived</em> for history</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmWrap(false)}
                className="px-4 py-2 rounded-lg text-[#8888aa] hover:text-white bg-[#1e1e2e]"
              >
                Cancel
              </button>
              <button
                onClick={handleWrapUp}
                disabled={wrapLoading}
                className="px-5 py-2 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e6] disabled:opacity-50 text-white font-semibold flex items-center gap-2"
              >
                {wrapLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                Yes, wrap it up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SemesterManager;
