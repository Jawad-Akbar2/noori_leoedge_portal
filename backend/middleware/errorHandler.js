// middleware/errorHandler.js

const isDev = process.env.NODE_ENV !== 'production';

const errorHandler = (err, req, res, next) => {
  // Always log in dev; in prod log only 5xx
  if (isDev || !err.statusCode || err.statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.error(err);
  }

  // ── Mongoose: document not found / bad ObjectId ──────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // ── Mongoose: schema validation failed ───────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // ── Mongoose: duplicate key (unique index) ────────────────────────────────
  if (err.code === 11000) {
    const field   = Object.keys(err.keyValue || {})[0] ?? 'field';
    const value   = err.keyValue?.[field];
    return res.status(409).json({
      success: false,
      message: `${field} '${value}' already exists`
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // ── Custom API errors (throw with err.statusCode) ─────────────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(isDev && { stack: err.stack })
    });
  }

  // ── Multer errors ─────────────────────────────────────────────────────────
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  }

  // ── Default 500 ───────────────────────────────────────────────────────────
  res.status(500).json({
    success: false,
    message: isDev ? err.message : 'Internal Server Error',
    ...(isDev && { stack: err.stack })
  });
};

export default errorHandler;