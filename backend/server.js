// backend/server.js

import express    from 'express';
import cors       from 'cors';
import mongoose   from 'mongoose';
import dotenv     from 'dotenv';

dotenv.config();

// ─── env validation ───────────────────────────────────────────────────────────

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT        = process.env.PORT        || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV    = process.env.NODE_ENV    || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── app ──────────────────────────────────────────────────────────────────────

const app = express();

// ─── cors ─────────────────────────────────────────────────────────────────────

app.use(cors({
  origin:         FRONTEND_URL,
  credentials:    false,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── body parsing ─────────────────────────────────────────────────────────────
// 50 MB allows CSV uploads; JSON limit kept tighter at 10 MB for API calls

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── database ─────────────────────────────────────────────────────────────────

mongoose.connect(MONGODB_URI, {
  family: 4   // force IPv4 — avoids SRV/DNS issues on Windows (mirrors createAdmin.js)
})
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () =>
  console.warn('⚠ MongoDB disconnected')
);
mongoose.connection.on('reconnected', () =>
  console.log('✓ MongoDB reconnected')
);

// ─── routes ───────────────────────────────────────────────────────────────────

import authRoutes         from './routes/auth.js';
import employeeRoutes     from './routes/employees.js';
import attendanceRoutes   from './routes/attendance.js';
import payrollRoutes      from './routes/payroll.js';
import performanceRoutes  from './routes/performance.js';   // ← was missing
import requestRoutes      from './routes/requests.js';
import notificationRoutes from './routes/notifications.js';

import errorHandler from './middleware/errorHandler.js';

app.use('/api/auth',          authRoutes);
app.use('/api/employees',     employeeRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/payroll',       payrollRoutes);
app.use('/api/performance',   performanceRoutes);           // ← was missing
app.use('/api/requests',      requestRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    success:  true,
    status:   'OK',
    env:      NODE_ENV,
    dbState:  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime:   `${Math.floor(process.uptime())}s`
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── global error handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

// ─── start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment : ${NODE_ENV}`);
  console.log(`✓ Frontend URL: ${FRONTEND_URL}`);
});

// ─── graceful shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(async () => {
    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;