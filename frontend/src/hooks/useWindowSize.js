/**
 * hooks/useWindowSize.js
 *
 * Reactive window dimensions with breakpoint booleans.
 * SSR-safe (no window access during initial render).
 * Resize handler is debounced (100 ms) to avoid excessive re-renders.
 *
 * Usage:
 *   const { width, isMobile, isTablet, isDesktop } = useWindowSize();
 */

import { useState, useEffect } from 'react';

function getSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, isMobile: false, isTablet: false, isDesktop: true };
  }
  const width  = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024
  };
}

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState(getSize);

  useEffect(() => {
    let timer;

    function handleResize() {
      clearTimeout(timer);
      timer = setTimeout(() => setWindowSize(getSize()), 100);
    }

    window.addEventListener('resize', handleResize);

    // Sync on mount in case window size changed before effect ran
    setWindowSize(getSize());

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowSize;
}