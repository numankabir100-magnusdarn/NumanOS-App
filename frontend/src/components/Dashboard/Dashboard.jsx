import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { TrendingUp, AlertCircle, Clock, BookOpen, Target, Calendar, CheckCircle, XCircle, Loader2, Bell } from 'lucide-react';
import MorningBrief from './MorningBrief';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const originalCourses = [
  { id: 1, code: "CSC101", name: "Applications of ICT", credits: 3, marks: 81, grade: "A-" },
  { id: 2, code: "CSC103", name: "Programming Fundamentals", credits: 4, marks: 74, grade: "B" },
  { id: 3, code: "HUM104", name: "Functional English", credits: 3, marks: 87, grade: "A" },
  { id: 4, code: "HUM112", name: "Islamic Studies", credits: 2, marks: 90, grade: "A" },
  { id: 5, code: "HUM161", name: "Fehm-e-Quran I", credits: 1, marks: 99, grade: "A+" },
  { id: 6, code: "HUM208", name: "Civics & Community Engagement", credits: 2, marks: 83, grade: "A-" },
  { id: 7, code: "HUM222", name: "Fundamentals of Int'l Relations", credits: 2, marks: 77, grade: "B+" }
];

const initialCGPA = 3.59;

const getHealthColor = (marks) => {
  if (marks >= 85) return 'health-green';
  if (marks >= 70) return 'health-yellow';
  return 'health-red';
};

const getGradeFromMarks = (marks) => {
  if (marks >= 95) return 'A+';
  if (marks >= 90) return 'A';
  if (marks >= 85) return 'A-';
  if (marks >= 80) return 'B+';
  if (marks >= 75) return 'B';
  if (marks >= 70) return 'B-';
  if (marks >= 65) return 'C+';
  if (marks >= 60) return 'C';
  if (marks >= 55) return 'D';
  return 'F';
};

const getGradePoints = (marks) => {
  if (marks >= 95) return 4.0;
  if (marks >= 90) return 4.0;
  if (marks >= 85) return 3.7;
  if (marks >= 80) return 3.3;
  if (marks >= 75) return 3.0;
  if (marks >= 70) return 2.7;
  if (marks >= 65) return 2.3;
  if (marks >= 60) return 2.0;
  if (marks >= 55) return 1.0;
  return 0.0;
};

