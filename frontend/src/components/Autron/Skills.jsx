import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, FileText, Loader2, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { getSkills, uploadSkill, deleteSkill } from '../../services/autronService';

const Skills = () => {
  const [skills, setSkills] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSkills();
      setSkills(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load skills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.toLowerCase().endsWith('.md')) {
      setFile(selected);
      setError('');
    } else {
      setError('Please select a .md skill file with YAML frontmatter.');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      await uploadSkill(file);
      setSuccess(`Skill "${file.name}" uploaded successfully.`);
      setFile(null);
      const input = document.getElementById('skill-upload');
      if (input) input.value = '';
      await loadSkills();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload skill.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete skill "${name}"?`)) return;
    setDeletingId(id);
    setError('');
    try {
      await deleteSkill(id);
      setSuccess(`Skill "${name}" deleted.`);
      await loadSkills();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete skill.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <Sparkles className="text-[#6c63ff]" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-white">Autron Skills</h1>
              <p className="text-[#8888aa]">
                Upload markdown skill files for Autron to load during agent tasks
              </p>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <h2 className="text-lg font-bold text-white mb-4">Upload Skill (.md)</h2>
          <p className="text-sm text-[#8888aa] mb-4">
            Skills must include YAML frontmatter with at least a{' '}
            <code className="text-[#00d4aa]">name</code> field. Optional{' '}
            <code className="text-[#00d4aa]">description</code> helps Autron match skills to prompts.
          </p>
          <div className="rounded-lg border-2 border-dashed border-[#1e1e2e] hover:border-[#6c63ff] transition-colors p-6">
            <input
              type="file"
              accept=".md"
              onChange={handleFileChange}
              className="hidden"
              id="skill-upload"
            />
            <label htmlFor="skill-upload" className="cursor-pointer block">
              <div className="flex flex-col items-center gap-2">
                <Upload size={40} className="text-[#6c63ff]" />
                <span className="text-lg font-medium text-white">
                  {file ? file.name : 'Click to select a .md skill file'}
                </span>
                <span className="text-sm text-[#8888aa]">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Markdown with YAML frontmatter'}
                </span>
              </div>
            </label>
          </div>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 w-full bg-[#6c63ff] hover:bg-[#5a52d5] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? 'Uploading...' : 'Upload Skill'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-[#ff4757]/20 border border-[#ff4757] rounded-lg flex items-center gap-2 text-[#ff4757]">
            <AlertCircle size={20} />
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-[#2ed573]/20 border border-[#2ed573] rounded-lg flex items-center gap-2 text-[#2ed573]">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Skills List */}
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="text-lg font-bold text-white mb-4">
            Installed Skills ({skills.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#6c63ff]" />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-12 text-[#8888aa]">
              <FileText size={48} className="mx-auto mb-4 opacity-40" />
              <p>No skills uploaded yet.</p>
              <p className="text-sm mt-1">Upload a .md file to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-start justify-between p-4 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg hover:border-[#6c63ff]/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white">{skill.name}</h3>
                    <p className="text-sm text-[#8888aa] mt-1">
                      {skill.description || 'No description provided.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(skill.id, skill.name)}
                    disabled={deletingId === skill.id}
                    className="ml-4 p-2 rounded-lg text-[#ff4757] hover:bg-[#ff4757]/20 transition-colors disabled:opacity-50"
                    title="Delete skill"
                  >
                    {deletingId === skill.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Skills;
