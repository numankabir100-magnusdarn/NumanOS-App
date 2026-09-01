import React, { useState, useEffect } from 'react';
import { Network, Loader2, BookOpen, Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const KnowledgeGraph = () => {
  const [courses, setCourses] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, deadlinesRes, marksRes] = await Promise.all([
        axios.get(`${API_BASE}/courses`),
        axios.get(`${API_BASE}/deadlines`),
        axios.get(`${API_BASE}/marks`),
      ]);
      setCourses(coursesRes.data || []);
      setDeadlines(deadlinesRes.data || []);
      setMarks(marksRes.data || []);
    } catch (e) {
      setError('Failed to load knowledge graph data.');
    }
    setLoading(false);
  };

  const getCourseStats = (courseId) => {
    const courseDeadlines = deadlines.filter(d => d.course_id === courseId);
    const courseMarks = marks.filter(m => m.course_id === courseId);
    const pendingDeadlines = courseDeadlines.filter(d => d.status === 'pending').length;
    const completedDeadlines = courseDeadlines.filter(d => d.status === 'completed').length;
    
    let totalObtained = 0;
    let totalPossible = 0;
    courseMarks.forEach(m => {
      totalObtained += m.obtained;
      totalPossible += m.total;
    });
    const average = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : null;

    return { pendingDeadlines, completedDeadlines, average };
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
            <Network className="text-[#6c63ff]" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Knowledge Graph</h1>
            <p className="text-[#8888aa]">Course relationships, deadlines, and performance overview</p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-6 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Network size={64} className="text-[#2a2a3a] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No courses yet</h2>
            <p className="text-[#8888aa]">
              Add courses to build your academic knowledge graph.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="glass-card p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={16} className="text-[#6c63ff]" />
                  <span className="text-sm text-[#8888aa]">Total Courses</span>
                </div>
                <p className="text-2xl font-bold text-white">{courses.length}</p>
              </div>
              <div className="glass-card p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-[#00d4aa]" />
                  <span className="text-sm text-[#8888aa]">Pending Deadlines</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {deadlines.filter(d => d.status === 'pending').length}
                </p>
              </div>
              <div className="glass-card p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-yellow-400" />
                  <span className="text-sm text-[#8888aa]">Total Marks</span>
                </div>
                <p className="text-2xl font-bold text-white">{marks.length}</p>
              </div>
              <div className="glass-card p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} className="text-purple-400" />
                  <span className="text-sm text-[#8888aa]">Completed</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {deadlines.filter(d => d.status === 'completed').length}
                </p>
              </div>
            </div>

            {/* Course Cards */}
            <div className="grid grid-cols-2 gap-4">
              {courses.map(course => {
                const stats = getCourseStats(course.id);
                const avgColor = stats.average === null ? '#8888aa' : 
                  stats.average >= 85 ? '#2ed573' : 
                  stats.average >= 70 ? '#ffa502' : '#ff4757';
                
                return (
                  <div key={course.id} className="glass-card p-5 animate-slide-up hover:border-[#6c63ff]/40 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-white text-lg">{course.code}</p>
                        <p className="text-sm text-[#8888aa]">{course.name}</p>
                        <p className="text-xs text-[#8888aa] mt-1">{course.credits} credits</p>
                      </div>
                      {stats.average !== null && (
                        <div className="text-right">
                          <p className="text-2xl font-bold" style={{ color: avgColor }}>{stats.average}%</p>
                          <p className="text-xs text-[#8888aa]">Avg</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#1e1e2e]">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#00d4aa]" />
                        <div>
                          <p className="text-xs text-[#8888aa]">Pending</p>
                          <p className="text-sm font-semibold text-white">{stats.pendingDeadlines}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-purple-400" />
                        <div>
                          <p className="text-xs text-[#8888aa]">Completed</p>
                          <p className="text-sm font-semibold text-white">{stats.completedDeadlines}</p>
                        </div>
                      </div>
                    </div>

                    {stats.pendingDeadlines > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#1e1e2e]">
                        <p className="text-xs text-yellow-400 flex items-center gap-1">
                          <AlertCircle size={12} />
                          {stats.pendingDeadlines} upcoming deadline{stats.pendingDeadlines > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recent Deadlines */}
            {deadlines.length > 0 && (
              <div className="glass-card p-6 animate-slide-up">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-[#6c63ff]" />
                  Recent Deadlines
                </h2>
                <div className="space-y-2">
                  {deadlines.slice(0, 5).map(deadline => {
                    const course = courses.find(c => c.id === deadline.course_id);
                    return (
                      <div key={deadline.id} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            deadline.status === 'completed' ? 'bg-green-400' : 
                            deadline.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'
                          }`} />
                          <div>
                            <p className="text-sm text-white font-medium">{deadline.title}</p>
                            <p className="text-xs text-[#8888aa]">
                              {course ? course.code : `Course #${deadline.course_id}`} · {new Date(deadline.due_datetime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          deadline.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          deadline.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {deadline.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;
