/**
 * Add cockfighting games + default admin controls (safe to re-run).
 * Usage: node database/seeders/seed-cockfight.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const GAMES = [
  { name: 'Sabong Arena', slug: 'sabong-arena', type: 'cockfight', rtp: 92, min_bet: 20, max_bet: 20000 },
  { name: 'Cockfight Classic', slug: 'cockfight-classic', type: 'cockfight', rtp: 92, min_bet: 10, max_bet: 10000 },
  { name: 'Meron Wala Live', slug: 'meron-wala-live', type: 'cockfight', rtp: 92, min_bet: 50, max_bet: 50000 },
];

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  for (const g of GAMES) {
    const [rows] = await pool.query('SELECT id FROM games WHERE slug = ?', [g.slug]);
    let gameId;
    if (rows[0]) {
      gameId = rows[0].id;
      await pool.query(
        'UPDATE games SET name=?, type=?, rtp=?, min_bet=?, max_bet=?, status=? WHERE id=?',
        [g.name, g.type, g.rtp, g.min_bet, g.max_bet, 'active', gameId]
      );
      console.log('updated', g.slug);
    } else {
      gameId = require('crypto').randomUUID();
      await pool.query(
        'INSERT INTO games (id, name, slug, type, rtp, min_bet, max_bet, status) VALUES (?,?,?,?,?,?,?,?)',
        [gameId, g.name, g.slug, g.type, g.rtp, g.min_bet, g.max_bet, 'active']
      );
      console.log('inserted', g.slug);
    }
    // default controls — 30% player win rate
    const [c] = await pool.query('SELECT id FROM game_controls WHERE game_id = ?', [gameId]);
    if (!c[0]) {
      await pool.query(
        'INSERT INTO game_controls (id, game_id, win_rate, force_outcome, min_payout, max_payout, payout_cap, dry_run) VALUES (UUID(), ?, 30, NULL, 0, 30, 0, 0)',
        [gameId]
      );
      console.log('  controls created win_rate=30');
    }
  }
  await pool.end();
  console.log('Done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
