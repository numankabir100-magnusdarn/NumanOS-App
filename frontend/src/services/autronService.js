import API from './api';

export const getAutronStatus = () => API.get('/autron/status');
export const toggleAutron = (enabled) => API.post('/autron/toggle', { enabled });

export const getLLMConfig = () => API.get('/autron/llm-config');
export const updateLLMConfig = (config) => API.post('/autron/llm-config', config);

export const getActivity = (limit = 10) => API.get('/autron/activity', { params: { limit } });
export const getPendingReview = () => API.get('/autron/pending-review');
export const approveReview = (id) => API.post(`/autron/pending-review/${id}/approve`);
export const rejectReview = (id) => API.post(`/autron/pending-review/${id}/reject`);

export const getSkills = () => API.get('/skills');
export const uploadSkill = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/skills', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteSkill = (id) => API.delete(`/skills/${id}`);
