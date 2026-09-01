import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { getMarks, addMark, updateMark, deleteMark } from '../../services/api';

const courses = [
  { code: "CSC101", name: "Applications of ICT", credits: 3 },
  { code: "CSC103", name: "Programming Fundamentals", credits: 4 },
  { code: "HUM104", name: "Functional English", credits: 3 },
  { code: "HUM112", name: "Islamic Studies", credits: 2 },
  { code: "HUM161", name: "Fehm-e-Quran I", credits: 1 },
  { code: "HUM208", name: "Civics & Community Engagement", credits: 2 },
  { code: "HUM222", name: "Fundamentals of Int'l Relations", credits: 2 }
];

const defaultMarks = {
  "CSC101": [
    { id: 1, component: "Midterm", marks: 35, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 40, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 28, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 18, total: 20, weight: 10 }
  ],
  "CSC103": [
    { id: 1, component: "Midterm", marks: 30, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 35, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 20, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 15, total: 20, weight: 10 }
  ],
  "HUM104": [
    { id: 1, component: "Midterm", marks: 42, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 45, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 28, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 18, total: 20, weight: 10 }
  ],
  "HUM112": [
    { id: 1, component: "Midterm", marks: 45, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 48, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 29, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 19, total: 20, weight: 10 }
  ],
  "HUM161": [
    { id: 1, component: "Midterm", marks: 49, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 50, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 30, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 20, total: 20, weight: 10 }
  ],
  "HUM208": [
    { id: 1, component: "Midterm", marks: 40, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 42, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 27, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 17, total: 20, weight: 10 }
  ],
  "HUM222": [
    { id: 1, component: "Midterm", marks: 38, total: 50, weight: 30 },
    { id: 2, component: "Final", marks: 39, total: 50, weight: 40 },
    { id: 3, component: "Assignments", marks: 25, total: 30, weight: 20 },
    { id: 4, component: "Quiz", marks: 16, total: 20, weight: 10 }
  ]
};

