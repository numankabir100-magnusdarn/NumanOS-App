import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import AcademicEngine from './components/AcademicEngine/AcademicEngine';
import Deadlines from './components/Deadlines/Deadlines';
import Attendance from './components/Attendance/Attendance';
import Teachers from './components/Teachers/Teachers';
import Documents from './components/Documents/Documents';
import KnowledgeGraph from './components/KnowledgeGraph/KnowledgeGraph';
import CDFTrainer from './components/Documents/CDFTrainer';
import AIAssistant from './components/AIAssistant/AIAssistant';
import AIManager from './components/AIManager/AIManager';
import Settings from './components/Settings/Settings';
import WhatsAppImporter from './components/WhatsApp/WhatsAppImporter';
import AutronDashboard from './components/Autron/AutronDashboard';
import Skills from './components/Autron/Skills';
import SemesterManager from './components/Semester/SemesterManager';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/academic-engine" element={<AcademicEngine />} />
            <Route path="/deadlines" element={<Deadlines />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/cdf-trainer" element={<CDFTrainer />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/ai-manager" element={<AIManager />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/whatsapp-import" element={<WhatsAppImporter />} />
            <Route path="/autron" element={<AutronDashboard />} />
            <Route path="/autron/skills" element={<Skills />} />
            <Route path="/semester-manager" element={<SemesterManager />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
