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
  let conn;
  try {
    conn = await pool.getConnection();
    // Reset all existing game controls to safe house-edge defaults
    await conn.execute(`
      UPDATE game_controls
      SET win_rate = 25,
          max_payout = 30,
          min_payout = 0,
          payout_cap = 0,
          force_outcome = NULL,
          updated_at = NOW()
    `);
    // Reset RTP on all games to 92%
    await conn.execute(`UPDATE games SET rtp = 92.00`);
    // Cap max_bet on all games to safe limits
    await conn.execute(`UPDATE games SET max_bet = 2000  WHERE type IN ('slots','slot') AND max_bet > 2000`);
    await conn.execute(`UPDATE games SET max_bet = 10000 WHERE type IN ('live','card') AND max_bet > 10000`);
    await conn.execute(`UPDATE games SET max_bet = 500   WHERE type = 'fishing' AND max_bet > 500`);
    await conn.execute(`UPDATE games SET max_bet = 5000  WHERE type = 'table' AND max_bet > 5000`);
    // Cap max_bet on baccarat specifically
    await conn.execute(`UPDATE games SET max_bet = 20000 WHERE slug = 'baccarat' AND max_bet > 20000`);
    console.log('Migration 005 completed — game controls reset to house-edge defaults');
    process.exit(0);
  } catch (err) {
    console.error('Migration 005 failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
