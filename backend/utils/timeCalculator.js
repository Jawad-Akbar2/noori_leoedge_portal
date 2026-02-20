/**
 * Time Calculator Utility
 * Handles all time calculations with 24-hour format and overnight shift support
 */

// Validate time format
export function isValidTime(time) {
  if (!time) return false;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Parse time string to minutes
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Convert minutes to time string
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Calculate hours between two times (handles overnight)
export function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);

  // Handle overnight shift
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

// Check if time is late compared to shift start
export function isLate(inTime, shiftStartTime) {
  if (!inTime || !shiftStartTime) return false;

  const inMinutes = timeToMinutes(inTime);
  const shiftMinutes = timeToMinutes(shiftStartTime);

  return inMinutes > shiftMinutes;
}

// Calculate delay in minutes
export function calculateDelayMinutes(inTime, shiftStartTime) {
  if (!inTime || !shiftStartTime) return 0;

  const inMinutes = timeToMinutes(inTime);
  const shiftMinutes = timeToMinutes(shiftStartTime);

  if (inMinutes <= shiftMinutes) return 0;

  return inMinutes - shiftMinutes;
}

// Normalize date to midnight UTC
export function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get company month dates (18th to 17th)
export function getCompanyMonthDates(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let startDate, endDate;

  if (day >= 18) {
    startDate = new Date(year, month, 18);
    endDate = new Date(year, month + 1, 17);
  } else {
    startDate = new Date(year, month - 1, 18);
    endDate = new Date(year, month, 17);
  }

  return { startDate, endDate };
}

// Calculate earnings based on hours and rate
export function calculateEarning(hours, hourlyRate) {
  if (!hours || !hourlyRate) return 0;
  return hours * hourlyRate;
}

// Format time for display
export function formatTimeDisplay(time) {
  if (!time) return '--:--';
  return time;
}

// Validate shift times
export function validateShiftTimes(startTime, endTime) {
  if (!isValidTime(startTime)) return false;
  if (!isValidTime(endTime)) return false;
  
  return true;
}

export default {
  isValidTime,
  timeToMinutes,
  minutesToTime,
  calculateHours,
  isLate,
  calculateDelayMinutes,
  normalizeDate,
  getCompanyMonthDates,
  calculateEarning,
  formatTimeDisplay,
  validateShiftTimes
};