import { storage } from './storageService';
import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8000';

// Autron Configuration API
export const getAutronStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE}/autron/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch Autron status:', error);
    return { enabled: false, flag_path: null };
  }
};

export const toggleAutron = async (enabled) => {
  try {
    const response = await axios.post(`${API_BASE}/autron/toggle`, { enabled });
    return response.data;
  } catch (error) {
    console.error('Failed to toggle Autron:', error);
    throw error;
  }
};

export const getAutronLLMConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE}/autron/llm-config`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch Autron LLM config:', error);
    return { provider: 'groq', model: 'llama-3.3-70b-versatile', fallback_provider: null };
  }
};

export const updateAutronLLMConfig = async (config) => {
  try {
    const response = await axios.post(`${API_BASE}/autron/llm-config`, config);
    return response.data;
  } catch (error) {
    console.error('Failed to update Autron LLM config:', error);
    throw error;
  }
};

const PROVIDER_INFO = {
  groq: {
    name: 'Groq',
    icon: '⚡',
    color: '#6c63ff',
    dailyLimit: 14400,
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
  },
  gemini: {
    name: 'Gemini',
    icon: '✨',
    color: '#4285f4',
    dailyLimit: 1500,
    models: ['gemini-1.5-flash', 'gemini-1.5-pro']
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🔀',
    color: '#ff6b35',
    dailyLimit: Infinity,
    models: ['meta-llama/llama-3.1-8b-instruct:free', 'mistralai/mistral-7b-instruct:free']
  },
  cloudflare: {
    name: 'Cloudflare',
    icon: '☁️',
    color: '#f48120',
    dailyLimit: 10000,
    models: ['@cf/meta/llama-3.1-8b-instruct']
  }
};

const AI_CONFIG = {
  groq: {
    call: async (messages, systemPrompt, model, apiKey) => {
      // Ensure valid model, fallback to default if invalid
      const validModel = model && model.startsWith('llama-') ? model : 'llama-3.1-8b-instant';
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: validModel,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Primary provider failed (Check API key or Model name)');
        } else if (response.status === 404) {
          throw new Error('Primary provider failed (Check API key or Model name)');
        }
        const data = await response.json();
        throw new Error(data.error?.message || 'Request failed');
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices[0].message.content;
    }
  },
  gemini: {
    call: async (messages, systemPrompt, model, apiKey) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates[0].content.parts[0].text;
    }
  },
  openrouter: {
    call: async (messages, systemPrompt, model, apiKey) => {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'system', content: systemPrompt }, ...messages]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices[0].message.content;
    }
  },
  cloudflare: {
    call: async (messages, systemPrompt, model, apiKey) => {
      const accountId = storage.getString('AI_CLOUDFLARE_ACCOUNT_ID');
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model || '@cf/meta/llama-3.1-8b-instruct'}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'system', content: systemPrompt }, ...messages]
        })
      });
      const data = await response.json();
      if (data.errors) throw new Error(data.errors[0].message);
      return data.result.response;
    }
  }
};

const DEFAULT_TASK_ROUTES = {
  chat: { primary: 'groq', fallback: 'gemini', reason: 'Speed' },
  quiz: { primary: 'groq', fallback: 'openrouter', reason: 'Structured output' },
  document: { primary: 'gemini', fallback: 'groq', reason: 'Long context' },
  assignment: { primary: 'gemini', fallback: 'groq', reason: 'Analytical' },
  planning: { primary: 'groq', fallback: 'gemini', reason: 'Speed' },
  cdf: { primary: 'gemini', fallback: 'groq', reason: 'Document understanding' }
};

export const callAI = async (messages, systemPrompt, taskType = 'chat') => {
  const strategy = storage.get('AI_STRATEGY') || 'smart';
  const taskRoutes = storage.get('AI_TASK_ROUTES') || DEFAULT_TASK_ROUTES;
  const primary = storage.getString('AI_PRIMARY') || 'groq';
  const secondary = storage.getString('AI_SECONDARY') || 'gemini';
  const tertiary = storage.getString('AI_TERTIARY') || 'openrouter';

  let providerOrder = [];

  if (strategy === 'smart' && taskRoutes[taskType]) {
    providerOrder = [taskRoutes[taskType].primary, taskRoutes[taskType].fallback, primary, secondary, tertiary];
  } else if (strategy === 'manual') {
    providerOrder = [primary];
  } else if (strategy === 'round-robin') {
    const allProviders = ['groq', 'gemini', 'openrouter', 'cloudflare'];
    const lastUsed = storage.getString('AI_LAST_USED');
    const currentIndex = allProviders.indexOf(lastUsed);
    const nextIndex = (currentIndex + 1) % allProviders.length;
    providerOrder = [allProviders[nextIndex]];
  } else {
    providerOrder = [primary, secondary, tertiary];
  }

  providerOrder = [...new Set(providerOrder.filter(Boolean))];

  const startTime = Date.now();

  for (const providerId of providerOrder) {
    try {
      const apiKey = storage.getString(`AI_KEY_${providerId.toUpperCase()}`);
      if (!apiKey) {
        console.log(`${providerId} has no API key, trying next...`);
        continue;
      }

      const model = storage.get(`AI_MODEL_${providerId.toUpperCase()}`) || PROVIDER_INFO[providerId]?.models[0];
      const result = await AI_CONFIG[providerId].call(messages, systemPrompt, model, apiKey);
      const latency = Date.now() - startTime;

      storage.setString('AI_LAST_USED', providerId);
      storage.setString('AI_LAST_PROVIDER_NAME', PROVIDER_INFO[providerId]?.name || providerId);

      const usage = storage.get('AI_USAGE') || {};
      usage[providerId] = (usage[providerId] || 0) + 1;
      storage.set('AI_USAGE', usage);

      const log = storage.get('AI_REQUEST_LOG') || [];
      log.unshift({
        time: new Date().toLocaleTimeString(),
        task: taskType,
        provider: PROVIDER_INFO[providerId]?.name || providerId,
        latency,
        status: 'success'
      });
      if (log.length > 20) log.pop();
      storage.set('AI_REQUEST_LOG', log);

      return { result, provider: PROVIDER_INFO[providerId]?.name || providerId, latency };
    } catch (error) {
      console.log(`${providerId} failed: ${error.message}, trying next...`);
      if (strategy !== 'smart' && strategy !== 'round-robin') break;
      continue;
    }
  }

  throw new Error('All AI providers failed or not configured. Please configure at least one AI provider in AI Manager.');
};

export const testConnection = async (providerId, apiKey, model) => {
  const startTime = Date.now();
  try {
    const result = await AI_CONFIG[providerId].call(
      [{ role: 'user', content: 'Hello' }],
      'You are a helpful assistant.',
      model,
      apiKey
    );
    const latency = Date.now() - startTime;
    return { success: true, result, latency };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getProviderStatus = async () => {
  const statuses = {};

  for (const [providerId, info] of Object.entries(PROVIDER_INFO)) {
    const apiKey = storage.getString(`AI_KEY_${providerId.toUpperCase()}`);
    if (!apiKey) {
      statuses[providerId] = { status: 'no-key', latency: null };
      continue;
    }

    try {
      const startTime = Date.now();
      await AI_CONFIG[providerId].call(
        [{ role: 'user', content: 'Hi' }],
        'You are a helpful assistant.',
        info.models[0],
        apiKey
      );
      const latency = Date.now() - startTime;
      statuses[providerId] = {
        status: latency < 500 ? 'online' : latency < 2000 ? 'slow' : 'online',
        latency
      };
    } catch (error) {
      statuses[providerId] = { status: 'error', latency: null };
    }
  }

  return statuses;
};

export const getActiveProviderStatus = async () => {
  // Check the currently selected primary provider
  const primary = storage.getString('AI_PRIMARY') || 'groq';
  const apiKey = storage.getString(`AI_KEY_${primary.toUpperCase()}`);
  
  if (!apiKey) {
    return { online: false, reason: 'no_key', provider: primary };
  }

  try {
    const model = storage.get(`AI_MODEL_${primary.toUpperCase()}`) || PROVIDER_INFO[primary]?.models[0];
    const startTime = Date.now();
    
    await AI_CONFIG[primary].call(
      [{ role: 'user', content: 'Hi' }],
      'You are a helpful assistant.',
      model,
      apiKey
    );
    
    const latency = Date.now() - startTime;
    return { online: true, provider: primary, latency };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return { online: false, reason: 'invalid_key', provider: primary };
    } else if (error.message.includes('404') || error.message.includes('Model')) {
      return { online: false, reason: 'model_not_found', provider: primary };
    }
    return { online: false, reason: 'connection_error', provider: primary };
  }
};

export { PROVIDER_INFO, DEFAULT_TASK_ROUTES };
export default AI_CONFIG;
