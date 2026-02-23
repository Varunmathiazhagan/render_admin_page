// Centralized API configuration
// Change this URL to match your deployed admin backend
const API_BASE_URL = "https://render-admin-page.onrender.com";

// Helper to get Authorization headers from session token
export const getAuthHeaders = () => {
  const token = sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default API_BASE_URL;