const GPAMeter = ({ cgpa }) => {
  const percentage = (cgpa / 4.0) * 100;
  const data = [
    { name: 'CGPA', value: percentage },
    { name: 'Remaining', value: 100 - percentage }
  ];

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="text-lg font-semibold mb-4 text-[#8888aa]">Current CGPA</h3>
      <div className="flex items-center justify-center">
        <div className="relative">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                <Cell fill="#6c63ff" />
                <Cell fill="#1e1e2e" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#6c63ff]">{cgpa}</div>
              <div className="text-xs text-[#8888aa]">/ 4.00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CourseHealthCard = ({ course }) => {
  const healthClass = getHealthColor(course.marks);
  
  return (
    <div className="glass-card p-4 animate-slide-up hover:scale-105 transition-transform duration-200">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-bold text-white">{course.code}</h4>
          <p className="text-xs text-[#8888aa]">{course.name}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${healthClass}`}></div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="text-[#8888aa]">Marks</p>
          <p className="font-semibold text-white">{course.marks}</p>
        </div>
        <div className="text-right">
          <p className="text-[#8888aa]">Grade</p>
          <p className="font-bold text-[#6c63ff]">{course.grade}</p>
        </div>
      </div>
    </div>
  );
};

const DeadlineCard = ({ deadline }) => {
  const daysRemaining = Math.ceil((new Date(deadline.due_datetime) - new Date()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysRemaining <= 2;
  const isOverdue = daysRemaining < 0;
  
  return (
    <div className={`glass-card p-3 animate-slide-up ${isOverdue ? 'border-l-4 border-red-500' : isUrgent ? 'border-l-4 border-yellow-500' : ''}`}>
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-white text-sm">{deadline.title}</h4>
        {isOverdue && <XCircle className="text-red-500" size={16} />}
        {isUrgent && !isOverdue && <AlertCircle className="text-yellow-500" size={16} />}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8888aa]">{deadline.course_code || 'General'}</span>
        <span className={isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-[#6c63ff]'}>
          {isOverdue ? `Overdue by ${Math.abs(daysRemaining)}d` : `${daysRemaining}d left`}
        </span>
      </div>
    </div>
  );
};

const StudyScheduleItem = ({ schedule }) => {
  const date = new Date(schedule.scheduled_date);
  const isToday = date.toDateString() === new Date().toDateString();
  const isPast = date < new Date();
  
  return (
    <div className={`glass-card p-3 animate-slide-up ${isToday ? 'border border-[#6c63ff]' : isPast ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-white text-sm">{schedule.title}</h4>
        {schedule.status === 'completed' && <CheckCircle className="text-green-500" size={16} />}
        {schedule.status === 'pending' && isToday && <Clock className="text-[#6c63ff]" size={16} />}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8888aa]">{date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="text-[#6c63ff]">{schedule.duration_minutes}m</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [courses, setCourses] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [studySchedules, setStudySchedules] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cgpa, setCGPA] = useState('0.00');
  const [semesterBanner, setSemesterBanner] = useState(null); // { show, end_date, title, daysLeft }
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem('sem_banner_dismissed') === '1';
    } catch { return false; }
  });

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };

    const updateDate = () => {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      setCurrentDate(new Date().toLocaleDateString('en-US', options));
    };

    updateGreeting();
    updateDate();
    
    // Update greeting every minute
    const interval = setInterval(() => {
      updateGreeting();
      updateDate();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Use original courses data (Semester 1 stats)
      const coursesData = originalCourses.map(course => ({
        ...course,
        type: 'course',
        mastery: course.marks
      }));
      
      setCourses(coursesData);
      setCGPA(initialCGPA);

      // Fetch deadlines
      const deadlinesRes = await axios.get(`${API_BASE}/deadlines`);
      const upcomingDeadlines = deadlinesRes.data
        .filter(d => new Date(d.due_datetime) >= new Date())
        .sort((a, b) => new Date(a.due_datetime) - new Date(b.due_datetime))
        .slice(0, 5);
      setDeadlines(upcomingDeadlines);

      // Fetch study schedules
      const schedulesRes = await axios.get(`${API_BASE}/academic-intelligence/schedules?status=pending`);
      const upcomingSchedules = schedulesRes.data
        .filter(s => new Date(s.scheduled_date) >= new Date())
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
        .slice(0, 4);
      setStudySchedules(upcomingSchedules);

      // Fetch workload analysis
      try {
        const workloadRes = await axios.get(`${API_BASE}/academic-intelligence/workload`);
        setWorkload(workloadRes.data);
      } catch (e) {
        setWorkload(null);
      }

      // Fetch notifications
      try {
        const notifRes = await axios.get(`${API_BASE}/communication-resources/notifications?is_read=false`);
        setNotifications(notifRes.data.slice(0, 5));
      } catch (e) {
        setNotifications([]);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to original courses if API fails
      setCourses(originalCourses.map(c => ({ ...c, type: 'course', mastery: c.marks })));
      setCGPA(initialCGPA);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8 flex items-center justify-center">
        <Loader2 className="text-[#6c63ff] animate-spin" size={48} />
      </div>
    );
  }

  return (
    <>
      <MorningBrief />
      <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {greeting}, Numan 👋
              </h1>
              <p className="text-[#8888aa]">{currentDate}</p>
            </div>
            <div className="flex items-center gap-4">
              {notifications.length > 0 && (
                <div className="glass-card px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-[#1e1e2e]">
                  <Bell className="text-[#6c63ff]" size={20} />
                  <span className="text-white">{notifications.length}</span>
                </div>
              )}
              <div className="glass-card px-6 py-3 flex items-center gap-3">
                <span className="text-[#8888aa]">Live CGPA</span>
                <span className="text-2xl font-bold text-[#6c63ff]">{cgpa}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6 animate-slide-up">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="text-[#6c63ff]" size={18} />
                <span className="text-sm text-[#8888aa]">Courses</span>
              </div>
              <p className="text-2xl font-bold text-white">{courses.length}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="text-[#00d4aa]" size={18} />
                <span className="text-sm text-[#8888aa]">Deadlines</span>
              </div>
              <p className="text-2xl font-bold text-white">{deadlines.length}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Target className="text-[#2ed573]" size={18} />
                <span className="text-sm text-[#8888aa]">Study Tasks</span>
              </div>
              <p className="text-2xl font-bold text-white">{studySchedules.length}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="text-[#ff4757]" size={18} />
                <span className="text-sm text-[#8888aa]">Workload</span>
              </div>
              <p className="text-lg font-bold text-white">{workload ? `${workload.workload_score}/100` : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column - Courses & Deadlines */}
            <div className="col-span-2 space-y-6">
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen size={20} className="text-[#6c63ff]" />
                  Course Health
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {courses.map((course) => (
                    <CourseHealthCard key={course.id} course={course} />
                  ))}
                </div>
              </div>

              <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar size={20} className="text-[#6c63ff]" />
                  Upcoming Deadlines
                </h2>
                {deadlines.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {deadlines.map((deadline) => (
                      <DeadlineCard key={deadline.id} deadline={deadline} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[#8888aa] text-center py-8">No upcoming deadlines 🎉</p>
                )}
              </div>
            </div>

            {/* Right Column - CGPA, Schedule, Workload */}
            <div className="space-y-6">
              <GPAMeter cgpa={cgpa} />

              {studySchedules.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Target size={20} className="text-[#6c63ff]" />
                    Study Schedule
                  </h2>
                  <div className="space-y-3">
                    {studySchedules.map((schedule) => (
                      <StudyScheduleItem key={schedule.id} schedule={schedule} />
                    ))}
                  </div>
                </div>
              )}

              {workload && (
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-[#6c63ff]" />
                    Workload Analysis
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888aa]">Total Deadlines</span>
                      <span className="text-white">{workload.total_deadlines}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888aa]">High Priority</span>
                      <span className="text-red-400">{workload.high_priority_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888aa]">Conflicts</span>
                      <span className="text-yellow-400">{workload.conflict_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888aa]">Study Hours</span>
                      <span className="text-[#6c63ff]">{workload.recommended_study_hours}h</span>
                    </div>
                    {workload.recommendations && (
                      <div className="mt-4 p-3 bg-[#12121a] rounded-lg">
                        <p className="text-xs text-[#8888aa] whitespace-pre-line">{workload.recommendations}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
