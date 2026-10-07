/**
 * Central HTTP client communicating with backend /api endpoints.
 * Automatically injects the JWT token stored in sessionStorage.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('host_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}
