// Centralized API configuration
// Change this URL to match your deployed admin backend
import axios from 'axios';

const API_BASE_URL = "https://render-admin-page-1.onrender.com";

// Global axios defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 12000;

// Global 401 interceptor — redirect to login on expired/invalid token
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper to get Authorization headers from session token
export const getAuthHeaders = () => {
  const token = sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default API_BASE_URL;
