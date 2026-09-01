import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Cloud, 
  FolderOpen, 
  Mail, 
  MessageSquare, 
  ExternalLink, 
  Plus,
  Clock,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit
} from 'lucide-react';
import { storage } from '../../services/storageService';
import axios from 'axios';

const courses = [
  { code: "CSC101", name: "Applications of ICT", color: "#6c63ff" },
  { code: "CSC103", name: "Programming Fundamentals", color: "#00d4aa" },
  { code: "HUM104", name: "Functional English", color: "#ff4757" },
  { code: "HUM112", name: "Islamic Studies", color: "#ffa502" },
  { code: "HUM161", name: "Fehm-e-Quran I", color: "#2ed573" },
  { code: "HUM208", name: "Civics & Community Engagement", color: "#e056fd" },
  { code: "HUM222", name: "Fundamentals of Int'l Relations", color: "#ff6b81" }
];

const platforms = [
  { id: 'cu_online', name: 'CU Online Portal', icon: Globe },
  { id: 'onedrive', name: 'OneDrive', icon: Cloud },
  { id: 'googledrive', name: 'Google Drive', icon: FolderOpen },
  { id: 'email', name: 'Email', icon: Mail },
  { id: 'whatsapp', name: 'WhatsApp Group', icon: MessageSquare }
];

const statuses = [
  { id: 'not_started', label: 'Not Started', color: '#8888aa' },
  { id: 'in_progress', label: 'In Progress', color: '#ffa502' },
  { id: 'submitted', label: 'Submitted', color: '#00d4aa' },
  { id: 'graded', label: 'Graded', color: '#6c63ff' }
];

const getTimeUntilDue = (dueDate) => {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  
  if (diff < 0) {
    return { text: 'OVERDUE', isOverdue: true, hours: Math.abs(diff / (1000 * 60 * 60)) };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return { text: `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`, isOverdue: false, hours: diff / (1000 * 60 * 60) };
  } else if (hours > 0) {
    return { text: `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`, isOverdue: false, hours: diff / (1000 * 60 * 60) };
  } else {
    return { text: `${minutes} minutes`, isOverdue: false, hours: diff / (1000 * 60 * 60) };
  }
};

const getUrgencyColor = (dueDate, status) => {
  if (status === 'submitted' || status === 'graded') {
    return 'border-gray-600';
  }
  
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 24) {
    return 'border-[#ff4757] shadow-[0_0_20px_rgba(255,71,87,0.3)]';
  } else if (hours < 72) {
    return 'border-[#ffa502] shadow-[0_0_20px_rgba(255,165,2,0.3)]';
  } else {
    return 'border-[#2ed573]';
  }
};

const getUrgencyGlow = (dueDate, status) => {
  if (status === 'submitted' || status === 'graded') {
    return '';
  }
  
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 24) {
    return 'animate-pulse-glow-red';
  } else if (hours < 72) {
    return 'animate-pulse-glow-yellow';
  } else {
    return '';
  }
};

