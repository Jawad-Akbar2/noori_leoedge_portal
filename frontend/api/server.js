// api/server.js
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// ─── Required environment variables ─────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://noori_leoedge_portal.vercel.com';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Database Connection ───────────────────────────────────────────────────────
if (!mongoose.connection.readyState) {
  mongoose
    .connect(MONGODB_URI, { family: 4 })
    .then(() => console.log('✓ MongoDB connected'))
    .catch(err => {
      console.error('✗ MongoDB connection failed:', err.message);
      throw err;
    });
}

mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✓ MongoDB reconnected'));

// ─── Import Routes ────────────────────────────────────────────────────────────
import authRoutes from '../backend/routes/auth.js';
import employeeRoutes from '../backend/routes/employees.js';
import attendanceRoutes from '../backend/routes/attendance.js';
import payrollRoutes from '../backend/routes/payroll.js';
import performanceRoutes from '../backend/routes/performance.js';
import requestRoutes from '../backend/routes/requests.js';
import notificationRoutes from '../backend/routes/notifications.js';

// ─── Import Middleware ────────────────────────────────────────────────────────
import errorHandler from '../backend/middleware/errorHandler.js';

// ─── Register Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'OK',
    message: 'HR Portal Backend is running',
    env: process.env.NODE_ENV || 'development',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: `${Math.floor(process.uptime())}s`
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ─── Start server only for local development ──────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Frontend URL: ${FRONTEND_URL}`);
  });
}

// ─── Export for Vercel serverless ─────────────────────────────────────────────
export default app;