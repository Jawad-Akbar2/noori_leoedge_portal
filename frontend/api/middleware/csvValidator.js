// middleware/csvValidator.js

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Some browsers/OS send these MIME types for .csv files
const VALID_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',       // Windows Excel sometimes sends this for .csv
  'application/octet-stream'        // fallback when MIME detection fails
]);

export function validateCSVFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:   'CSV_FILE_MISSING',
        message: 'No CSV file provided'
      });
    }

    const { mimetype, originalname, size } = req.file;

    // Accept if MIME is known-valid OR filename ends in .csv
    const mimeOk = VALID_MIME_TYPES.has(mimetype);
    const nameOk = originalname?.toLowerCase().endsWith('.csv');

    if (!mimeOk && !nameOk) {
      return res.status(400).json({
        success: false,
        error:   'INVALID_FILE_TYPE',
        message: 'Invalid file type. Please upload a .csv file.'
      });
    }

    if (size === 0) {
      return res.status(400).json({
        success: false,
        error:   'FILE_EMPTY',
        message: 'The uploaded CSV file is empty.'
      });
    }

    if (size > MAX_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error:   'FILE_TOO_LARGE',
        message: `File size (${(size / 1024 / 1024).toFixed(1)} MB) exceeds the 5 MB limit.`
      });
    }

    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      error:   'CSV_VALIDATION_ERROR',
      message: err.message
    });
  }
}

export default validateCSVFile;