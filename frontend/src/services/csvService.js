/**
 * services/csvService.js
 *
 * CSV import + attendance range queries.
 * Uses the central apiClient — no manual token handling or URL construction.
 */

import apiClient from './api.js';

// ─── CSV upload ───────────────────────────────────────────────────────────────

/**
 * POST /api/attendance/import-csv
 * Uploads a CSV file and returns the processing log + summary.
 *
 * @param   {File}   file — the .csv File object from an <input type="file">
 * @returns {Object} { success, data, processingLog } on success
 *                   { success: false, error, processingLog } on failure
 */
export async function uploadCSVFile(file) {
  try {
    const formData = new FormData();
    formData.append('csvFile', file);

    const { data } = await apiClient.post('/attendance/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1200_000   // large files can take a while
    });

    return {
      success:       true,
      data,
      processingLog: data.processingLog || []
    };
  } catch (error) {
    const errMsg  = error.response?.data?.message || error.message || 'Upload failed';
    const logData = error.response?.data?.processingLog;

    return {
      success:       false,
      error:         errMsg,
      processingLog: logData?.length
        ? logData
        : [{ type: 'ERROR', message: errMsg }]
    };
  }
}

// ─── attendance range ─────────────────────────────────────────────────────────

/**
 * GET /api/attendance/range?fromDate=dd/mm/yyyy&toDate=dd/mm/yyyy
 *
 * @param {string} fromDate — dd/mm/yyyy
 * @param {string} toDate   — dd/mm/yyyy
 */
export async function getAttendanceRange(fromDate, toDate) {
  try {
    const { data } = await apiClient.get('/attendance/range', {
      params: { fromDate, toDate }
    });
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:   error.response?.data?.message || error.message
    };
  }
}

const csvService ={
  uploadCSVFile,
  getAttendanceRange
};
export default csvService;