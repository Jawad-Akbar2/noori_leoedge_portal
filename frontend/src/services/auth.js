/**
 * Auth Service
 * Handles authentication logic
 */

// LOGIN: No role parameter, backend returns role
export async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const { token, user } = await response.json();

    // CRITICAL: Backend returns role in user object
    if (!user.role) {
      throw new Error('No role assigned. Contact administrator.');
    }

    // Store token and user with role
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('role', user.role); // CRITICAL: Store role for routing

    return { token, user };
  } catch (error) {
    throw error;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('role');
}

export function isAuthenticated() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  return !!token && !!user;
}

export function getRole() {
  return localStorage.getItem('role');
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export async function validateToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const response = await fetch('/api/auth/validate-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return false;

    const data = await response.json();
    
    // Update role if needed
    if (data.role) {
      localStorage.setItem('role', data.role);
    }

    return data.valid;
  } catch (error) {
    return false;
  }
}

export async function changePassword(newPassword) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to change password');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}