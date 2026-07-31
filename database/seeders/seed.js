require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  let conn;
  try {
    conn = await pool.getConnection();

    // Roles
    await conn.execute(`INSERT IGNORE INTO roles (name, permissions) VALUES
      ('player', '["play","deposit","withdraw"]'),
      ('admin', '["play","deposit","withdraw","manage_players","manage_games","manage_promotions","view_reports"]'),
      ('superadmin', '["all"]')`);

    // Admin user
    const hash = await bcrypt.hash('admin123', 12);
    const [adminResult] = await conn.execute(
      `INSERT IGNORE INTO users (id, username, email, password_hash, role_id, kyc_status)
       VALUES (UUID(), 'admin', 'admin@casino.com', ?, 3, 'verified')`, [hash]
    );
    const [adminRow] = await conn.execute(`SELECT id FROM users WHERE email = 'admin@casino.com'`);
    if (adminRow[0]) {
      await conn.execute(`INSERT IGNORE INTO wallets (id, user_id, balance) VALUES (UUID(), ?, 100000)`, [adminRow[0].id]);
    }

    // Demo player
    const playerHash = await bcrypt.hash('player123', 12);
    await conn.execute(
      `INSERT IGNORE INTO users (id, username, email, password_hash, role_id)
       VALUES (UUID(), 'player1', 'player@casino.com', ?, 1)`, [playerHash]
    );
    const [playerRow] = await conn.execute(`SELECT id FROM users WHERE email = 'player@casino.com'`);
    if (playerRow[0]) {
      await conn.execute(`INSERT IGNORE INTO wallets (id, user_id, balance) VALUES (UUID(), ?, 5000)`, [playerRow[0].id]);
    }

    // Games
    const games = [
      ['Lucky Sevens', 'lucky-sevens', 96.00, 1, 10000],
      ['Golden Dragon', 'golden-dragon', 95.50, 5, 50000],
      ['Fruit Frenzy', 'fruit-frenzy', 97.00, 1, 5000],
      ['Diamond Rush', 'diamond-rush', 94.50, 10, 100000],
      ['Mega Fortune', 'mega-fortune', 96.50, 5, 25000],
      ['Wild West', 'wild-west', 95.00, 2, 20000],
    ];
    for (const [name, slug, rtp, min_bet, max_bet] of games) {
      await conn.execute(
        `INSERT IGNORE INTO games (id, name, slug, type, rtp, min_bet, max_bet, config)
         VALUES (UUID(), ?, ?, 'slot', ?, ?, ?, '{}')`,
        [name, slug, rtp, min_bet, max_bet]
      );
    }

    // Jackpots
    const [gameRows] = await conn.execute(`SELECT id, name FROM games LIMIT 3`);
    for (const game of gameRows) {
      await conn.execute(
        `INSERT INTO jackpots (id, game_id, name, current_amount, seed_amount) VALUES (UUID(), ?, ?, ?, 10000)`,
        [game.id, `${game.name} Jackpot`, 10000 + Math.random() * 50000]
      );
    }

    // Promotions
    await conn.execute(`INSERT IGNORE INTO promotions (id, name, type, description, config) VALUES
      (UUID(), 'Welcome Bonus', 'deposit_bonus', '100% match on first deposit up to ₱5,000', '{"match_percent":100,"max_bonus":5000}'),
      (UUID(), 'Weekend Cashback', 'cashback', '10% cashback on weekend losses', '{"percent":10}'),
      (UUID(), 'VIP Free Spins', 'free_spins', '50 free spins for VIP 3+ players', '{"spins":50,"min_vip":3}')`);

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

seed();
