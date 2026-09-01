import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Power,
  Activity,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  getAutronStatus,
  toggleAutron,
  getLLMConfig,
  updateLLMConfig,
  getActivity,
  getPendingReview,
  approveReview,
  rejectReview,
} from '../../services/autronService';

const PROVIDERS = ['groq', 'openrouter', 'anthropic', 'openai'];

const AutronDashboard = () => {
  const [enabled, setEnabled] = useState(false);
  const [flagPath, setFlagPath] = useState('');
  const [toggling, setToggling] = useState(false);

  const [llmConfig, setLlmConfig] = useState({
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    api_key_set: false,
    api_key_input: '',
    fallback_provider: '',
    fallback_model: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [activity, setActivity] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, configRes, activityRes, pendingRes] = await Promise.all([
        getAutronStatus(),
        getLLMConfig(),
        getActivity(10),
        getPendingReview(),
      ]);
      setEnabled(statusRes.data.enabled);
      setFlagPath(statusRes.data.flag_path);
      setLlmConfig({
        provider: configRes.data.provider || 'groq',
        model: configRes.data.model || 'llama-3.3-70b-versatile',
        api_key_set: !!configRes.data.api_key_set,
        api_key_input: '',
        fallback_provider: configRes.data.fallback_provider || '',
        fallback_model: configRes.data.fallback_model || '',
      });
      setActivity(activityRes.data);
      setPending(pendingRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load Autron dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await toggleAutron(!enabled);
      setEnabled(res.data.enabled);
      setFlagPath(res.data.flag_path);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to toggle Autron.');
    } finally {
      setToggling(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      const payload = {
        provider: llmConfig.provider,
        model: llmConfig.model,
        fallback_provider: llmConfig.fallback_provider || null,
        fallback_model: llmConfig.fallback_model || null,
      };
      if (llmConfig.api_key_input && llmConfig.api_key_input.trim() !== '') {
        payload.api_key = llmConfig.api_key_input;
      }
      const res = await updateLLMConfig(payload);
      setLlmConfig({
        provider: res.data.provider,
        model: res.data.model,
        api_key_set: !!res.data.api_key_set,
        api_key_input: '',
        fallback_provider: res.data.fallback_provider || '',
        fallback_model: res.data.fallback_model || '',
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save LLM config.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleReviewAction = async (id, action) => {
    setActionLoading((prev) => ({ ...prev, [id]: action }));
    try {
      if (action === 'approve') {
        await approveReview(id);
      } else {
        await rejectReview(id);
      }
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${action} review item.`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="text-[#6c63ff]" size={32} />
              <div>
                <h1 className="text-3xl font-bold text-white">Autron Dashboard</h1>
                <p className="text-[#8888aa]">Control and monitor the background agent</p>
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-[#8888aa] hover:text-white hover:border-[#6c63ff] transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#ff4757]/20 border border-[#ff4757] rounded-lg flex items-center gap-2 text-[#ff4757]">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Status Toggle */}
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Power size={20} className="text-[#6c63ff]" />
                <h2 className="text-xl font-bold text-white">Agent Status</h2>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  enabled
                    ? 'bg-[#2ed573]/20 text-[#2ed573]'
                    : 'bg-[#8888aa]/20 text-[#8888aa]'
                }`}
              >
                {enabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <p className="text-sm text-[#8888aa] mb-4">
              Toggle file watching, scheduling, and autonomous actions via{' '}
              <code className="text-[#00d4aa] text-xs">{flagPath || 'enabled.flag'}</code>
            </p>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 ${
                enabled
                  ? 'bg-[#ff4757] hover:bg-[#e84141] text-white'
                  : 'bg-[#2ed573] hover:bg-[#26b865] text-white'
              }`}
            >
              {toggling ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Power size={20} />
              )}
              {enabled ? 'Pause Autron' : 'Enable Autron'}
            </button>
          </div>

          {/* LLM Router Config */}
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={20} className="text-[#6c63ff]" />
              <h2 className="text-xl font-bold text-white">LLM Router Config</h2>
            </div>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Primary Provider</label>
                <select
                  value={llmConfig.provider}
                  onChange={(e) => setLlmConfig({ ...llmConfig, provider: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Model</label>
                <input
                  type="text"
                  value={llmConfig.model}
                  onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
                  placeholder="llama-3.3-70b-versatile"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">API Key</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={llmConfig.api_key_input}
                  onChange={(e) => setLlmConfig({ ...llmConfig, api_key_input: e.target.value })}
                  placeholder={
                    llmConfig.api_key_set
                      ? '•••••••• (leave blank to keep existing; type to overwrite)'
                      : 'e.g. gsk_... or sk-or-...'
                  }
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none font-mono"
                />
                {llmConfig.api_key_set && (
                  <p className="mt-1 text-xs text-[#2ed573]">
                    ✓ Key currently stored on server. New value only sent if not blank.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Fallback Provider</label>
                <select
                  value={llmConfig.fallback_provider}
                  onChange={(e) =>
                    setLlmConfig({ ...llmConfig, fallback_provider: e.target.value })
                  }
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                >
                  <option value="">None</option>
                  {PROVIDERS.filter((p) => p !== llmConfig.provider).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#8888aa] mb-2">Fallback Model</label>
                <input
                  type="text"
                  value={llmConfig.fallback_model}
                  onChange={(e) => setLlmConfig({ ...llmConfig, fallback_model: e.target.value })}
                  placeholder="e.g. meta-llama/llama-3.1-405b-instruct (OpenRouter) or llama-3.1-8b-instant (Groq)"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-[#6c63ff] hover:bg-[#5a52d5] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingConfig ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : configSaved ? (
                  <CheckCircle size={18} />
                ) : null}
                {configSaved ? 'Saved!' : 'Save LLM Config'}
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Feed */}
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={20} className="text-[#00d4aa]" />
              <h2 className="text-xl font-bold text-white">Activity Feed</h2>
              <span className="text-xs text-[#8888aa] ml-auto">Last 10 events</span>
            </div>
            {loading && activity.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#6c63ff]" />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-[#8888aa] text-center py-8">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg"
                  >
                    <p className="text-white text-sm">{item.summary}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-[#8888aa]">
                      <span>{formatTime(item.timestamp)}</span>
                      <span className="text-[#6c63ff]">{item.source || 'autron'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Review Queue */}
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={20} className="text-[#ffa502]" />
              <h2 className="text-xl font-bold text-white">Pending Review</h2>
              {pending.length > 0 && (
                <span className="ml-auto bg-[#ffa502] text-black text-xs font-bold px-2 py-1 rounded-full">
                  {pending.length}
                </span>
              )}
            </div>
            {loading && pending.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#6c63ff]" />
              </div>
            ) : pending.length === 0 ? (
              <p className="text-[#8888aa] text-center py-8">No actions awaiting review.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pending.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-[#0a0a0f] border border-[#ffa502]/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-[#ffa502]">{item.action_name}</span>
                      <span className="text-xs text-[#8888aa]">{formatTime(item.timestamp)}</span>
                    </div>
                    <pre className="text-xs text-[#8888aa] bg-[#12121a] p-2 rounded mb-3 overflow-x-auto">
                      {JSON.stringify(item.action_args, null, 2)}
                    </pre>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewAction(item.id, 'approve')}
                        disabled={!!actionLoading[item.id]}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#2ed573] hover:bg-[#26b865] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoading[item.id] === 'approve' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewAction(item.id, 'reject')}
                        disabled={!!actionLoading[item.id]}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[#ff4757] hover:bg-[#e84141] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoading[item.id] === 'reject' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutronDashboard;
