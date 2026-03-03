import express    from 'express';
import cors       from 'cors';
import mongoose   from 'mongoose';
import dotenv     from 'dotenv';

dotenv.config();

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT         = process.env.PORT         || 5000;
const MONGODB_URI  = process.env.MONGODB_URI;
const NODE_ENV     = process.env.NODE_ENV     || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();

app.use(cors({
  origin:         FRONTEND_URL,
  credentials:    false,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Cached connection for Vercel serverless
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

import authRoutes         from './routes/auth.js';
import employeeRoutes     from './routes/employees.js';
import attendanceRoutes   from './routes/attendance.js';
import payrollRoutes      from './routes/payroll.js';
import performanceRoutes  from './routes/performance.js';
import requestRoutes      from './routes/requests.js';
import notificationRoutes from './routes/notifications.js';
import errorHandler       from './middleware/errorHandler.js';

app.use('/api/auth',          authRoutes);
app.use('/api/employees',     employeeRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/payroll',       payrollRoutes);
app.use('/api/performance',   performanceRoutes);
app.use('/api/requests',      requestRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    success:  true,
    status:   'OK',
    env:      NODE_ENV,
    dbState:  mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime:   `${Math.floor(process.uptime())}s`
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

// ✅ Local dev only — Vercel does NOT use app.listen()
if (process.env.NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment : ${NODE_ENV}`);
    console.log(`✓ Frontend URL: ${FRONTEND_URL}`);
  });
  process.on('SIGTERM', () => server.close(() => mongoose.connection.close()));
  process.on('SIGINT',  () => server.close(() => mongoose.connection.close()));
}

export default app;