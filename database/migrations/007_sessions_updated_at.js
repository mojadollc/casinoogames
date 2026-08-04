/**
 * Add sessions.updated_at for online-player tracking.
 * MySQL does not support "ADD COLUMN IF NOT EXISTS" on many versions —
 * so we check information_schema first.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
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
    const dbName = process.env.DB_NAME;
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'updated_at'`,
      [dbName]
    );

    if (cols.length > 0) {
      console.log('Migration 007: sessions.updated_at already exists — skip');
    } else {
      await conn.execute(`
        ALTER TABLE sessions
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      console.log('Migration 007 completed — added sessions.updated_at');
    }
    process.exit(0);
  } catch (err) {
    // Duplicate column name = already migrated
    if (err.message && (err.message.includes('Duplicate column') || err.code === 'ER_DUP_FIELDNAME')) {
      console.log('Migration 007: already migrated');
      process.exit(0);
    }
    console.error('Migration 007 failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
