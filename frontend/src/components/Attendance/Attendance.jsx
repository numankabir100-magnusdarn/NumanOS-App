import React, { useState, useEffect } from 'react';
import { School, Plus, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const Attendance = () => {
  const [records, setRecords] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ course_id: '', date: '', status: 'present' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, courseRes] = await Promise.all([
        axios.get(`${API_BASE}/attendance`),
        axios.get(`${API_BASE}/courses`),
      ]);
      setRecords(attRes.data || []);
      setCourses(courseRes.data || []);
    } catch (e) {
      setError('Failed to load attendance data.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.course_id || !formData.date) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/attendance`, formData);
      setFormData({ course_id: '', date: '', status: 'present' });
      fetchData();
    } catch (e) {
      setError('Failed to log attendance.');
    }
    setSubmitting(false);
  };

  const getStatusIcon = (status) => {
    if (status === 'present') return <CheckCircle size={16} className="text-green-400" />;
    if (status === 'absent') return <XCircle size={16} className="text-red-400" />;
    return <AlertCircle size={16} className="text-yellow-400" />;
  };

  const getAttendanceRate = (courseId) => {
    const courseRecords = records.filter(r => r.course_id === courseId);
    if (courseRecords.length === 0) return null;
    const present = courseRecords.filter(r => r.status === 'present').length;
    return Math.round((present / courseRecords.length) * 100);
  };

  if (loading) {
    return (
      <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8 flex items-center justify-center">
        <Loader2 className="text-[#6c63ff] animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <div className="p-3 rounded-xl bg-[#6c63ff]/20">
            <School className="text-[#6c63ff]" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Attendance</h1>
            <p className="text-[#8888aa]">Track your class attendance</p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-6 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Log Attendance Form */}
        <div className="glass-card p-6 mb-8 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Plus size={18} className="text-[#6c63ff]" />
            Log Attendance
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm text-[#8888aa] mb-1">Course</label>
              <select
                value={formData.course_id}
                onChange={e => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                required
              >
                <option value="">Select course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#8888aa] mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#8888aa] mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#6c63ff] text-white px-4 py-2 rounded-lg hover:bg-[#5a52e0] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Log
            </button>
          </form>
        </div>

        {/* Per-course attendance rates */}
        {courses.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {courses.map(course => {
              const rate = getAttendanceRate(course.id);
              const color = rate === null ? '#8888aa' : rate >= 75 ? '#2ed573' : rate >= 60 ? '#ffa502' : '#ff4757';
              return (
                <div key={course.id} className="glass-card p-4 animate-fade-in">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-white">{course.code}</p>
                      <p className="text-xs text-[#8888aa] truncate">{course.name}</p>
                    </div>
                    {rate !== null && (
                      <span className="text-lg font-bold" style={{ color }}>{rate}%</span>
                    )}
                  </div>
                  {rate === null && (
                    <p className="text-xs text-[#8888aa]">No records yet</p>
                  )}
                  {rate !== null && rate < 75 && (
                    <p className="text-xs text-red-400 mt-1">⚠ Below 75% threshold</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Records list */}
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Records</h2>
          {records.length === 0 ? (
            <p className="text-[#8888aa] text-center py-8">No attendance records yet.</p>
          ) : (
            <div className="space-y-2">
              {[...records].reverse().slice(0, 30).map(r => {
                const course = courses.find(c => c.id === r.course_id);
                return (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(r.status)}
                      <div>
                        <p className="text-sm text-white font-medium">{course ? course.code : `Course #${r.course_id}`}</p>
                        <p className="text-xs text-[#8888aa]">{r.date}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      r.status === 'present' ? 'bg-green-500/20 text-green-400' :
                      r.status === 'absent' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
