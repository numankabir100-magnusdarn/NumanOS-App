import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  Clock, 
  School, 
  Users, 
  FolderOpen, 
  Bot, 
  Network,
  ChevronDown,
  ChevronRight,
  Upload,
  Settings as SettingsIcon,
  Brain,
  Smartphone,
  Cpu,
  Sparkles,
  Archive
} from 'lucide-react';
import { storage } from '../../services/storageService';

const Sidebar = () => {
  const location = useLocation();
  const [urgentCount, setUrgentCount] = useState(0);
  const [expandedSections, setExpandedSections] = useState({ documents: false });

  useEffect(() => {
    const updateUrgentCount = () => {
      const saved = storage.get('DEADLINES');
      if (saved) {
        const now = new Date();
        const urgent = saved.filter(d => {
          const due = new Date(d.dueDate);
          const diff = due - now;
          const hours = diff / (1000 * 60 * 60);
          return !d.isOverdue && hours < 24 && hours > 0 && d.status !== 'submitted' && d.status !== 'graded';
        });
        setUrgentCount(urgent.length);
      }
    };

    updateUrgentCount();
    const interval = setInterval(updateUrgentCount, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/academic-engine', label: 'Academic Engine', icon: BarChart3 },
    { path: '/deadlines', label: 'Deadlines', icon: Clock },
    { path: '/attendance', label: 'Attendance', icon: School },
    { path: '/teachers', label: 'Teachers', icon: Users },
    { 
      id: 'documents', 
      label: 'Documents', 
      icon: FolderOpen, 
      hasSubmenu: true,
      submenu: [
        { path: '/documents', label: 'Document Vault' },
        { path: '/cdf-trainer', label: 'CDF Trainer', icon: Upload }
      ]
    },
    { path: '/whatsapp-import', label: 'WhatsApp Import', icon: Smartphone },
    { path: '/knowledge-graph', label: 'Knowledge Graph', icon: Network },
    { path: '/ai-assistant', label: 'AI Assistant', icon: Bot },
    { path: '/ai-manager', label: 'AI Manager', icon: Brain },
    { path: '/autron', label: 'Autron', icon: Cpu },
    { path: '/autron/skills', label: 'Autron Skills', icon: Sparkles },
    { path: '/semester-manager', label: 'Semester Manager', icon: Archive },
  ];

  const bottomNavItems = [
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-[#0a0a0f] border-r border-[#1e1e2e] flex flex-col z-50">
      <div className="p-6 border-b border-[#1e1e2e]">
        <h1 className="text-2xl font-bold text-[#6c63ff]">NuManOS</h1>
        <p className="text-xs text-[#8888aa] mt-1">Academic Management System</p>
      </div>

      <nav className="flex-1 py-4 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path ? location.pathname === item.path : false;
          const isExpanded = expandedSections[item.id];
          
          if (item.hasSubmenu) {
            return (
              <div key={item.id}>
                <button
                  onClick={() => setExpandedSections({ ...expandedSections, [item.id]: !isExpanded })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200 ${
                    location.pathname.startsWith('/documents') 
                      ? 'bg-[#6c63ff] text-white' 
                      : 'text-[#8888aa] hover:bg-[#12121a] hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium flex-1 text-left">{item.label}</span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-1 animate-fade-in">
                    {item.submenu.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location.pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                            isSubActive 
                              ? 'bg-[#6c63ff]/30 text-white' 
                              : 'text-[#8888aa] hover:bg-[#12121a] hover:text-white'
                          }`}
                        >
                          {SubIcon && <SubIcon size={16} />}
                          <span className="text-sm">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200 ${
                isActive 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'text-[#8888aa] hover:bg-[#12121a] hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
              {item.path === '/deadlines' && urgentCount > 0 && (
                <span className="ml-auto bg-[#ff4757] text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                  {urgentCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1e1e2e]">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-200 ${
                isActive 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'text-[#8888aa] hover:bg-[#12121a] hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
        
        <div className="glass-card p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#8888aa]">Current Semester</span>
            <span className="text-xs text-[#00d4aa] font-semibold">Spring 2026</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8888aa]">CGPA</span>
            <span className="text-2xl font-bold text-[#6c63ff]">3.59</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
