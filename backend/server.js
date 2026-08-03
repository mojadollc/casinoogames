require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.production') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const { connectRedis, connectDB, pool } = require('./config/database');
const { apiLimiter } = require('./middleware/auth');

// ── Crash guards — prevent silent process death on unhandled errors ──────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message, err.stack);
  // Don't exit — PM2 will restart if truly unrecoverable
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

const app = express();
const server = http.createServer(app);

// ── Trust nginx proxy — MUST be first, before any middleware ─────────────────
// Without this req.ip = 127.0.0.1 for all users, breaking rate limiting & logs
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ['websocket', 'polling'],
});

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => {
    // Allow: no origin (same-origin / mobile apps), or whitelisted domains
    const allowed = [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiLimiter);

app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./auth/routes'));
app.use('/api/wallet', require('./wallet/routes').router);
app.use('/api/payments', require('./payment/routes').router);
app.use('/api/games', require('./games/routes'));
app.use('/api/promotions', require('./promotions/routes').router);
app.use('/api/notifications', require('./notifications/routes').router);
app.use('/api/admin', require('./reporting/admin'));
app.use('/api/affiliation', require('./affiliation/routes').router);

// Xendit webhook — no auth, no rate limit
app.post('/webhooks/xendit', require('./payment/routes').webhookHandler);

// ── Health check — always responds, used by deploy script ────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', db: 'ok', timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'down', error: err.message });
  }
});

// ── Global error handler — catches any unhandled route errors ────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', req.method, req.path, err.message);
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'CORS error' });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket.IO ────────────────────────────────────────────────────────────────
const adminModule = require('./reporting/admin');
const { trackOnlineUsers } = adminModule;
io.on('connection', (socket) => {
  socket.on('join', (userId) => socket.join(userId));
  socket.on('join:admin', () => socket.join('admins'));
  socket.on('disconnect', () => {});
});
trackOnlineUsers(io);
app.set('io', io);

// ── Lucky draw scheduler ─────────────────────────────────────────────────────
const { runLuckyDraw } = require('./promotions/routes');
setInterval(runLuckyDraw, 60 * 60 * 1000);

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3020;
server.listen(PORT, async () => {
  try { await connectDB(); } catch (e) { console.error('DB connection failed:', e.message); }
  try { await connectRedis(); } catch (e) { console.log('Redis not available, continuing without cache'); }
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
