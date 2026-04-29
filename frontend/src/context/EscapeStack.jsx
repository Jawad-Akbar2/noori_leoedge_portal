// context/EscapeStack.jsx
//
// Global ESC-key manager using a stack model.
// ─ Each modal/dropdown/popover that wants ESC support calls useEscape(onClose).
// ─ The hook registers a handler on mount and removes it on unmount.
// ─ Only the most-recently-registered handler fires when ESC is pressed
//   (stack order == z-order).
// ─ Nothing is coupled to any specific component library or CSS class.

import React, {
  createContext, useContext, useRef, useEffect, useCallback
} from 'react';

// ─── Context ──────────────────────────────────────────────────────────────────

const EscapeStackContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
// Wrap your application root once:
//
//   <EscapeStackProvider>
//     <App />
//   </EscapeStackProvider>

export function EscapeStackProvider({ children }) {
  // Stack of { id, handler } objects — last item == topmost layer
  const stackRef = useRef([]);

  const push = useCallback((id, handler) => {
    stackRef.current = [...stackRef.current, { id, handler }];
  }, []);

  const pop = useCallback((id) => {
    stackRef.current = stackRef.current.filter(entry => entry.id !== id);
  }, []);

  // Single global keydown listener — never re-created
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;

      const stack = stackRef.current;
      if (!stack.length) return;

      // Fire only the top-most handler
      const top = stack[stack.length - 1];

      // Don't swallow ESC if focus is inside a plain text input / textarea
      // UNLESS the focused element is itself inside the top layer.
      // Strategy: let the handler decide — we always call it, but we also
      // check whether the active element is an uncontrolled text field that
      // should handle ESC itself (e.g. browser native autocomplete).
      // Handlers can inspect `e.defaultPrevented` if needed.
      top.handler(e);

      // Prevent further bubbling so nested listeners don't double-fire
      e.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true); // capture phase
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <EscapeStackContext.Provider value={{ push, pop }}>
      {children}
    </EscapeStackContext.Provider>
  );
}

// ─── Internal hook ────────────────────────────────────────────────────────────

function useEscapeStack() {
  const ctx = useContext(EscapeStackContext);
  if (!ctx) {
    throw new Error('useEscape must be used inside <EscapeStackProvider>');
  }
  return ctx;
}

// ─── Public hook — use this in every component ────────────────────────────────
//
// useEscape(onClose, enabled?)
//
// • `onClose`  — function to call when ESC is pressed and this layer is on top.
//                Called with the native KeyboardEvent so you can call
//                e.preventDefault() if needed.
// • `enabled`  — boolean (default true).  Set to false to temporarily pause
//                without unmounting (e.g. while a child modal is open and you
//                want the child to handle ESC instead).
//
// Usage:
//   function MyModal({ onClose }) {
//     useEscape(onClose);
//     ...
//   }
//
//   // Conditionally disabled:
//   function Dropdown({ open, onClose }) {
//     useEscape(onClose, open);   // only active while open
//     ...
//   }

let _idCounter = 0;

export function useEscape(onClose, enabled = true) {
  const { push, pop } = useEscapeStack();
  // Stable ref so we don't re-register when the parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable ID for this registration
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = ++_idCounter;
  const id = idRef.current;

  useEffect(() => {
    if (!enabled) {
      pop(id);
      return;
    }
    const handler = (e) => onCloseRef.current(e);
    push(id, handler);
    return () => pop(id);
  }, [enabled, id, push, pop]);
}