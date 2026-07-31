require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);
    console.log('Migration 007 completed');
    process.exit(0);
  } catch (err) {
    if (err.message.includes('Duplicate column')) { console.log('Already migrated'); process.exit(0); }
    console.error('Migration 007 failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
