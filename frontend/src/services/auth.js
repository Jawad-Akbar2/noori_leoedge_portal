/**
 * services/auth.js
 *
 * All auth calls go through the central apiClient (services/api.js).
 * No manual fetch(), no duplicate URL logic, no process.env.
 */

import apiClient from './api.js';

// ─── login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Stores token + user in localStorage on success.
 */
export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });

  if (!data.user?.role) {
    throw new Error('No role assigned. Contact administrator.');
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('user',  JSON.stringify(data.user));
  localStorage.setItem('role',  data.user.role);

  return { token: data.token, user: data.user };
}

// ─── logout ───────────────────────────────────────────────────────────────────

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('role');
}

// ─── local checks (no network) ───────────────────────────────────────────────

export function isAuthenticated() {
  return !!localStorage.getItem('token') && !!localStorage.getItem('user');
}

export function getRole() {
  return localStorage.getItem('role');
}

export function getUser() {
  const raw = localStorage.getItem('user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── token validation ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/validate-token
 * Backend route is GET (not POST) — uses the auth middleware to verify the JWT.
 * Returns true if the token is still valid, false otherwise.
 */
export async function validateToken() {
  try {
    if (!localStorage.getItem('token')) return false;

    const { data } = await apiClient.get('/auth/validate-token');

    // Keep stored role in sync with DB in case it changed
    if (data.role) localStorage.setItem('role', data.role);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

    return !!data.valid;
  } catch {
    return false;
  }
}

// ─── change password ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/change-password
 * Requires both currentPassword and newPassword (backend enforces this).
 */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword
  });
  return data;
}

// ─── employee onboarding ──────────────────────────────────────────────────────

/**
 * POST /api/auth/employee-onboard
 * Called when a new employee clicks the invite link and sets up their account.
 *
 * @param {{ token, firstName, lastName, password, bankDetails }} payload
 */
export async function employeeOnboard(payload) {
  const { data } = await apiClient.post('/auth/employee-onboard', payload);

  // Auto-login: store credentials returned by the backend
  if (data.token && data.user) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user',  JSON.stringify(data.user));
    localStorage.setItem('role',  data.user.role);
  }

  return data;
}

const authh  = {
  login,
  logout,
  isAuthenticated,
  getRole,
  getUser,
  validateToken,
  changePassword,
  employeeOnboard,
};
export default authh