const Deadlines = () => {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  
  const [newDeadline, setNewDeadline] = useState({
    course: '',
    title: '',
    dueDate: '',
    platform: '',
    link: '',
    status: 'not_started'
  });

  // Fetch deadlines from API on mount
  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/deadlines');
        // Normalize API response to match component format
        const normalized = response.data.map(d => ({
          id: d.id,
          course: d.course_code,
          title: d.title,
          dueDate: d.due_datetime,
          platform: d.platform || '',
          link: d.link || '',
          status: d.status,
          marks_obtained: d.marks_obtained
        }));
        setDeadlines(normalized);
        // Cache to localStorage
        storage.set('DEADLINES_CACHE', normalized);
        setIsOffline(false);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch deadlines from API:', err);
        // Fallback to localStorage cache
        const cached = storage.get('DEADLINES_CACHE') || storage.get('DEADLINES') || [];
        setDeadlines(cached);
        setIsOffline(true);
        setError('Backend unavailable - showing cached data');
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newDeadline.course && newDeadline.title && newDeadline.dueDate) {
      try {
        // Format due_date for API (YYYY-MM-DD)
        const dueDate = new Date(newDeadline.dueDate).toISOString().split('T')[0];
        
        const payload = {
          title: newDeadline.title,
          course_code: newDeadline.course,
          due_date: dueDate,
          platform: newDeadline.platform || null,
          status: newDeadline.status
        };

        const response = await axios.post('http://127.0.0.1:8000/deadlines', payload);
        
        // Normalize API response
        const created = {
          id: response.data.id,
          course: response.data.course_code,
          title: response.data.title,
          dueDate: response.data.due_datetime,
          platform: response.data.platform || '',
          link: response.data.link || '',
          status: response.data.status,
          marks_obtained: response.data.marks_obtained
        };
        
        setDeadlines([...deadlines, created].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
        // Update cache
        storage.set('DEADLINES_CACHE', [...deadlines, created].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
        setIsOffline(false);
        setError(null);
        
        setNewDeadline({
          course: '',
          title: '',
          dueDate: '',
          platform: '',
          link: '',
          status: 'not_started'
        });
      } catch (err) {
        console.error('Failed to save deadline to API:', err);
        // Fallback to localStorage if offline
        const deadline = {
          id: Date.now(),
          ...newDeadline,
          createdAt: new Date().toISOString()
        };
        setDeadlines([...deadlines, deadline].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
        storage.set('DEADLINES_CACHE', [...deadlines, deadline].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
        setIsOffline(true);
        setError('Backend unavailable - saved locally only');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deadline?')) {
      return;
    }

    try {
      await axios.delete(`http://127.0.0.1:8000/deadlines/${id}`);
      setDeadlines(deadlines.filter(d => d.id !== id));
      // Update cache
      storage.set('DEADLINES_CACHE', deadlines.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete deadline:', error);
      // Fallback to local only
      setDeadlines(deadlines.filter(d => d.id !== id));
      storage.set('DEADLINES_CACHE', deadlines.filter(d => d.id !== id));
    }
  };

  const handleStatusChange = (id, newStatus) => {
    setDeadlines(deadlines.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    // Trigger the fetch effect again by re-mounting or calling fetch directly
    window.location.reload();
  };

  const sortedDeadlines = [...deadlines].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const urgentCount = deadlines.filter(d => {
    const time = getTimeUntilDue(d.dueDate);
    return !time.isOverdue && time.hours < 24 && d.status !== 'submitted' && d.status !== 'graded';
  }).length;

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Deadline Manager</h1>
              <p className="text-[#8888aa]">Track and manage all your assignment deadlines</p>
            </div>
            <div className="flex items-center gap-3">
              {urgentCount > 0 && (
                <div className="glass-card px-4 py-2 flex items-center gap-2 bg-[#ff4757]/20 border-[#ff4757]">
                  <AlertTriangle className="text-[#ff4757]" size={20} />
                  <span className="text-[#ff4757] font-semibold">{urgentCount} urgent deadline{urgentCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {isOffline && (
                <div className="glass-card px-4 py-2 flex items-center gap-2 bg-[#ffa502]/20 border-[#ffa502]">
                  <AlertTriangle className="text-[#ffa502]" size={20} />
                  <span className="text-[#ffa502] font-semibold">Offline Mode</span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                className="glass-card p-2 flex items-center gap-2 text-[#8888aa] hover:text-white transition-colors"
                title="Refresh from backend"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 glass-card p-3 flex items-center gap-2 bg-[#ff4757]/20 border-[#ff4757] text-[#ff4757]">
              <AlertTriangle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="text-[#6c63ff]" size={24} />
              Add New Deadline
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Course</label>
                <select
                  value={newDeadline.course}
                  onChange={(e) => setNewDeadline({ ...newDeadline, course: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.code} value={course.code}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Task Title</label>
                <input
                  type="text"
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
                  placeholder="e.g., Assignment 3 - Data Structures"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Due Date & Time</label>
                <input
                  type="datetime-local"
                  value={newDeadline.dueDate}
                  onChange={(e) => setNewDeadline({ ...newDeadline, dueDate: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Submission Platform</label>
                <div className="grid grid-cols-5 gap-2">
                  {platforms.map(platform => {
                    const Icon = platform.icon;
                    const isSelected = newDeadline.platform === platform.id;
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => setNewDeadline({ ...newDeadline, platform: platform.id })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                          isSelected 
                            ? 'border-[#6c63ff] bg-[#6c63ff]/20' 
                            : 'border-[#1e1e2e] hover:border-[#6c63ff]'
                        }`}
                      >
                        <Icon size={20} className={isSelected ? 'text-[#6c63ff]' : 'text-[#8888aa]'} />
                        <span className="text-xs text-[#8888aa]">{platform.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {newDeadline.platform && (
                <div className="animate-fade-in">
                  <label className="block text-sm text-[#8888aa] mb-2">Submission Link</label>
                  <input
                    type="url"
                    value={newDeadline.link}
                    onChange={(e) => setNewDeadline({ ...newDeadline, link: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Status</label>
                <select
                  value={newDeadline.status}
                  onChange={(e) => setNewDeadline({ ...newDeadline, status: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                >
                  {statuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-[#6c63ff] text-white py-3 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Deadline
              </button>
            </form>
          </div>

          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="text-[#00d4aa]" size={24} />
              Upcoming Deadlines
            </h2>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {sortedDeadlines.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Clock className="text-[#8888aa] mx-auto mb-4" size={48} />
                  <p className="text-[#8888aa]">No deadlines yet. Add your first one above.</p>
                </div>
              ) : (
                sortedDeadlines.map((deadline) => {
                  const course = courses.find(c => c.code === deadline.course);
                  const platform = platforms.find(p => p.id === deadline.platform);
                  const status = statuses.find(s => s.id === deadline.status);
                  const timeInfo = getTimeUntilDue(deadline.dueDate);
                  const urgencyColor = getUrgencyColor(deadline.dueDate, deadline.status);
                  const urgencyGlow = getUrgencyGlow(deadline.dueDate, deadline.status);
                  const PlatformIcon = platform?.icon || ExternalLink;

                  return (
                    <div
                      key={deadline.id}
                      className={`glass-card p-5 ${urgencyColor} ${urgencyGlow} hover:scale-[1.02] transition-all duration-200`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: course?.color }}
                          ></div>
                          <span 
                            className="font-bold text-sm px-2 py-1 rounded"
                            style={{ backgroundColor: `${course?.color}20`, color: course?.color }}
                          >
                            {deadline.course}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDelete(deadline.id)}
                          className="p-2 rounded-lg bg-[#1e1e2e] hover:bg-[#ff4757]/20 text-[#8888aa] hover:text-[#ff4757] transition-colors"
                          title="Delete deadline"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-3">{deadline.title}</h3>

                      <div className="flex items-center gap-2 mb-3 text-sm text-[#8888aa]">
                        <PlatformIcon size={16} />
                        <span>{platform?.name || 'No platform'}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className={`font-bold ${timeInfo.isOverdue ? 'text-[#ff4757]' : 'text-[#00d4aa]'}`}>
                          {timeInfo.text}
                        </div>
                        <span 
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: `${status?.color}20`, color: status?.color }}
                        >
                          {status?.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={deadline.status}
                          onChange={(e) => handleStatusChange(deadline.id, e.target.value)}
                          className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                        >
                          {statuses.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        {deadline.link && (
                          <a
                            href={deadline.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#6c63ff] text-white px-3 py-2 rounded hover:bg-[#5a52e0] transition-colors"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Deadlines;
