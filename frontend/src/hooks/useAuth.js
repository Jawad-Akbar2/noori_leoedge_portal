/**
 * hooks/useAuth.js
 *
 * ⚠️  Thin shim — re-exports useAuth from AuthContext.
 *
 * Auth state lives ONLY in AuthContext (single source of truth).
 * This file exists so components that import from 'hooks/useAuth'
 * continue to work without any changes.
 *
 * Usage:
 *   import { useAuth } from '../hooks/useAuth';
 *   const { user, role, login, logout, loading } = useAuth();
 */

export { useAuth } from '../context/AuthContext.js';