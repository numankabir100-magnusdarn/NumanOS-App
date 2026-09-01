import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import API from '../../services/api';

export default function WhatsAppImporter() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deadlines, setDeadlines] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.txt')) {
      setFile(selected);
      setError('');
    } else {
      setError('Please select a .txt file exported from WhatsApp.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setMessage('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await API.post('/whatsapp/parse-txt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDeadlines(response.data.deadlines);
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse WhatsApp file.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (deadlines.length === 0) return;
    try {
      await API.post('/whatsapp/save-deadlines', deadlines);
      setMessage('All deadlines saved to NuManOS!');
      setDeadlines([]);
      setFile(null);
    } catch (err) {
      setError('Failed to save deadlines.');
    }
  };

  return (
    <div className="p-6 bg-[#0a0a0f] min-h-screen text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">📱 WhatsApp Deadline Importer</h1>
        <p className="text-[#8888aa] mb-6">
          Export a WhatsApp chat as .txt, upload it, and NuManOS will auto‑extract all deadlines.
        </p>

        {/* Upload Zone */}
        <div className="glass-card p-6 rounded-lg border-2 border-dashed border-[#1e1e2e] hover:border-[#6c63ff] transition-colors">
          <input
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <div className="flex flex-col items-center gap-2">
              <Upload size={40} className="text-[#6c63ff]" />
              <span className="text-lg font-medium">
                {file ? file.name : 'Click to select WhatsApp .txt export'}
              </span>
              <span className="text-sm text-[#8888aa]">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Only .txt files supported'}
              </span>
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-[#ff4757]/20 border border-[#ff4757] rounded-lg flex items-center gap-2 text-[#ff4757]">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-4 w-full bg-[#6c63ff] hover:bg-[#5a52d5] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '⏳ Parsing with Groq...' : '🚀 Extract Deadlines'}
          </button>
        )}

        {/* Results */}
        {deadlines.length > 0 && (
          <div className="mt-6 glass-card p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle size={24} className="text-[#2ed573]" />
              Extracted {deadlines.length} Deadlines
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {deadlines.map((d, i) => (
                <div key={i} className="bg-[#12121a] p-4 rounded-lg border-l-4 border-[#6c63ff]">
                  <div className="flex justify-between">
                    <span className="font-bold">{d.title}</span>
                    <span className="text-sm bg-[#6c63ff]/20 px-2 py-1 rounded">{d.course_code}</span>
                  </div>
                  <div className="text-sm text-[#8888aa] mt-1">📅 {d.due_date}</div>
                  <div className="text-xs text-[#666688] mt-2 italic">"{d.source_text}"</div>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveAll}
              className="mt-4 w-full bg-[#2ed573] hover:bg-[#26b85c] text-white font-bold py-3 rounded-lg transition-colors"
            >
              💾 Save All Deadlines to NuManOS
            </button>
          </div>
        )}

        {message && !error && deadlines.length === 0 && (
          <div className="mt-4 p-4 bg-[#2ed573]/20 border border-[#2ed573] rounded-lg text-[#2ed573]">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
