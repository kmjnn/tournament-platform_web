const API_URL = 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('token');
}

async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken()) headers['Authorization'] = `Bearer ${getToken()}`;
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}