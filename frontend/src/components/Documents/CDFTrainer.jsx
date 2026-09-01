import React, { useState, useEffect } from 'react';
import { Upload, Loader2, BookOpen, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const CDFTrainer = () => {
  const [rules, setRules] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, decisionsRes] = await Promise.all([
        axios.get(`${API_BASE}/documents/rules`),
        axios.get(`${API_BASE}/documents/decisions/recent?limit=20`),
      ]);
      setRules(rulesRes.data || []);
      setDecisions(decisionsRes.data || []);
    } catch (e) {
      setError('Failed to load CDF Trainer data.');
    }
    setLoading(false);
  };

  const handleOutcome = async (decisionId, outcome) => {
    try {
      await axios.post(`${API_BASE}/documents/outcome`, { decision_id: decisionId, outcome });
      fetchData();
    } catch (e) {
      setError('Failed to record outcome.');
    }
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <div className="p-3 rounded-xl bg-[#6c63ff]/20">
            <Upload className="text-[#6c63ff]" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">CDF Trainer</h1>
            <p className="text-[#8888aa]">Train the Contextual Document Filter — review routing decisions</p>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 mb-6 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Rules Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} className="text-[#6c63ff]" />
              <span className="text-sm text-[#8888aa]">Routing Rules</span>
            </div>
            <p className="text-2xl font-bold text-white">{rules.length}</p>
          </div>
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-[#00d4aa]" />
              <span className="text-sm text-[#8888aa]">Total Decisions</span>
            </div>
            <p className="text-2xl font-bold text-white">{decisions.length}</p>
          </div>
          <div className="glass-card p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-sm text-[#8888aa]">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {decisions.filter(d => d.outcome === 'pending').length}
            </p>
          </div>
        </div>

        {/* Pending Decisions */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-4">Decisions Awaiting Feedback</h2>
          {decisions.filter(d => d.outcome === 'pending').length === 0 ? (
            <p className="text-[#8888aa] text-center py-8">No pending decisions — all routing choices have been reviewed.</p>
          ) : (
            <div className="space-y-3">
              {decisions.filter(d => d.outcome === 'pending').map(d => (
                <div key={d.decision_id} className="bg-[#12121a] rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{d.file_name}</p>
                    <p className="text-xs text-[#8888aa]">Routed to: <span className="text-[#6c63ff]">{d.chosen_path}</span></p>
                    <p className="text-xs text-[#8888aa]">
                      {d.ai_analyzed ? '🤖 AI analysed' : '📏 Rule-based'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOutcome(d.decision_id, 'gain')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 transition-colors"
                    >
                      <CheckCircle size={12} /> Correct
                    </button>
                    <button
                      onClick={() => handleOutcome(d.decision_id, 'loss')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                    >
                      <AlertCircle size={12} /> Wrong
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rules table */}
        {rules.length > 0 && (
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-white mb-4">Routing Rules</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a3a]">
                    <th className="text-left py-2 px-3 text-[#8888aa] font-medium">Pattern</th>
                    <th className="text-left py-2 px-3 text-[#8888aa] font-medium">Target</th>
                    <th className="text-right py-2 px-3 text-[#8888aa] font-medium">Confidence</th>
                    <th className="text-right py-2 px-3 text-[#8888aa] font-medium">Gains</th>
                    <th className="text-right py-2 px-3 text-[#8888aa] font-medium">Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.rule_id} className="border-b border-[#1e1e2e] hover:bg-[#12121a] transition-colors">
                      <td className="py-2 px-3 text-white font-mono text-xs">{r.pattern_signature}</td>
                      <td className="py-2 px-3 text-[#6c63ff]">{r.target_module}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-semibold ${r.confidence_weight >= 0.7 ? 'text-green-400' : r.confidence_weight >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {(r.confidence_weight * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-green-400">{r.gain_count}</td>
                      <td className="py-2 px-3 text-right text-red-400">{r.loss_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CDFTrainer;
