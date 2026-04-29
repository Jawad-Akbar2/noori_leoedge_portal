/**
 * utils/timeValidator.js
 *
 * ⚠️  SHIM — do not add logic here.
 * All exports delegate to timeUtils.js (single source of truth).
 * Kept so existing imports of timeValidator.js continue to work without changes.
 */

export {
  isValidTime,
  isValidTimeRange,
  sanitizeTime,
  formatTimeInput,
  timeToMinutes,
  isLate,
  calculateDelayMinutes,
  calculateHoursBetween,
} from './timeUtils.js';