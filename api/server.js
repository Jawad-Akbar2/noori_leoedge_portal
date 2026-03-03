// api/server.js
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing env vars: ${missing.join(', ')}`);
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const MONGODB_URI = process.env.MONGODB_URI;
// ✅ Fix: use your real Vercel app URL
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-app.vercel.app';

const app = express();

app.use(cors({
  origin: FRONTEND_URL,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Cached connection for serverless (avoids reconnecting on every request)
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(MONGODB_URI, { family: 4 });
  isConnected = true;
  console.log('✓ MongoDB connected');
};
connectDB().catch(console.error);

mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✓ MongoDB reconnected'));

// ✅ These relative paths work because api/ sits beside backend/
import authRoutes         from '../backend/routes/auth.js';
import employeeRoutes     from '../backend/routes/employees.js';
import attendanceRoutes   from '../backend/routes/attendance.js';
import payrollRoutes      from '../backend/routes/payroll.js';
import performanceRoutes  from '../backend/routes/performance.js';
import requestRoutes      from '../backend/routes/requests.js';
import notificationRoutes from '../backend/routes/notifications.js';
import errorHandler       from '../backend/middleware/errorHandler.js';

app.use('/api/auth',          authRoutes);
app.use('/api/employees',     employeeRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/payroll',       payrollRoutes);
app.use('/api/performance',   performanceRoutes);
app.use('/api/requests',      requestRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'OK',
    env: process.env.NODE_ENV || 'development',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: `${Math.floor(process.uptime())}s`
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

// ✅ Do NOT call app.listen() — Vercel handles this
export default app;