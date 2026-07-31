require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});

const migration = `
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role_id INT DEFAULT 1,
  vip_level INT DEFAULT 0,
  kyc_status VARCHAR(20) DEFAULT 'pending',
  status VARCHAR(20) DEFAULT 'active',
  two_factor_secret VARCHAR(255),
  two_factor_enabled TINYINT(1) DEFAULT 0,
  responsible_gaming JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  token TEXT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) UNIQUE,
  balance DECIMAL(15,2) DEFAULT 0.00,
  bonus_balance DECIMAL(15,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'PHP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  wallet_id CHAR(36),
  user_id CHAR(36),
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2),
  balance_after DECIMAL(15,2),
  reference_id VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  provider VARCHAR(50) DEFAULT 'xendit',
  provider_ref VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSON,
  webhook_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50),
  provider_ref VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  bank_code VARCHAR(20),
  account_number VARCHAR(50),
  account_name VARCHAR(100),
  provider_ref VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  approved_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS games (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) DEFAULT 'slot',
  status VARCHAR(20) DEFAULT 'active',
  config JSON,
  rtp DECIMAL(5,2) DEFAULT 96.00,
  min_bet DECIMAL(10,2) DEFAULT 1.00,
  max_bet DECIMAL(10,2) DEFAULT 10000.00,
  version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id CHAR(36),
  version VARCHAR(20) NOT NULL,
  config JSON NOT NULL,
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  game_id CHAR(36),
  user_id CHAR(36),
  bet_amount DECIMAL(15,2) NOT NULL,
  win_amount DECIMAL(15,2) DEFAULT 0,
  result JSON NOT NULL,
  rng_seed VARCHAR(255),
  is_free_spin TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  round_id CHAR(36),
  user_id CHAR(36),
  game_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'placed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS wins (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  round_id CHAR(36),
  user_id CHAR(36),
  game_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS jackpots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  game_id CHAR(36),
  name VARCHAR(100) NOT NULL,
  current_amount DECIMAL(15,2) DEFAULT 0,
  seed_amount DECIMAL(15,2) DEFAULT 1000,
  contribution_rate DECIMAL(5,4) DEFAULT 0.01,
  won_by CHAR(36),
  won_at TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  config JSON,
  start_date TIMESTAMP NULL,
  end_date TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'active',
  max_claims INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_rewards (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  promotion_id CHAR(36),
  user_id CHAR(36),
  amount DECIMAL(15,2),
  type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'claimed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS free_spins (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  game_id CHAR(36),
  promotion_id CHAR(36),
  total_spins INT NOT NULL,
  used_spins INT DEFAULT 0,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  start_date TIMESTAMP NULL,
  end_date TIMESTAMP NULL,
  prizes JSON,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  message TEXT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50),
  entity_id VARCHAR(255),
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wt_user ON wallet_transactions(user_id);
CREATE INDEX idx_gr_user ON game_rounds(user_id);
CREATE INDEX idx_gr_game ON game_rounds(game_id);
CREATE INDEX idx_pt_user ON payment_transactions(user_id);
CREATE INDEX idx_notif_user ON notifications(user_id);
`;

async function migrate() {
  let conn;
  try {
    conn = await pool.getConnection();
    // Run each statement separately to avoid multipleStatements issues
    const statements = migration.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await conn.execute(stmt);
    }
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