const getGradeFromMarks = (marks) => {
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

const AcademicEngine = () => {
  const [selectedCourse, setSelectedCourse] = useState(courses[0].code);
  const [marks, setMarks] = useState(defaultMarks[selectedCourse]);
  const [newMark, setNewMark] = useState({ component: '', marks: '', total: '', weight: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [calculatedGrade, setCalculatedGrade] = useState('');

  useEffect(() => {
    const courseMarks = defaultMarks[selectedCourse] || [];
    setMarks(courseMarks);
    calculateGrade(courseMarks);
  }, [selectedCourse]);

  const calculateGrade = (currentMarks) => {
    let totalWeighted = 0;
    let totalWeight = 0;

    currentMarks.forEach(mark => {
      const percentage = (mark.marks / mark.total) * 100;
      totalWeighted += percentage * mark.weight;
      totalWeight += mark.weight;
    });

    const finalMarks = totalWeight > 0 ? (totalWeighted / totalWeight) : 0;
    setCalculatedGrade(getGradeFromMarks(finalMarks));
  };

  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
  };

  const handleAddMark = () => {
    if (newMark.component && newMark.marks && newMark.total && newMark.weight) {
      const markToAdd = {
        id: Date.now(),
        component: newMark.component,
        marks: parseInt(newMark.marks),
        total: parseInt(newMark.total),
        weight: parseInt(newMark.weight)
      };
      const updatedMarks = [...marks, markToAdd];
      setMarks(updatedMarks);
      calculateGrade(updatedMarks);
      setNewMark({ component: '', marks: '', total: '', weight: '' });
      setIsAdding(false);
    }
  };

  const handleDeleteMark = (id) => {
    const updatedMarks = marks.filter(mark => mark.id !== id);
    setMarks(updatedMarks);
    calculateGrade(updatedMarks);
  };

  const handleMarkChange = (id, field, value) => {
    const updatedMarks = marks.map(mark => {
      if (mark.id === id) {
        return { ...mark, [field]: field === 'component' ? value : parseInt(value) || 0 };
      }
      return mark;
    });
    setMarks(updatedMarks);
    calculateGrade(updatedMarks);
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-2">Academic Engine</h1>
          <p className="text-[#8888aa]">Track and manage your course marks</p>
        </div>

        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <label className="block text-sm text-[#8888aa] mb-2">Select Course</label>
              <select
                value={selectedCourse}
                onChange={handleCourseChange}
                className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none w-64"
              >
                {courses.map(course => (
                  <option key={course.code} value={course.code}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#8888aa] mb-1">Calculated Grade</p>
              <p className="text-4xl font-bold text-[#6c63ff]">{calculatedGrade}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-3 px-4 text-[#8888aa] font-semibold">Component</th>
                  <th className="text-left py-3 px-4 text-[#8888aa] font-semibold">Marks Obtained</th>
                  <th className="text-left py-3 px-4 text-[#8888aa] font-semibold">Total Marks</th>
                  <th className="text-left py-3 px-4 text-[#8888aa] font-semibold">Weight (%)</th>
                  <th className="text-left py-3 px-4 text-[#8888aa] font-semibold">Percentage</th>
                  <th className="text-right py-3 px-4 text-[#8888aa] font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((mark) => {
                  const percentage = ((mark.marks / mark.total) * 100).toFixed(1);
                  return (
                    <tr key={mark.id} className="border-b border-[#1e1e2e] hover:bg-[#12121a] transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={mark.component}
                          onChange={(e) => handleMarkChange(mark.id, 'component', e.target.value)}
                          className="bg-transparent border-none text-white focus:outline-none w-full"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={mark.marks}
                          onChange={(e) => handleMarkChange(mark.id, 'marks', e.target.value)}
                          className="bg-[#12121a] border border-[#1e1e2e] rounded px-3 py-2 text-white w-20 focus:border-[#6c63ff] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={mark.total}
                          onChange={(e) => handleMarkChange(mark.id, 'total', e.target.value)}
                          className="bg-[#12121a] border border-[#1e1e2e] rounded px-3 py-2 text-white w-20 focus:border-[#6c63ff] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={mark.weight}
                          onChange={(e) => handleMarkChange(mark.id, 'weight', e.target.value)}
                          className="bg-[#12121a] border border-[#1e1e2e] rounded px-3 py-2 text-white w-20 focus:border-[#6c63ff] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${percentage >= 80 ? 'text-[#2ed573]' : percentage >= 60 ? 'text-[#ffa502]' : 'text-[#ff4757]'}`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteMark(mark.id)}
                          className="text-[#ff4757] hover:text-[#ff6b81] transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isAdding && (
            <div className="mt-6 p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e] animate-fade-in">
              <h4 className="text-white font-semibold mb-4">Add New Mark Component</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Component Name</label>
                  <input
                    type="text"
                    value={newMark.component}
                    onChange={(e) => setNewMark({ ...newMark, component: e.target.value })}
                    placeholder="e.g., Quiz 1"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Marks Obtained</label>
                  <input
                    type="number"
                    value={newMark.marks}
                    onChange={(e) => setNewMark({ ...newMark, marks: e.target.value })}
                    placeholder="0"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Total Marks</label>
                  <input
                    type="number"
                    value={newMark.total}
                    onChange={(e) => setNewMark({ ...newMark, total: e.target.value })}
                    placeholder="100"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Weight (%)</label>
                  <input
                    type="number"
                    value={newMark.weight}
                    onChange={(e) => setNewMark({ ...newMark, weight: e.target.value })}
                    placeholder="10"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleAddMark}
                  className="flex items-center gap-2 bg-[#6c63ff] text-white px-4 py-2 rounded-lg hover:bg-[#5a52e0] transition-colors"
                >
                  <Save size={18} />
                  Save Component
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-lg border border-[#1e1e2e] text-[#8888aa] hover:text-white hover:border-[#6c63ff] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mt-6 flex items-center gap-2 bg-[#00d4aa] text-[#0a0a0f] px-4 py-2 rounded-lg hover:bg-[#00c29a] transition-colors font-semibold"
            >
              <Plus size={18} />
              Add Mark Component
            </button>
          )}
        </div>

        <div className="glass-card p-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Course Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#12121a] p-4 rounded-lg border border-[#1e1e2e]">
              <p className="text-sm text-[#8888aa] mb-1">Total Components</p>
              <p className="text-2xl font-bold text-white">{marks.length}</p>
            </div>
            <div className="bg-[#12121a] p-4 rounded-lg border border-[#1e1e2e]">
              <p className="text-sm text-[#8888aa] mb-1">Total Weight</p>
              <p className="text-2xl font-bold text-white">{marks.reduce((sum, m) => sum + m.weight, 0)}%</p>
            </div>
            <div className="bg-[#12121a] p-4 rounded-lg border border-[#1e1e2e]">
              <p className="text-sm text-[#8888aa] mb-1">Credits</p>
              <p className="text-2xl font-bold text-white">{courses.find(c => c.code === selectedCourse)?.credits || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicEngine;
