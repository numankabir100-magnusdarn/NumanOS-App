import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, Key, Cpu, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const Settings = () => {
  const [config, setConfig] = useState({
    provider: 'groq',
    model: 'llama3-8b-8192',
    api_key: '',
    fallback_provider: '',
    fallback_model: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/autron/llm-config`);
      if (res.data) {
        setConfig({
          provider: res.data.provider || 'groq',
          model: res.data.model || 'llama3-8b-8192',
          api_key: res.data.api_key || '',
          fallback_provider: res.data.fallback_provider || '',
          fallback_model: res.data.fallback_model || '',
        });
      }
    } catch (e) {
      // Config may not exist yet — that's fine
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/autron/llm-config`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save settings: ' + (e.response?.data?.detail || e.message));
    }
    setSaving(false);
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
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <div className="p-3 rounded-xl bg-[#6c63ff]/20">
            <SettingsIcon className="text-[#6c63ff]" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-[#8888aa]">Configure NuManOS AI and preferences</p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-6 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="glass-card p-4 mb-6 border border-green-500/30 text-green-400 text-sm animate-fade-in">
            ✓ Settings saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* AI Provider */}
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-[#6c63ff]" />
              AI Provider
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-1">Provider</label>
                  <select
                    value={config.provider}
                    onChange={e => setConfig({ ...config, provider: e.target.value })}
                    className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                  >
                    <option value="groq">Groq</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="ollama">Ollama (local)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#8888aa] mb-1">Model</label>
                  <input
                    type="text"
                    value={config.model}
                    onChange={e => setConfig({ ...config, model: e.target.value })}
                    placeholder="e.g. llama3-8b-8192"
                    className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-1 flex items-center gap-1">
                  <Key size={12} />
                  API Key
                </label>
                <input
                  type="password"
                  value={config.api_key}
                  onChange={e => setConfig({ ...config, api_key: e.target.value })}
                  placeholder="Leave blank to use environment variable"
                  className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Fallback Provider */}
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <RefreshCw size={18} className="text-[#00d4aa]" />
              Fallback Provider <span className="text-xs text-[#8888aa] font-normal ml-1">(optional)</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#8888aa] mb-1">Fallback Provider</label>
                <select
                  value={config.fallback_provider}
                  onChange={e => setConfig({ ...config, fallback_provider: e.target.value })}
                  className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                >
                  <option value="">None</option>
                  <option value="groq">Groq</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-1">Fallback Model</label>
                <input
                  type="text"
                  value={config.fallback_model}
                  onChange={e => setConfig({ ...config, fallback_model: e.target.value })}
                  placeholder="e.g. llama3-8b-8192"
                  className="w-full bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#6c63ff]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#6c63ff] text-white py-3 rounded-lg hover:bg-[#5a52e0] transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
