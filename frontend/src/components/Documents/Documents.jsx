import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Code, 
  File, 
  Eye, 
  Edit2, 
  Trash2, 
  Printer,
  AlertTriangle,
  X,
  FolderOpen,
  BookOpen,
  Archive,
  Loader2
} from 'lucide-react';
import { storage } from '../../services/storageService';

const courses = [
  { code: "CSC101", name: "Applications of ICT", color: "#6c63ff" },
  { code: "CSC103", name: "Programming Fundamentals", color: "#00d4aa" },
  { code: "HUM104", name: "Functional English", color: "#ff4757" },
  { code: "HUM112", name: "Islamic Studies", color: "#ffa502" },
  { code: "HUM161", name: "Fehm-e-Quran I", color: "#2ed573" },
  { code: "HUM208", name: "Civics & Community Engagement", color: "#e056fd" },
  { code: "HUM222", name: "Fundamentals of Int'l Relations", color: "#ff6b81" }
];

const categories = [
  { id: 'lecture_notes', label: 'Lecture Notes' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'past_paper', label: 'Past Paper' },
  { id: 'reference', label: 'Reference' },
  { id: 'lab_work', label: 'Lab Work' },
  { id: 'quick_reference', label: 'Quick Reference' }
];

const semester2Courses = [
  { code: "CSC201", name: "Object-Oriented Programming", color: "#6c63ff" },
  { code: "CSC203", name: "Discrete Mathematics", color: "#00d4aa" },
  { code: "BIO201", name: "Bioinformatics", color: "#ff4757" },
  { code: "ENG201", name: "Expository Writing", color: "#ffa502" },
  { code: "ENG202", name: "Literature", color: "#2ed573" },
  { code: "HUM261", name: "Fehm-e-Quran II", color: "#e056fd" }
];

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return { icon: FileText, color: '#ff4757' };
  if (['doc', 'docx'].includes(ext)) return { icon: FileText, color: '#3498db' };
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return { icon: ImageIcon, color: '#2ed573' };
  if (['js', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return { icon: Code, color: '#9b59b6' };
  return { icon: File, color: '#8888aa' };
};

const suggestName = (filename, course) => {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const lowerName = nameWithoutExt.toLowerCase();
  
  let type = "Document";
  let topic = nameWithoutExt;
  let week = "Week ?";
  
  if (lowerName.includes('lec') || lowerName.includes('lecture')) {
    type = "Lecture";
    const lecMatch = lowerName.match(/lec(\d+)/);
    if (lecMatch) {
      topic = `Lecture ${lecMatch[1]}`;
    }
  } else if (lowerName.includes('assign') || lowerName.includes('hw') || lowerName.includes('homework')) {
    type = "Assignment";
    const assignMatch = lowerName.match(/assign(\d+)|hw(\d+)/);
    if (assignMatch) {
      topic = `Assignment ${assignMatch[1] || assignMatch[2]}`;
    }
  } else if (lowerName.includes('lab')) {
    type = "Lab Work";
    const labMatch = lowerName.match(/lab(\d+)/);
    if (labMatch) {
      topic = `Lab ${labMatch[1]}`;
    }
  } else if (lowerName.includes('paper') || lowerName.includes('exam') || lowerName.includes('final') || lowerName.includes('mid')) {
    type = "Past Paper";
  } else if (lowerName.includes('ref') || lowerName.includes('cheat') || lowerName.includes('sheet')) {
    type = "Quick Reference";
  }
  
  const weekMatch = lowerName.match(/week(\d+)|w(\d+)/);
  if (weekMatch) {
    week = `Week ${weekMatch[1] || weekMatch[2]}`;
  }
  
  return `${course} | ${type} | ${topic} | ${week}`;
};

const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  
  const distance = editDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const isDuplicate = (newFile, existingFiles) => {
  for (const file of existingFiles) {
    const similarity = calculateSimilarity(newFile.name.toLowerCase(), file.name.toLowerCase());
    if (similarity > 0.8) {
      return { isDuplicate: true, similarFile: file };
    }
  }
  return { isDuplicate: false, similarFile: null };
};

const Documents = () => {
  const [documents, setDocuments] = useState(() => {
    return storage.get('DOCUMENTS') || [];
  });
  
  const [viewingDoc, setViewingDoc] = useState(null);
  
  const [quickReferenceCards, setQuickReferenceCards] = useState(() => {
    const saved = storage.get('QUICK_REFERENCE');
    if (saved) {
      return saved;
    }
    return semester2Courses.map(course => ({
      id: Date.now() + course.code,
      course: course.code,
      courseName: course.name,
      color: course.color,
      content: ""
    }));
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    course: '',
    category: '',
    tags: '',
    suggestedName: ''
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [routingSuggestion, setRoutingSuggestion] = useState(null);
  const [routerRules, setRouterRules] = useState([]);
  const [routerDecisions, setRouterDecisions] = useState([]);
  const [showRouterInsights, setShowRouterInsights] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    storage.set('DOCUMENTS', documents);
  }, [documents]);

  useEffect(() => {
    storage.set('QUICK_REFERENCE', quickReferenceCards);
  }, [quickReferenceCards]);

  // API calls for document routing
  const routeDocument = async (fileName, extractedFeatures, fileContentBase64 = null) => {
    try {
      const payload = {
        file_name: fileName,
        extracted_features: extractedFeatures
      };
      
      if (fileContentBase64) {
        payload.file_content = fileContentBase64;
      }
      
      console.log("Sending file_content length:", payload.file_content?.length || 0);
      
      const response = await fetch('http://localhost:8000/documents/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Routing error:', error);
      return null;
    }
  };

  const recordRoutingOutcome = async (decisionId, outcome, overrideTarget = null) => {
    try {
      const payload = { decision_id: decisionId, outcome };
      if (overrideTarget) {
        payload.override_target = overrideTarget;
      }
      const response = await fetch('http://localhost:8000/documents/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error('Outcome recording error:', error);
      return null;
    }
  };

  const fetchRouterRules = async () => {
    try {
      const response = await fetch('http://localhost:8000/documents/rules');
      const data = await response.json();
      setRouterRules(data);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  const fetchRouterDecisions = async () => {
    try {
      const response = await fetch('http://localhost:8000/documents/decisions/recent?limit=20');
      const data = await response.json();
      setRouterDecisions(data);
    } catch (error) {
      console.error('Error fetching decisions:', error);
    }
  };

  useEffect(() => {
    if (showRouterInsights) {
      fetchRouterRules();
      fetchRouterDecisions();
    }
  }, [showRouterInsights]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file) => {
    setUploadFile(file);
    const suggested = suggestName(file.name, uploadForm.course || 'CSC101');
    setUploadForm({
      ...uploadForm,
      suggestedName: suggested
    });
    
    const duplicate = isDuplicate({ name: file.name }, documents);
    if (duplicate.isDuplicate) {
      setDuplicateWarning(duplicate.similarFile);
    } else {
      setDuplicateWarning(null);
    }

    // Extract features for routing
    const fileExt = file.name.split('.').pop().toLowerCase();
    const extractedFeatures = {
      file_type: fileExt,
      course_code: '',
      keywords: [fileExt]
    };

    // Try to detect course code from filename
    const courseMatch = file.name.match(/(CSC|HUM|BIO|ENG)\d{3}/i);
    if (courseMatch) {
      extractedFeatures.course_code = courseMatch[0].toUpperCase();
      extractedFeatures.keywords.push(courseMatch[0].toUpperCase());
    }

    // Read file as base64 for AI analysis using FileReader
    let fileContentBase64 = null;
    if (fileExt === 'pdf' || fileExt === 'docx' || fileExt === 'doc' || fileExt === 'txt') {
      try {
        setIsAnalyzing(true);
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1]; // Remove the data:... prefix
            fileContentBase64 = base64;
            console.log("File read complete, base64 length:", base64.length);
            resolve();
          };
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            reject(error);
          };
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error('Error reading file for analysis:', error);
      }
    }

    // Call routing API
    const routingResult = await routeDocument(file.name, extractedFeatures, fileContentBase64);
    setIsAnalyzing(false);
    
    if (routingResult) {
      setRoutingSuggestion({
        chosenPath: routingResult.chosen_path,
        decisionId: routingResult.decision_id,
        confidence: routingResult.confidence_weight,
        needsReview: routingResult.needs_manual_review,
        aiAnalyzed: routingResult.ai_analyzed || false
      });

      // Auto-fill course dropdown with the suggested path
      if (routingResult.chosen_path) {
        setUploadForm(prev => ({
          ...prev,
          course: routingResult.chosen_path
        }));
      }

      // Extract top_keyword from response for suggested name
      const keyword = routingResult.extracted_features?.top_keyword || 
                      routingResult.top_keyword || 
                      "Document";
      const suggested = `${routingResult.chosen_path || "Unknown"} | ${keyword} | Notes`;
      setUploadForm(prev => ({
        ...prev,
        suggestedName: suggested
      }));

      // Auto-fill category dropdown
      if (routingResult.doc_type) {
        setUploadForm(prev => ({
          ...prev,
          category: routingResult.doc_type
        }));
      } else if (routingResult.confidence_weight >= 0.7) {
        setUploadForm(prev => ({
          ...prev,
          category: 'lecture_notes'
        }));
      }
    }
  };

  const handleUpload = async () => {
    if (uploadFile && uploadForm.course && uploadForm.category) {
      // Read file as base64 for storage (fixed for large files)
      const arrayBuffer = await uploadFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      
      const newDoc = {
        id: Date.now(),
        name: uploadForm.suggestedName,
        originalName: uploadFile.name,
        course: uploadForm.course,
        category: uploadForm.category,
        tags: uploadForm.tags.split(',').map(t => t.trim()).filter(t => t),
        uploadDate: new Date().toISOString(),
        fileSize: uploadFile.size,
        fileType: uploadFile.type,
        fileContent: base64
      };
      
      // Record routing outcome
      if (routingSuggestion) {
        const userAccepted = uploadForm.course === routingSuggestion.chosenPath;
        const outcome = userAccepted ? 'gain' : 'loss';
        const overrideTarget = userAccepted ? null : uploadForm.course;
        await recordRoutingOutcome(routingSuggestion.decisionId, outcome, overrideTarget);
      }
      
      setDocuments([newDoc, ...documents]);
      setUploadFile(null);
      setUploadForm({ course: '', category: '', tags: '', suggestedName: '' });
      setDuplicateWarning(null);
      setRoutingSuggestion(null);
      setShowUploadZone(false);
    }
  };

  const handleDelete = (id) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  const handleRename = (id, newName) => {
    setDocuments(documents.map(d => d.id === id ? { ...d, name: newName } : d));
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCourse = filterCourse === 'all' || doc.course === filterCourse;
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCourse && matchesCategory;
  });

  const pastPapers = documents.filter(doc => doc.category === 'past_paper');

  const handleCardEdit = (cardId) => {
    setEditingCard(cardId);
  };

  const handleCardSave = (cardId, content) => {
    setQuickReferenceCards(cards => 
      cards.map(card => card.id === cardId ? { ...card, content } : card)
    );
    setEditingCard(null);
  };

  const handlePrint = (cardId) => {
    const card = quickReferenceCards.find(c => c.id === cardId);
    if (card) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${card.courseName} - Quick Reference</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: ${card.color}; }
              .content { white-space: pre-wrap; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>${card.courseName} (${card.course})</h1>
            <div class="content">${card.content}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-2">Document Vault</h1>
          <p className="text-[#8888aa]">Intelligent document management for your academic resources</p>
        </div>

        {showUploadZone && (
          <div className="glass-card p-6 mb-6 animate-slide-up border-2 border-dashed border-[#6c63ff]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Upload Document</h2>
              <button
                onClick={() => setShowUploadZone(false)}
                className="text-[#8888aa] hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div
              className="border-2 border-dashed border-[#1e1e2e] rounded-lg p-8 text-center mb-6 hover:border-[#6c63ff] transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <Upload className="text-[#6c63ff] mx-auto mb-4" size={48} />
              <p className="text-[#8888aa] mb-2">Drag and drop your file here</p>
              <p className="text-[#8888aa] text-sm mb-4">or</p>
              <label className="bg-[#6c63ff] text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-[#5a52e0] transition-colors">
                Browse Files
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {uploadFile && (
              <div className="animate-fade-in">
                {duplicateWarning && (
                  <div className="bg-[#ff4757]/20 border border-[#ff4757] rounded-lg p-4 mb-4 flex items-center gap-3">
                    <AlertTriangle className="text-[#ff4757]" size={20} />
                    <div>
                      <p className="text-[#ff4757] font-semibold">Similar file exists</p>
                      <p className="text-[#8888aa] text-sm">{duplicateWarning.name}</p>
                    </div>
                  </div>
                )}

                <div className="bg-[#12121a] rounded-lg p-4 mb-4">
                  <p className="text-white font-semibold mb-2">{uploadFile.name}</p>
                  <p className="text-[#8888aa] text-sm">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                </div>

                {isAnalyzing && (
                  <div className="bg-[#6c63ff]/10 border border-[#6c63ff]/30 rounded-lg p-4 mb-4 flex items-center gap-3">
                    <Loader2 className="animate-spin text-[#6c63ff]" size={20} />
                    <span className="text-[#6c63ff] font-medium">Reading document header (0 tokens burnt)...</span>
                  </div>
                )}

                {routingSuggestion && (
                  <div className={`rounded-lg p-4 mb-4 border ${
                    routingSuggestion.confidence >= 0.7 
                      ? 'bg-[#2ed573]/20 border-[#2ed573]' 
                      : routingSuggestion.confidence >= 0.4 
                        ? 'bg-[#ffa502]/20 border-[#ffa502]' 
                        : 'bg-[#ff4757]/20 border-[#ff4757]'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {routingSuggestion.confidence >= 0.7 
                            ? '✓ High confidence' 
                            : routingSuggestion.confidence >= 0.4 
                              ? '⚡ Learning' 
                              : '⚠️ Low confidence — please confirm'}
                        </span>
                        {routingSuggestion.aiAnalyzed && (
                          <span className="text-xs px-2 py-1 rounded bg-[#6c63ff]/20 text-[#6c63ff] border border-[#6c63ff]/30">
                            AI Analyzed
                          </span>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-[#0a0a0f]">
                        {Math.round(routingSuggestion.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm">
                      Suggested: <span className="font-semibold">{routingSuggestion.chosenPath}</span>
                    </p>
                    {routingSuggestion.needsReview && (
                      <p className="text-xs mt-1 opacity-75">Please verify the suggested path</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Course</label>
                    <select
                      value={uploadForm.course}
                      onChange={(e) => {
                        const suggested = suggestName(uploadFile.name, e.target.value);
                        setUploadForm({ ...uploadForm, course: e.target.value, suggestedName: suggested });
                      }}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                      required
                    >
                      <option value="">Select course</option>
                      {courses.map(course => (
                        <option key={course.code} value={course.code}>
                          {course.code} - {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-[#8888aa] mb-2">Category</label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-[#8888aa] mb-2">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="e.g., pointers, arrays, week3"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-[#8888aa] mb-2">Suggested Name</label>
                  <input
                    type="text"
                    value={uploadForm.suggestedName}
                    onChange={(e) => setUploadForm({ ...uploadForm, suggestedName: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#6c63ff] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleUpload}
                  className="w-full bg-[#6c63ff] text-white py-3 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold"
                >
                  Upload Document
                </button>
              </div>
            )}
          </div>
        )}

        <div className="glass-card p-4 mb-6 animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#8888aa]" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by name, topic, or content..."
                className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg pl-12 pr-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowUploadZone(!showUploadZone)}
              className="bg-[#6c63ff] text-white px-6 py-3 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold flex items-center gap-2"
            >
              <Upload size={20} />
              Upload
            </button>
            <button
              onClick={() => setShowRouterInsights(!showRouterInsights)}
              className={`px-6 py-3 rounded-lg transition-colors font-semibold flex items-center gap-2 ${
                showRouterInsights 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'bg-[#12121a] text-[#8888aa] hover:text-white'
              }`}
            >
              <Archive size={20} />
              Router Insights
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button
              onClick={() => setFilterCourse('all')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterCourse === 'all' 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'bg-[#12121a] text-[#8888aa] hover:text-white'
              }`}
            >
              All
            </button>
            {courses.map(course => (
              <button
                key={course.code}
                onClick={() => setFilterCourse(course.code)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  filterCourse === course.code 
                    ? 'bg-[#6c63ff] text-white' 
                    : 'bg-[#12121a] text-[#8888aa] hover:text-white'
                }`}
              >
                {course.code}
              </button>
            ))}
            <button
              onClick={() => setFilterCategory('past_paper')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterCategory === 'past_paper' 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'bg-[#12121a] text-[#8888aa] hover:text-white'
              }`}
            >
              Past Papers
            </button>
            <button
              onClick={() => setFilterCategory('quick_reference')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filterCategory === 'quick_reference' 
                  ? 'bg-[#6c63ff] text-white' 
                  : 'bg-[#12121a] text-[#8888aa] hover:text-white'
              }`}
            >
              Quick Reference
            </button>
          </div>
        </div>

        {showRouterInsights && (
          <div className="glass-card p-6 mb-6 animate-slide-up">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Archive size={24} className="text-[#6c63ff]" />
              Router Insights
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Routing Rules</h4>
                <div className="bg-[#12121a] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e1e2e]">
                      <tr>
                        <th className="px-4 py-2 text-left text-[#8888aa]">Pattern</th>
                        <th className="px-4 py-2 text-left text-[#8888aa]">Target</th>
                        <th className="px-4 py-2 text-left text-[#8888aa]">Confidence</th>
                        <th className="px-4 py-2 text-left text-[#8888aa]">G/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerRules.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-4 py-4 text-center text-[#8888aa]">
                            No rules yet. Upload documents to train the router.
                          </td>
                        </tr>
                      ) : (
                        routerRules.map(rule => (
                          <tr key={rule.rule_id} className="border-t border-[#1e1e2e]">
                            <td className="px-4 py-2 text-white font-mono text-xs">{rule.pattern_signature}</td>
                            <td className="px-4 py-2 text-white">{rule.target_module}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-[#0a0a0f] rounded-full overflow-hidden">
                                  <div 
                                    className="h-full transition-all"
                                    style={{ 
                                      width: `${rule.confidence_weight * 100}%`,
                                      backgroundColor: rule.confidence_weight >= 0.7 ? '#2ed573' : rule.confidence_weight >= 0.4 ? '#ffa502' : '#ff4757'
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-[#8888aa]">{Math.round(rule.confidence_weight * 100)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <span className="text-[#2ed573]">{rule.gain_count}</span>
                              <span className="text-[#8888aa]">/</span>
                              <span className="text-[#ff4757]">{rule.loss_count}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Recent Decisions</h4>
                <div className="bg-[#12121a] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e1e2e] sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-[#8888aa]">File</th>
                        <th className="px-4 py-2 text-left text-[#8888aa]">Path</th>
                        <th className="px-4 py-2 text-left text-[#8888aa]">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routerDecisions.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-4 py-4 text-center text-[#8888aa]">
                            No decisions yet.
                          </td>
                        </tr>
                      ) : (
                        routerDecisions.map(decision => (
                          <tr key={decision.decision_id} className="border-t border-[#1e1e2e]">
                            <td className="px-4 py-2 text-white text-xs truncate max-w-32">{decision.file_name}</td>
                            <td className="px-4 py-2 text-white text-xs">{decision.chosen_path}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                decision.outcome === 'gain' 
                                  ? 'bg-[#2ed573]/20 text-[#2ed573]' 
                                  : decision.outcome === 'loss' 
                                    ? 'bg-[#ff4757]/20 text-[#ff4757]' 
                                    : 'bg-[#ffa502]/20 text-[#ffa502]'
                              }`}>
                                {decision.outcome}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'all' 
                ? 'bg-[#6c63ff] text-white' 
                : 'bg-[#12121a] text-[#8888aa] hover:text-white'
            }`}
          >
            <FolderOpen size={18} />
            All Documents
          </button>
          <button
            onClick={() => setActiveTab('quick_reference')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'quick_reference' 
                ? 'bg-[#6c63ff] text-white' 
                : 'bg-[#12121a] text-[#8888aa] hover:text-white'
            }`}
          >
            <BookOpen size={18} />
            Quick Reference Cards
          </button>
          <button
            onClick={() => setActiveTab('past_papers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'past_papers' 
                ? 'bg-[#6c63ff] text-white' 
                : 'bg-[#12121a] text-[#8888aa] hover:text-white'
            }`}
          >
            <Archive size={18} />
            Past Papers
          </button>
        </div>

        {activeTab === 'all' && (
          <div className="grid grid-cols-3 gap-4">
            {filteredDocuments.length === 0 ? (
              <div className="col-span-3 glass-card p-12 text-center animate-slide-up">
                <FolderOpen className="text-[#8888aa] mx-auto mb-4" size={48} />
                <p className="text-[#8888aa]">No documents yet. Upload your first file.</p>
              </div>
            ) : (
              filteredDocuments.map(doc => {
                const { icon: FileIcon, color } = getFileIcon(doc.name);
                const course = courses.find(c => c.code === doc.course);
                const category = categories.find(c => c.id === doc.category);

                return (
                  <div
                    key={doc.id}
                    className="glass-card p-5 animate-slide-up hover:scale-[1.02] transition-transform duration-200 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                          <FileIcon size={24} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">{doc.name}</h4>
                          <p className="text-xs text-[#8888aa] truncate">{doc.originalName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span 
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: `${course?.color}20`, color: course?.color }}
                      >
                        {doc.course}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-[#1e1e2e] text-[#8888aa]">
                        {category?.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {doc.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 rounded bg-[#12121a] text-[#6c63ff]">
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-xs px-2 py-1 rounded bg-[#12121a] text-[#8888aa]">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#8888aa] mb-3">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </p>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewingDoc(doc)}
                        className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-white hover:bg-[#1e1e2e] transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          const newName = prompt('Enter new name:', doc.name);
                          if (newName) handleRename(doc.id, newName);
                        }}
                        className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-white hover:bg-[#1e1e2e] transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-[#ff4757] hover:bg-[#1e1e2e] transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'quick_reference' && (
          <div className="space-y-6">
            {quickReferenceCards.map(card => (
              <div
                key={card.id}
                className="glass-card p-6 animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: card.color }}
                    ></div>
                    <h3 className="text-xl font-bold text-white">{card.courseName}</h3>
                    <span 
                      className="text-sm px-2 py-1 rounded"
                      style={{ backgroundColor: `${card.color}20`, color: card.color }}
                    >
                      {card.course}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrint(card.id)}
                      className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-white hover:bg-[#1e1e2e] transition-colors"
                    >
                      <Printer size={18} />
                    </button>
                    <button
                      onClick={() => editingCard === card.id ? setEditingCard(null) : handleCardEdit(card.id)}
                      className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-white hover:bg-[#1e1e2e] transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>

                {editingCard === card.id ? (
                  <div>
                    <textarea
                      value={card.content}
                      onChange={(e) => {
                        setQuickReferenceCards(cards => 
                          cards.map(c => c.id === card.id ? { ...c, content: e.target.value } : c)
                        );
                      }}
                      placeholder="Add your quick reference notes here..."
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none resize-none h-40"
                    />
                    <button
                      onClick={() => handleCardSave(card.id, card.content)}
                      className="mt-3 bg-[#2ed573] text-[#0a0a0f] px-4 py-2 rounded-lg hover:bg-[#26c46a] transition-colors font-semibold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#12121a] rounded-lg p-4 min-h-[100px]">
                    <p className="text-[#8888aa] whitespace-pre-wrap">{card.content || 'No content yet. Click edit to add notes.'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'past_papers' && (
          <div className="grid grid-cols-3 gap-4">
            {pastPapers.length === 0 ? (
              <div className="col-span-3 glass-card p-12 text-center animate-slide-up">
                <Archive className="text-[#8888aa] mx-auto mb-4" size={48} />
                <p className="text-[#8888aa]">No past papers yet. Upload your first paper.</p>
              </div>
            ) : (
              pastPapers.map(doc => {
                const { icon: FileIcon, color } = getFileIcon(doc.name);
                const course = courses.find(c => c.code === doc.course);

                return (
                  <div
                    key={doc.id}
                    className="glass-card p-5 animate-slide-up hover:scale-[1.02] transition-transform duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                          <FileIcon size={24} style={{ color }} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{doc.name}</h4>
                          <span 
                            className="text-xs px-2 py-1 rounded mt-1 inline-block"
                            style={{ backgroundColor: `${course?.color}20`, color: course?.color }}
                          >
                            {doc.course}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-[#8888aa] mb-2">Analyzed Topics:</p>
                      <p className="text-xs text-[#8888aa] italic">Not analyzed yet</p>
                    </div>

                    <button
                      disabled
                      className="w-full bg-[#1e1e2e] text-[#8888aa] py-2 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                      title="AI Analysis coming in Phase 5"
                    >
                      <Archive size={16} />
                      Analyze with AI
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1e1e2e]">
              <h3 className="text-lg font-bold text-white">{viewingDoc.name}</h3>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-2 rounded bg-[#12121a] text-[#8888aa] hover:text-white hover:bg-[#1e1e2e] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {viewingDoc.fileContent ? (
                viewingDoc.originalName?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={`data:application/pdf;base64,${viewingDoc.fileContent}`}
                    className="w-full h-full min-h-[600px] border-0"
                    title={viewingDoc.name}
                  />
                ) : viewingDoc.originalName?.match(/\.(jpg|jpeg|png|gif|svg)$/i) ? (
                  <img
                    src={`data:image/png;base64,${viewingDoc.fileContent}`}
                    alt={viewingDoc.name}
                    className="max-w-full mx-auto"
                  />
                ) : (
                  <div className="text-center text-[#8888aa] py-12">
                    <File size={48} className="mx-auto mb-4" />
                    <p>Preview not available for this file type</p>
                    <p className="text-sm mt-2">File: {viewingDoc.originalName}</p>
                  </div>
                )
              ) : (
                <div className="text-center text-[#8888aa] py-12">
                  <File size={48} className="mx-auto mb-4" />
                  <p>File content not available</p>
                  <p className="text-sm mt-2">This document was uploaded before the viewer was added</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
