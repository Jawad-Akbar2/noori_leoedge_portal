/**
 * utils/csvHelpers.js
 * CSV import helpers for the attendance upload feature.
 * (Export helpers live in csvExporter.js)
 */

// ─── template ─────────────────────────────────────────────────────────────────

/** Generate the pipe-delimited template content string */
export function generateCSVTemplate() {
  const header = 'empid|firstname|lastname|date(dd/mm/yyyy)|time(HH:mm)|status(0=in,1=out)';
  const examples = [
    'EMP001|John|Doe|23/02/2026|09:00|0',
    'EMP001|John|Doe|23/02/2026|18:00|1',
    'EMP002|Jane|Smith|23/02/2026|09:15|0',
    'EMP002|Jane|Smith|23/02/2026|17:45|1',
    // Night-shift example
    'EMP006|Bilal|Siddiqui|23/02/2026|22:00|0',
    'EMP006|Bilal|Siddiqui|24/02/2026|06:00|1'
  ];
  return [header, ...examples].join('\n');
}

/** Trigger a browser download of the CSV template file */
export function downloadCSVTemplate() {
  const content = generateCSVTemplate();
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement('a'), {
    href:     url,
    download: 'attendance_template.csv',
    style:    'display:none'
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── validation ───────────────────────────────────────────────────────────────

/**
 * Quick client-side sanity check before uploading.
 * Does NOT replicate all backend validation — just catches obvious errors
 * early so users get feedback without a round-trip.
 *
 * @param {string} content — raw CSV file text
 * @returns {{ isValid: boolean, errors: Array<{row, message}> }}
 */
export function validateCSVFormat(content) {
  if (!content?.trim()) {
    return { isValid: false, errors: [{ row: 0, message: 'File is empty' }] };
  }

  const lines  = content.trim().split('\n');
  const errors = [];

  // Skip header if present
  const startIdx = lines[0]?.toLowerCase().includes('empid') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line  = lines[i].trim();
    if (!line) continue;

    // Auto-detect delimiter: pipe or comma
    const delim = line.includes('|') ? '|' : ',';
    const parts = line.split(delim);

    if (parts.length < 6) {
      errors.push({
        row:     i + 1,
        message: `Expected 6 columns (delimiter "${delim}"), got ${parts.length}`
      });
      continue;
    }

    // Validate date field (index 3) — must be dd/mm/yyyy
    const dateStr = parts[3]?.trim();
    if (dateStr && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      errors.push({ row: i + 1, message: `Invalid date format "${dateStr}" (expected dd/mm/yyyy)` });
    }

    // Validate status field (index 5) — must be 0 or 1
    const status = parts[5]?.trim();
    if (status !== '0' && status !== '1') {
      errors.push({ row: i + 1, message: `Invalid status "${status}" (must be 0 or 1)` });
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ─── processing log display ───────────────────────────────────────────────────

/**
 * Format the processingLog array returned by POST /api/attendance/import-csv
 * into a plain text string for display in the import results panel.
 */
export function formatCSVProcessingLog(logs) {
  if (!Array.isArray(logs)) return '';

  const icons = {
    ERROR:   '❌',
    WARN:    '⚠️',
    SUCCESS: '✓',
    INFO:    'ℹ️',
    SUMMARY: '✅'
  };

  return logs
    .map(log => `${icons[log.type] || ''} ${log.message}`.trim())
    .join('\n');
}

const csvHelpers = {
  generateCSVTemplate,
  downloadCSVTemplate,
  validateCSVFormat,
  formatCSVProcessingLog
};

export default csvHelpers;
