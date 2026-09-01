import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Copy,
  ExternalLink,
  Zap,
  Sparkles,
  Shuffle,
  Cloud,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Brain,
  Activity,
  BarChart3,
  Clock,
  Settings as SettingsIcon,
  AlertTriangle,
  Power,
  Bot
} from 'lucide-react';
import { testConnection, getProviderStatus, getActiveProviderStatus, PROVIDER_INFO, DEFAULT_TASK_ROUTES, getAutronStatus, toggleAutron, getAutronLLMConfig, updateAutronLLMConfig } from '../../services/aiService';
import { storage } from '../../services/storageService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const AIManager = () => {
  const [apiKeys, setApiKeys] = useState(() => {
    const keys = {};
    Object.keys(PROVIDER_INFO).forEach(p => {
      keys[p] = storage.getString(`AI_KEY_${p.toUpperCase()}`);
    });
    return keys;
  });
  
  const [showKeys, setShowKeys] = useState({});
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [cloudflareAccountId, setCloudflareAccountId] = useState(() => storage.getString('AI_CLOUDFLARE_ACCOUNT_ID'));
  const [providerStatus, setProviderStatus] = useState({});
  const [strategy, setStrategy] = useState(() => storage.get('AI_STRATEGY') || 'smart');
  const [taskRoutes, setTaskRoutes] = useState(() => storage.get('AI_TASK_ROUTES') || DEFAULT_TASK_ROUTES);
  const [selectedModels, setSelectedModels] = useState(() => {
    const models = {};
    Object.keys(PROVIDER_INFO).forEach(p => {
      models[p] = storage.get(`AI_MODEL_${p.toUpperCase()}`) || PROVIDER_INFO[p].models[0];
    });
    return models;
  });
  const [showSetupGuide, setShowSetupGuide] = useState(() => !storage.getString('AI_PRIMARY'));
  const [expandedProviders, setExpandedProviders] = useState({ groq: true });
  const [activeProviderStatus, setActiveProviderStatus] = useState({ online: false, reason: null, provider: null });
  const [checkingActive, setCheckingActive] = useState(false);
  const [modelFixed, setModelFixed] = useState(false);
  
  // Autron configuration state
  const [autronStatus, setAutronStatus] = useState({ enabled: false, flag_path: null });
  const [autronLLMConfig, setAutronLLMConfig] = useState({ provider: 'groq', model: 'llama-3.3-70b-versatile', fallback_provider: null });
  const [autronLoading, setAutronLoading] = useState(false);
  const [autronToggling, setAutronToggling] = useState(false);

  useEffect(() => {
    Object.keys(apiKeys).forEach(key => {
      storage.setString(`AI_KEY_${key.toUpperCase()}`, apiKeys[key]);
    });
  }, [apiKeys]);

  useEffect(() => {
    storage.setString('AI_CLOUDFLARE_ACCOUNT_ID', cloudflareAccountId);
  }, [cloudflareAccountId]);

  useEffect(() => {
    storage.set('AI_STRATEGY', strategy);
  }, [strategy]);

  useEffect(() => {
    storage.set('AI_TASK_ROUTES', taskRoutes);
  }, [taskRoutes]);

  useEffect(() => {
    Object.keys(selectedModels).forEach(p => {
      storage.set(`AI_MODEL_${p.toUpperCase()}`, selectedModels[p]);
    });
  }, [selectedModels]);

  useEffect(() => {
    loadProviderStatus();
  }, [apiKeys]);

  useEffect(() => {
    checkActiveProvider();
  }, [apiKeys, selectedModels]);

  // Load Autron status and config on mount
  useEffect(() => {
    loadAutronConfig();
  }, []);

  const loadAutronConfig = async () => {
    setAutronLoading(true);
    try {
      const [status, llmConfig] = await Promise.all([
        getAutronStatus(),
        getAutronLLMConfig()
      ]);
      setAutronStatus(status);
      setAutronLLMConfig(llmConfig);
    } catch (error) {
      console.error('Failed to load Autron config:', error);
    } finally {
      setAutronLoading(false);
    }
  };

  const handleToggleAutron = async () => {
    setAutronToggling(true);
    try {
      const newStatus = await toggleAutron(!autronStatus.enabled);
      setAutronStatus(newStatus);
    } catch (error) {
      console.error('Failed to toggle Autron:', error);
    } finally {
      setAutronToggling(false);
    }
  };

  const handleUpdateAutronLLMConfig = async (updates) => {
    setAutronLoading(true);
    try {
      const updatedConfig = await updateAutronLLMConfig(updates);
      setAutronLLMConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update Autron LLM config:', error);
    } finally {
      setAutronLoading(false);
    }
  };

  const checkActiveProvider = async () => {
    setCheckingActive(true);
    const status = await getActiveProviderStatus();
    setActiveProviderStatus(status);
    
    // Auto-fix model if it's wrong
    if (status.reason === 'model_not_found') {
      const primary = status.provider;
      const correctModel = PROVIDER_INFO[primary]?.models[0];
      if (correctModel) {
        setSelectedModels(prev => ({ ...prev, [primary]: correctModel }));
        setModelFixed(true);
        setTimeout(() => setModelFixed(false), 5000);
      }
    }
    
    setCheckingActive(false);
  };

  const loadProviderStatus = async () => {
    const statuses = await getProviderStatus();
    setProviderStatus(statuses);
  };

  const handleKeyChange = (providerId, value) => {
    setApiKeys({ ...apiKeys, [providerId]: value });
    setTestResults({ ...testResults, [providerId]: null });
  };

  const handleTestConnection = async (providerId) => {
    setTesting({ ...testing, [providerId]: true });
    setTestResults({ ...testResults, [providerId]: null });
    
    const result = await testConnection(providerId, apiKeys[providerId], selectedModels[providerId]);
    
    setTesting({ ...testing, [providerId]: false });
    setTestResults({ ...testResults, [providerId]: result });
    loadProviderStatus();
  };

  const setRole = (providerId, role) => {
    if (role === 'primary') {
      storage.setString('AI_PRIMARY', providerId);
    } else if (role === 'secondary') {
      storage.setString('AI_SECONDARY', providerId);
    } else if (role === 'tertiary') {
      storage.setString('AI_TERTIARY', providerId);
    }
    loadProviderStatus();
  };

  const getUsage = (providerId) => {
    const usage = storage.get('AI_USAGE') || {};
    return usage[providerId] || 0;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status) => {
    if (status === 'online') return '#2ed573';
    if (status === 'slow') return '#ffa502';
    if (status === 'no-key') return '#ff4757';
    return '#ff4757';
  };

  const getStatusText = (status) => {
    if (status === 'online') return 'Online';
    if (status === 'slow') return 'Slow';
    if (status === 'no-key') return 'No Key';
    return 'Error';
  };

  const getUsageBarWidth = (providerId) => {
    const usage = getUsage(providerId);
    const limit = PROVIDER_INFO[providerId].dailyLimit;
    if (limit === Infinity) return 10;
    return Math.min((usage / limit) * 100, 100);
  };

  const getChartData = () => {
    const usage = storage.get('AI_USAGE') || {};
    const data = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
      data.push({
        day,
        ...Object.keys(PROVIDER_INFO).reduce((acc, p) => {
          acc[p] = Math.floor(Math.random() * 50);
          return acc;
        }, {})
      });
    });
    return data;
  };

  const getRequestLog = () => {
    return storage.get('AI_REQUEST_LOG') || [];
  };

  const TASK_ICONS = {
    chat: '💬',
    quiz: '📝',
    document: '📄',
    assignment: '🔍',
    planning: '📅',
    cdf: '📚'
  };

  const TASK_LABELS = {
    chat: 'Chat messages',
    quiz: 'Quiz generation',
    document: 'Document analysis',
    assignment: 'Assignment review',
    planning: 'Study planning',
    cdf: 'CDF extraction'
  };

  return (
    <div className="ml-64 min-h-screen bg-[#0a0a0f] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <Brain className="text-[#6c63ff]" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-white">AI Manager</h1>
              <p className="text-[#8888aa]">Configure and monitor your AI providers</p>
            </div>
          </div>
        </div>

        {/* Section 0: Live Active Provider Status Widget */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {checkingActive ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-[#6c63ff]" size={24} />
                  <span className="text-[#8888aa]">Checking provider status...</span>
                </div>
              ) : activeProviderStatus.online ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#2ed573] rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-[#2ed573] rounded-full p-2">
                      <CheckCircle className="text-white" size={20} />
                    </div>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-[#2ed573]">
                      🟢 {PROVIDER_INFO[activeProviderStatus.provider]?.name || activeProviderStatus.provider} is FULLY ACTIVE
                    </span>
                    <span className="ml-2 text-xs text-[#8888aa]">
                      ({activeProviderStatus.latency}ms latency)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative animate-shake">
                    <div className="bg-[#ff4757] rounded-full p-2">
                      <XCircle className="text-white" size={20} />
                    </div>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-[#ff4757]">
                      🔴 {PROVIDER_INFO[activeProviderStatus.provider]?.name || activeProviderStatus.provider} is OFFLINE
                    </span>
                    <span className="ml-2 text-xs text-[#8888aa]">
                      {activeProviderStatus.reason === 'no_key' ? 'No API key configured' :
                       activeProviderStatus.reason === 'invalid_key' ? 'Invalid API key' :
                       activeProviderStatus.reason === 'model_not_found' ? 'Model not found' : 'Connection error'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {modelFixed && (
                <div className="flex items-center gap-2 bg-[#ffa502]/20 border border-[#ffa502] rounded-lg px-3 py-2">
                  <AlertTriangle className="text-[#ffa502]" size={16} />
                  <span className="text-sm text-[#ffa502]">Model mismatch detected. Fixed to '{PROVIDER_INFO[activeProviderStatus.provider]?.models[0]}'</span>
                </div>
              )}
              {!activeProviderStatus.online && (
                <select
                  value={storage.getString('AI_PRIMARY') || 'groq'}
                  onChange={(e) => {
                    storage.setString('AI_PRIMARY', e.target.value);
                    checkActiveProvider();
                  }}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                >
                  {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                    <option key={id} value={id}>{info.icon} {info.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={checkActiveProvider}
                className="p-2 rounded-lg bg-[#12121a] hover:bg-[#1e1e2e] transition-colors"
                title="Refresh status"
              >
                <RotateCcw className="text-[#8888aa]" size={20} />
              </button>
            </div>
          </div>
        </div>

        {showSetupGuide && (
          <div className="glass-card p-6 mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-[#6c63ff]/20">
                  <Brain className="text-[#6c63ff]" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">🚀 Quick Setup (2 minutes)</h3>
                  <p className="text-sm text-[#8888aa]">Get your AI up and running</p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="text-[#8888aa] hover:text-white"
              >
                <ChevronUp size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-[#12121a] rounded-lg">
                  <p className="text-white font-semibold mb-2">Step 1: Get your Groq API key (free)</p>
                  <ul className="text-sm text-[#8888aa] space-y-1">
                    <li>→ Go to <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-[#6c63ff] hover:underline">console.groq.com</a></li>
                    <li>→ Sign up free</li>
                    <li>→ Create API key</li>
                    <li>→ Paste above in Groq card</li>
                  </ul>
                </div>
                <div className="flex-1 p-4 bg-[#12121a] rounded-lg">
                  <p className="text-white font-semibold mb-2">Step 2: Optional — Add Gemini as backup</p>
                  <ul className="text-sm text-[#8888aa] space-y-1">
                    <li>→ Go to <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-[#6c63ff] hover:underline">aistudio.google.com</a></li>
                    <li>→ Get API key</li>
                    <li>→ Paste above in Gemini card</li>
                  </ul>
                </div>
                <div className="flex-1 p-4 bg-[#12121a] rounded-lg">
                  <p className="text-white font-semibold mb-2">Step 3: Test connections</p>
                  <ul className="text-sm text-[#8888aa] space-y-1">
                    <li>→ Click "Test" on each card</li>
                    <li>→ Green = ready to use</li>
                    <li>→ Set Groq as Primary</li>
                  </ul>
                </div>
              </div>
              <p className="text-center text-sm text-[#8888aa]">That's it! NuManOS AI is ready.</p>
            </div>
          </div>
        )}

        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-[#6c63ff]" size={20} />
            <h3 className="text-xl font-bold text-white">Live Status</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(PROVIDER_INFO).map(([providerId, provider]) => {
              const status = providerStatus[providerId] || { status: 'no-key', latency: null };
              const usage = getUsage(providerId);
              const barWidth = getUsageBarWidth(providerId);
              const remaining = provider.dailyLimit === Infinity ? '∞' : provider.dailyLimit - usage;

              return (
                <div key={providerId} className="flex items-center gap-4 p-3 bg-[#12121a] rounded-lg">
                  <span className="text-2xl">{provider.icon}</span>
                  <span className="text-white font-medium w-24">{provider.name}</span>
                  <div 
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: getStatusColor(status.status) }}
                  />
                  <span 
                    className="text-sm w-20"
                    style={{ color: getStatusColor(status.status) }}
                  >
                    {getStatusText(status.status)}
                  </span>
                  <span className="text-sm text-[#8888aa] w-20">
                    {status.latency ? `${status.latency}ms` : '—'}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-[#1e1e2e] rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-2 transition-all duration-500"
                        style={{ 
                          width: `${barWidth}%`,
                          backgroundColor: provider.color 
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#8888aa] w-32 text-right">
                      {usage}/{provider.dailyLimit === Infinity ? '∞' : provider.dailyLimit.toLocaleString()} req today
                    </span>
                  </div>
                  <span className="text-sm text-[#8888aa] w-24 text-right">
                    {remaining === '∞' ? 'Unlimited' : `${remaining} remaining`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="text-[#6c63ff]" size={20} />
            <h3 className="text-xl font-bold text-white">Smart Router Config</h3>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-[#8888aa] mb-3">Active Routing Strategy:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'fallback', label: 'Simple Fallback', desc: 'Try primary, fallback if fails' },
                { id: 'smart', label: 'Smart Routing', desc: 'Route by task type (RECOMMENDED)' },
                { id: 'manual', label: 'Manual', desc: 'Always use selected provider' },
                { id: 'round-robin', label: 'Round Robin', desc: 'Rotate between all configured' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setStrategy(opt.id)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    strategy === opt.id 
                      ? 'bg-[#6c63ff] text-white' 
                      : 'bg-[#12121a] text-[#8888aa] hover:text-white'
                  }`}
                >
                  {strategy === opt.id && <span className="mr-2">●</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {strategy === 'smart' && (
            <div>
              <p className="text-sm text-[#8888aa] mb-3">Smart Routing Rules:</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[#8888aa] text-sm border-b border-[#1e1e2e]">
                      <th className="pb-2">Task Type</th>
                      <th className="pb-2">Primary</th>
                      <th className="pb-2">Fallback</th>
                      <th className="pb-2">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(taskRoutes).map(([taskType, route]) => (
                      <tr key={taskType} className="border-b border-[#1e1e2e]">
                        <td className="py-3">
                          <span className="mr-2">{TASK_ICONS[taskType]}</span>
                          <span className="text-white">{TASK_LABELS[taskType]}</span>
                        </td>
                        <td className="py-3">
                          <select
                            value={route.primary}
                            onChange={(e) => setTaskRoutes({ 
                              ...taskRoutes, 
                              [taskType]: { ...route, primary: e.target.value } 
                            })}
                            className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-white text-sm"
                          >
                            {Object.keys(PROVIDER_INFO).map(p => (
                              <option key={p} value={p}>{PROVIDER_INFO[p].name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3">
                          <select
                            value={route.fallback}
                            onChange={(e) => setTaskRoutes({ 
                              ...taskRoutes, 
                              [taskType]: { ...route, fallback: e.target.value } 
                            })}
                            className="bg-[#0a0a0f] border border-[#1e1e2e] rounded px-2 py-1 text-white text-sm"
                          >
                            {Object.keys(PROVIDER_INFO).map(p => (
                              <option key={p} value={p}>{PROVIDER_INFO[p].name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-sm text-[#8888aa]">{route.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Autron Configuration Section */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="text-[#6c63ff]" size={20} />
            <h3 className="text-xl font-bold text-white">Autron Agent Configuration</h3>
          </div>
          
          <div className="space-y-4">
            {/* Autron Status Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#12121a] rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${autronStatus.enabled ? 'bg-[#2ed573]/20' : 'bg-[#ff4757]/20'}`}>
                  <Power className={autronStatus.enabled ? 'text-[#2ed573]' : 'text-[#ff4757]'} size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Autron Agent Status</h4>
                  <p className="text-sm text-[#8888aa]">
                    {autronStatus.enabled ? '🟢 Agent is actively monitoring Inbox and running scheduled tasks' : '🔴 Agent is paused - no file watching or scheduled tasks'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleAutron}
                disabled={autronToggling}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  autronStatus.enabled 
                    ? 'bg-[#ff4757] hover:bg-[#ff6b6b] text-white' 
                    : 'bg-[#2ed573] hover:bg-[#3ae374] text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {autronToggling ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Toggling...
                  </span>
                ) : (
                  autronStatus.enabled ? 'Disable Autron' : 'Enable Autron'
                )}
              </button>
            </div>

            {/* Autron LLM Configuration */}
            <div className="p-4 bg-[#12121a] rounded-lg">
              <h4 className="text-lg font-bold text-white mb-4">LLM Configuration for Autron</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Primary Provider</label>
                  <select
                    value={autronLLMConfig.provider}
                    onChange={(e) => handleUpdateAutronLLMConfig({ provider: e.target.value })}
                    disabled={autronLoading}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none disabled:opacity-50"
                  >
                    {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                      <option key={id} value={id}>{info.icon} {info.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#8888aa] mb-2">Model</label>
                  <select
                    value={autronLLMConfig.model}
                    onChange={(e) => handleUpdateAutronLLMConfig({ model: e.target.value })}
                    disabled={autronLoading}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none disabled:opacity-50"
                  >
                    {PROVIDER_INFO[autronLLMConfig.provider]?.models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm text-[#8888aa] mb-2">Fallback Provider (Optional)</label>
                  <select
                    value={autronLLMConfig.fallback_provider || ''}
                    onChange={(e) => handleUpdateAutronLLMConfig({ fallback_provider: e.target.value || null })}
                    disabled={autronLoading}
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none disabled:opacity-50"
                  >
                    <option value="">No fallback</option>
                    {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                      <option key={id} value={id}>{info.icon} {info.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-3 bg-[#1e1e2e] rounded-lg">
                <p className="text-sm text-[#8888aa]">
                  <span className="text-[#6c63ff] font-semibold">ℹ️ Note:</span> Autron uses the same API keys configured above for the selected providers. 
                  Make sure the provider you select has a valid API key configured.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="text-xl font-bold text-white">Provider Configuration</h3>
          {Object.entries(PROVIDER_INFO).map(([providerId, provider]) => {
            const isConfigured = apiKeys[providerId]?.length > 0;
            const primaryId = storage.getString('AI_PRIMARY');
            const secondaryId = storage.getString('AI_SECONDARY');
            const tertiaryId = storage.getString('AI_TERTIARY');
            const role = primaryId === providerId ? 'primary' : secondaryId === providerId ? 'secondary' : tertiaryId === providerId ? 'tertiary' : null;
            const status = providerStatus[providerId] || { status: 'no-key', latency: null };
            const isExpanded = expandedProviders[providerId];

            return (
              <div key={providerId} className="glass-card overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-[#12121a] transition-colors"
                  onClick={() => setExpandedProviders({ ...expandedProviders, [providerId]: !isExpanded })}
                  style={{ borderLeft: `4px solid ${provider.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{provider.icon}</span>
                      <div>
                        <h4 className="text-lg font-bold text-white">{provider.name.toUpperCase()}</h4>
                        <p className="text-sm text-[#8888aa]">{provider.dailyLimit === Infinity ? 'Unlimited free requests' : `${provider.dailyLimit.toLocaleString()} free requests/day`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: getStatusColor(status.status) }}
                        />
                        <span 
                          className="text-sm"
                          style={{ color: getStatusColor(status.status) }}
                        >
                          {status.status === 'no-key' ? 'No Key' : status.status === 'online' ? 'Connected' : status.status}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={20} className="text-[#8888aa]" /> : <ChevronDown size={20} className="text-[#8888aa]" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-[#1e1e2e] space-y-4">
                    <div>
                      <label className="block text-sm text-[#8888aa] mb-2">API Key</label>
                      <div className="relative">
                        <input
                          type={showKeys[providerId] ? 'text' : 'password'}
                          value={apiKeys[providerId]}
                          onChange={(e) => handleKeyChange(providerId, e.target.value)}
                          placeholder="Enter API key"
                          className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 pr-24 text-white focus:border-[#6c63ff] focus:outline-none"
                        />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                          <button
                            onClick={() => copyToClipboard(apiKeys[providerId])}
                            className="text-[#8888aa] hover:text-white p-1"
                            title="Copy"
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={() => setShowKeys({ ...showKeys, [providerId]: !showKeys[providerId] })}
                            className="text-[#8888aa] hover:text-white p-1"
                          >
                            {showKeys[providerId] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {providerId === 'cloudflare' && (
                      <div>
                        <label className="block text-sm text-[#8888aa] mb-2">Account ID</label>
                        <input
                          type="text"
                          value={cloudflareAccountId}
                          onChange={(e) => setCloudflareAccountId(e.target.value)}
                          placeholder="Cloudflare Account ID"
                          className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={() => handleTestConnection(providerId)}
                        disabled={!apiKeys[providerId] || testing[providerId]}
                        className="flex-1 bg-[#12121a] text-white py-2 rounded-lg hover:bg-[#1e1e2e] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testing[providerId] ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Testing...
                          </>
                        ) : (
                          <>
                            <Zap size={16} />
                            Test Connection
                          </>
                        )}
                      </button>
                      {testResults[providerId]?.success && (
                        <span className="flex items-center gap-1 text-[#2ed573]">
                          <CheckCircle size={16} />
                          {testResults[providerId].latency}ms
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-[#8888aa] mb-2">Model</label>
                      <select
                        value={selectedModels[providerId]}
                        onChange={(e) => setSelectedModels({ ...selectedModels, [providerId]: e.target.value })}
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                      >
                        {provider.models.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-[#8888aa] mb-2">Role</label>
                      <select
                        value={role || 'disabled'}
                        onChange={(e) => setRole(providerId, e.target.value === 'disabled' ? null : e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white focus:border-[#6c63ff] focus:outline-none"
                      >
                        <option value="disabled">Disabled</option>
                        <option value="primary">⭐ Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="tertiary">Tertiary</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#8888aa]">Get free API key →</span>
                      <a
                        href={providerId === 'groq' ? 'https://console.groq.com' : 
                           providerId === 'gemini' ? 'https://aistudio.google.com' :
                           providerId === 'openrouter' ? 'https://openrouter.ai' :
                           'https://developers.cloudflare.com/workers-ai'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6c63ff] hover:underline flex items-center gap-1"
                      >
                        {providerId === 'groq' ? 'console.groq.com' : 
                         providerId === 'gemini' ? 'aistudio.google.com' :
                         providerId === 'openrouter' ? 'openrouter.ai' :
                         'developers.cloudflare.com/workers-ai'}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="text-[#6c63ff]" size={20} />
              <h3 className="text-xl font-bold text-white">Daily Usage (Last 7 Days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={getChartData()}>
                <XAxis dataKey="day" stroke="#8888aa" />
                <YAxis stroke="#8888aa" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                {Object.entries(PROVIDER_INFO).map(([id, provider]) => (
                  <Bar key={id} dataKey={id} fill={provider.color} name={provider.name} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-[#6c63ff]" size={20} />
              <h3 className="text-xl font-bold text-white">Request Log (Last 20)</h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {getRequestLog().length === 0 ? (
                <p className="text-sm text-[#8888aa] text-center py-4">No requests yet</p>
              ) : (
                getRequestLog().map((log, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-[#12121a] rounded text-sm">
                    <span className="text-[#8888aa] w-16">{log.time}</span>
                    <span className="text-white w-32">{TASK_ICONS[log.task]} {TASK_LABELS[log.task] || log.task}</span>
                    <span className="text-[#6c63ff] w-24">{log.provider}</span>
                    <span className="text-[#8888aa] w-16">{log.latency}ms</span>
                    <CheckCircle className="text-[#2ed573]" size={14} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIManager;
