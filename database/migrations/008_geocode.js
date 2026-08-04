require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const statements = [
  'ALTER TABLE users ADD COLUMN latitude DECIMAL(10, 7) NULL',
  'ALTER TABLE users ADD COLUMN longitude DECIMAL(10, 7) NULL',
  'ALTER TABLE users ADD COLUMN geocoded_address VARCHAR(500) NULL',
];

async function migrate() {
  let conn;
  try {
    conn = await pool.getConnection();
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (e) {
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }
    console.log('Migration 008 (geocode) completed');
    process.exit(0);
  } catch (err) {
    console.error('Migration 008 failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
