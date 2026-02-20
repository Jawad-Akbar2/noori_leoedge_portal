/**
 * Clipboard Utility
 * Handles copying text to clipboard with fallback support
 */

export async function copyToClipboard(text) {
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      console.error('Clipboard API failed:', err);
      // Fall back to older method
      return fallbackCopy(text);
    }
  }

  // Fallback for older browsers
  return fallbackCopy(text);
}

/**
 * Fallback copy method using textarea selection
 * @param {string} text - Text to copy
 * @returns {Object} - { success: boolean }
 */
function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    return { success: successful };
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return { success: false, error: err.message };
  }
}