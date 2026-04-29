// backend/server.js

import express   from 'express';
import cors      from 'cors';
import mongoose  from 'mongoose';
import dotenv    from 'dotenv';
import { initGridFS } from './utils/gridfs.js';
dotenv.config();





// ── Env validation ───────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT         = process.env.PORT         || 5000;
const MONGODB_URI  = process.env.MONGODB_URI;
const NODE_ENV     = process.env.NODE_ENV     || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── DB connection ────────────────────────────────────────────────
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  await mongoose.connect(MONGODB_URI, {
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  // ✅ Safe here — mongoose.connect() resolves only after connection is open
  initGridFS();
  console.log("✓ MongoDB connected");
};

// ✅ Also re-init on reconnect — bucket reference is stale after a disconnect
mongoose.connection.on("reconnected", () => {
  initGridFS();
  console.log("✓ MongoDB reconnected");
});

(async () => {
  await connectDB();
})();

mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('✓ MongoDB reconnected'));

// ── Express app ──────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin:         FRONTEND_URL,
  credentials:    false,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ── Guarantee DB before every request ───────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
  }
});



// ── Routes ───────────────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import employeeRoutes      from './routes/employees.js';
import attendanceRoutes    from './routes/attendance.js';
import payrollRoutes       from './routes/payroll.js';
import performanceRoutes   from './routes/performance.js';
import requestRoutes       from './routes/requests.js';
import notificationRoutes  from './routes/notifications.js';
import adminStatsRoutes    from './routes/adminStats.js';
import employeeStatsRoutes from './routes/employeeStats.js';
import errorHandler        from './middleware/errorHandler.js';

app.use('/api/auth',           authRoutes);
app.use('/api/employees',      employeeRoutes);
app.use('/api/attendance',     attendanceRoutes);
app.use('/api/payroll',        payrollRoutes);
app.use('/api/performance',    performanceRoutes);
app.use('/api/requests',       requestRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/stats',    adminStatsRoutes);    // ← fixed
app.use('/api/stats', employeeStatsRoutes); // ← fixed

app.get('/api/health', (_req, res) => res.json({
  success: true,
  status: 'OK',
  env: NODE_ENV,
  timezone: process.env.TZ,
  serverTime: new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}),
  serverISO: new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}),
  dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  uptime: `${Math.floor(process.uptime())}s`,
}));

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

// ── Local dev only ───────────────────────────────────────────────
if (NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`✓ Port        : ${PORT}`);
    console.log(`✓ Environment : ${NODE_ENV}`);
    console.log(`✓ Frontend    : ${FRONTEND_URL}`);
  });
  process.on('SIGTERM', () => server.close(() => mongoose.connection.close()));
  process.on('SIGINT',  () => server.close(() => mongoose.connection.close()));
}

export default app;