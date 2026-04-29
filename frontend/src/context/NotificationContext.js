/**
 * context/NotificationContext.js
 *
 * Provides toast-style notifications to the whole app.
 *
 * Usage:
 *   const { notify } = useNotification();
 *   notify.success('Saved!');
 *   notify.error('Something went wrong');
 *   notify.info('Loading…');
 *   notify.warn('Check your input');
 *
 *   // Or raw:
 *   addNotification('Custom message', 'info', 4000);
 */

import React, {
  createContext,
  useState,
  useCallback,
  useContext
} from 'react';

export const NotificationContext = createContext(null);

// ─── convenience hook ─────────────────────────────────────────────────────────
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside <NotificationProvider>');
  return ctx;
}

// ─── provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }

    return id;   // caller can use this to dismiss manually
  }, [removeNotification]);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);

  // ── shorthand helpers ─────────────────────────────────────────────────────
  const notify = {
    success: (msg, duration) => addNotification(msg, 'success', duration),
    error:   (msg, duration) => addNotification(msg, 'error',   duration ?? 5000),
    info:    (msg, duration) => addNotification(msg, 'info',    duration),
    warn:    (msg, duration) => addNotification(msg, 'warning', duration),
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        notify   // preferred shorthand
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}