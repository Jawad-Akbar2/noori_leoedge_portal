/**
 * utils/timeNormalizer.js
 *
 * ⚠️  SHIM — do not add logic here.
 * All exports delegate to timeUtils.js (single source of truth).
 * Kept so existing imports of timeNormalizer.js continue to work without changes.
 */

export {
  normalizeTime,
  isValidTime,
  formatTimeDisplay,
} from './timeUtils.js';

export { default } from './timeUtils.js';