const mysql = require('mysql2/promise');
const redis = require('redis');

// ── MySQL pool ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || '127.0.0.1',
  port:              process.env.DB_PORT     || 3306,
  database:          process.env.DB_NAME,
  user:              process.env.DB_USER,
  password:          process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:   20,
  queueLimit:        0,
  timezone:          '+00:00',
  // Reconnect automatically if the connection drops
  enableKeepAlive:   true,
  keepAliveInitialDelay: 10000,
});

// Verify DB is reachable at startup — retry up to 10 times with 3s delay
const connectDB = async () => {
  for (let i = 1; i <= 10; i++) {
    try {
      await pool.execute('SELECT 1');
      console.log('MySQL connected');
      return;
    } catch (err) {
      console.error(`MySQL connection attempt ${i}/10 failed: ${err.message}`);
      if (i === 10) throw new Error('MySQL unreachable after 10 attempts');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
};

// ── Redis ─────────────────────────────────────────────────────────────────────
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err.message));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));

const connectRedis = async () => {
  await redisClient.connect();
  console.log('Redis connected');
};

// ── Query helper ──────────────────────────────────────────────────────────────
// Converts PostgreSQL $1,$2 placeholders to MySQL ? for compatibility
const query = async (text, params = []) => {
  const sql = text.replace(/\$\d+/g, '?');
  try {
    const [rows] = await pool.execute(sql, params);
    return { rows: Array.isArray(rows) ? rows : [rows] };
  } catch (err) {
    console.error('[DB ERROR]', sql.substring(0, 120), err.message);
    throw err;
  }
};

// ── Transaction helper ────────────────────────────────────────────────────────
const getClient = async () => {
  const conn = await pool.getConnection();
  return {
    query: async (text, params = []) => {
      const sql = text.replace(/\$\d+/g, '?');
      const [rows] = await conn.query(sql, params);
      return { rows: Array.isArray(rows) ? rows : [rows] };
    },
    query_raw: (text, params = []) => {
      const sql = text.replace(/\$\d+/g, '?');
      return conn.query(sql, params);
    },
    BEGIN:   () => conn.beginTransaction(),
    COMMIT:  () => conn.commit(),
    ROLLBACK: () => conn.rollback(),
    release: () => conn.release(),
  };
};

module.exports = { pool, query, getClient, redisClient, connectRedis, connectDB };
