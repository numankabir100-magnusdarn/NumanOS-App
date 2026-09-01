import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Edit2, 
  Save, 
  User,
  GraduationCap
} from 'lucide-react';
import { storage } from '../../services/storageService';

const teachers = [
  {
    id: 1,
    name: "Umar Iqbal",
    course: "CSC101",
    courseName: "Applications of ICT",
    email: "umar.iqbal@comsats.edu.pk",
    submissionPreference: "CU Online Portal",
    strictness: "Moderate",
    notes: ""
  },
  {
    id: 2,
    name: "Dr. Rasool Bukhsh",
    course: "CSC103",
    courseName: "Programming Fundamentals",
    email: "rasool.bukhsh@comsats.edu.pk",
    submissionPreference: "Email",
    strictness: "Strict",
    notes: ""
  },
  {
    id: 3,
    name: "Maria Khan",
    course: "HUM104",
    courseName: "Functional English",
    email: "maria.khan@comsats.edu.pk",
    submissionPreference: "Google Drive",
    strictness: "Flexible",
    notes: ""
  },
  {
    id: 4,
    name: "Sana",
    course: "HUM112",
    courseName: "Islamic Studies",
    email: "sana@comsats.edu.pk",
    submissionPreference: "In-person",
    strictness: "Moderate",
    notes: ""
  },
  {
    id: 5,
    name: "Dr. Zainab Sadiq",
    course: "HUM161",
    courseName: "Fehm-e-Quran I",
    email: "zainab.sadiq@comsats.edu.pk",
    submissionPreference: "WhatsApp",
    strictness: "Very Flexible",
    notes: ""
  },
  {
    id: 6,
    name: "Jasmeen Bangash",
    course: "HUM208",
    courseName: "Civics & Community Engagement",
    email: "jasmeen.bangash@comsats.edu.pk",
    submissionPreference: "CU Online Portal",
    strictness: "Moderate",
    notes: ""
  },
  {
    id: 7,
    name: "Muhammad Younas",
    course: "HUM222",
    courseName: "Fundamentals of Int'l Relations",
    email: "muhammad.younas@comsats.edu.pk",
    submissionPreference: "Email",
    strictness: "Strict",
    notes: ""
  }
];

const courseColors = {
  "CSC101": "#6c63ff",
  "CSC103": "#00d4aa",
  "HUM104": "#ff4757",
  "HUM112": "#ffa502",
  "HUM161": "#2ed573",
  "HUM208": "#e056fd",
  "HUM222": "#ff6b81"
};

const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const Teachers = () => {
  const [teacherNotes, setTeacherNotes] = useState(() => {
    const saved = storage.get('TEACHER_NOTES');
    if (saved) {
      return saved;
    }
    return teachers.reduce((acc, teacher) => {
      acc[teacher.id] = {
        submissionPreference: teacher.submissionPreference,
        strictness: teacher.strictness,
        notes: teacher.notes
      };
      return acc;
    }, {});
  });

  const [editingTeacher, setEditingTeacher] = useState(null);

  useEffect(() => {
    storage.set('TEACHER_NOTES', teacherNotes);
  }, [teacherNotes]);

  const handleSaveNotes = (teacherId) => {
    setEditingTeacher(null);
  };

  const handleEdit = (teacherId) => {
    setEditingTeacher(teacherId);
  };

  const handleNoteChange = (teacherId, field, value) => {
    setTeacherNotes({
      ...teacherNotes,
      [teacherId]: {
        ...teacherNotes[teacherId],
        [field]: value
      }
    });
  };

  const handleEmailClick = (email) => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-2">Teacher Profiles</h1>
          <p className="text-[#8888aa]">Manage your course instructors and their preferences</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {teachers.map((teacher) => {
            const notes = teacherNotes[teacher.id] || {};
            const isEditing = editingTeacher === teacher.id;
            const courseColor = courseColors[teacher.course] || '#6c63ff';

            return (
              <div
                key={teacher.id}
                className="glass-card p-6 animate-slide-up hover:scale-[1.02] transition-transform duration-200"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: courseColor }}
                  >
                    {getInitials(teacher.name)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{teacher.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap size={16} className="text-[#8888aa]" />
                      <span 
                        className="text-sm px-2 py-1 rounded"
                        style={{ backgroundColor: `${courseColor}20`, color: courseColor }}
                      >
                        {teacher.course} - {teacher.courseName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="text-[#8888aa]" size={18} />
                    <a
                      href={`mailto:${teacher.email}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleEmailClick(teacher.email);
                      }}
                      className="text-[#6c63ff] hover:text-[#5a52e0] transition-colors text-sm"
                    >
                      {teacher.email}
                    </a>
                  </div>

                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Submission Preference</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={notes.submissionPreference || ''}
                        onChange={(e) => handleNoteChange(teacher.id, 'submissionPreference', e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                      />
                    ) : (
                      <p className="text-white">{notes.submissionPreference || teacher.submissionPreference}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Strictness Level</label>
                    {isEditing ? (
                      <select
                        value={notes.strictness || teacher.strictness}
                        onChange={(e) => handleNoteChange(teacher.id, 'strictness', e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                      >
                        <option value="Very Flexible">Very Flexible</option>
                        <option value="Flexible">Flexible</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Strict">Strict</option>
                        <option value="Very Strict">Very Strict</option>
                      </select>
                    ) : (
                      <p className="text-white">{notes.strictness || teacher.strictness}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Personal Notes</label>
                    {isEditing ? (
                      <textarea
                        value={notes.notes || ''}
                        onChange={(e) => handleNoteChange(teacher.id, 'notes', e.target.value)}
                        placeholder="Add your notes about this teacher..."
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-3 py-2 text-white focus:border-[#6c63ff] focus:outline-none resize-none h-20"
                      />
                    ) : (
                      <p className="text-white text-sm bg-[#12121a] p-3 rounded border border-[#1e1e2e] min-h-[60px]">
                        {notes.notes || 'No notes yet. Click edit to add notes.'}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {isEditing ? (
                      <button
                        onClick={() => handleSaveNotes(teacher.id)}
                        className="flex items-center gap-2 bg-[#2ed573] text-[#0a0a0f] px-4 py-2 rounded-lg hover:bg-[#26c46a] transition-colors font-semibold"
                      >
                        <Save size={16} />
                        Save Notes
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(teacher.id)}
                        className="flex items-center gap-2 bg-[#6c63ff] text-white px-4 py-2 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold"
                      >
                        <Edit2 size={16} />
                        Edit Notes
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Teachers;
