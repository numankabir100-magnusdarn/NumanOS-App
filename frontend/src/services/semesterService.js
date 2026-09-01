import axios from 'axios';

const API = axios.create({ 
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  }
});

export const listSemesters = () => API.get('/semesters');
export const getActiveSemester = () => API.get('/semesters/active');
export const getSemesterSummary = (id) => API.get(`/semesters/${id}/summary`);
export const createSemester = (data) => API.post('/semesters', data);
export const addCoursesToSemester = (id, courses) => API.post(`/semesters/${id}/courses`, courses);
export const getCarryOverSuggestions = (prevId) => API.post(`/semesters/${prevId}/courses/carry-over`);
export const wrapupSemester = (id) => API.post(`/semesters/${id}/wrapup`, null, {
  responseType: 'blob',
});

export default API;
