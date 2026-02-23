import API_BASE_URL from "../config";

/**
 * Get the auth token from sessionStorage.
 */
const getToken = () => sessionStorage.getItem("token");

/**
 * Build headers with Authorization token.
 * If extraHeaders are provided they are merged in.
 */
const authHeaders = (extraHeaders = {}) => {
  const token = getToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Authenticated fetch wrapper.
 * Automatically prepends API_BASE_URL and adds the Authorization header.
 * For FormData bodies, do NOT set Content-Type (browser sets it with boundary).
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const isFormData = options.body instanceof FormData;
  const defaultHeaders = isFormData ? {} : { "Content-Type": "application/json" };

  const config = {
    ...options,
    headers: authHeaders({ ...defaultHeaders, ...options.headers }),
  };

  const response = await fetch(url, config);

  // If we get a 401, the token is invalid/expired — redirect to login
  if (response.status === 401) {
    sessionStorage.clear();
    window.location.href = "/login";
    throw new Error("Session expired. Redirecting to login.");
  }

  return response;
};

/**
 * Convenience: GET request with auth.
 */
export const apiGet = (endpoint) => apiFetch(endpoint, { method: "GET" });

/**
 * Convenience: POST JSON with auth.
 */
export const apiPost = (endpoint, body) =>
  apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });

/**
 * Convenience: PUT JSON with auth.
 */
export const apiPut = (endpoint, body) =>
  apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/**
 * Convenience: DELETE with auth.
 */
export const apiDelete = (endpoint) =>
  apiFetch(endpoint, { method: "DELETE" });

/**
 * POST FormData (for file uploads) with auth.
 */
export const apiPostForm = (endpoint, formData) =>
  apiFetch(endpoint, {
    method: "POST",
    body: formData,
  });

/**
 * PUT FormData (for file uploads) with auth.
 */
export const apiPutForm = (endpoint, formData) =>
  apiFetch(endpoint, {
    method: "PUT",
    body: formData,
  });

export { API_BASE_URL, getToken };
