require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const genCode = () => Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    const [users] = await conn.execute('SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ""');
    for (const user of users) {
      let code;
      do {
        code = genCode();
        const [existing] = await conn.execute('SELECT id FROM users WHERE referral_code = ?', [code]);
        if (!existing.length) break;
      } while (true);
      await conn.execute('UPDATE users SET referral_code = ? WHERE id = ?', [code, user.id]);
    }
    console.log(`Migration 006: backfilled referral codes for ${users.length} users`);
    process.exit(0);
  } catch (err) {
    console.error('Migration 006 failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
