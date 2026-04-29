/**
 * hooks/useLocalStorage.js
 *
 * Synced useState that persists to localStorage.
 * Safe JSON parse/stringify — never throws.
 *
 * Usage:
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 *   const [,, removeTheme] = useLocalStorage('theme', 'light');
 *   removeTheme();
 */

import { useState, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Stable setter — supports functional updates just like useState
  const setValue = useCallback((value) => {
    try {
      setStoredValue(prev => {
        const next = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error(`useLocalStorage: failed to set "${key}"`, err);
    }
  }, [key]);

  // Remove key from storage and reset to initialValue
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (err) {
      console.error(`useLocalStorage: failed to remove "${key}"`, err);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}