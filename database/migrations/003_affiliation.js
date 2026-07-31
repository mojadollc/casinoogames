require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const migration = `
ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN referred_by CHAR(36);
`;

const affiliationsTable = `
CREATE TABLE IF NOT EXISTS affiliations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  referrer_id CHAR(36) NOT NULL,
  referee_id CHAR(36) NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'registered',
  has_deposited TINYINT(1) DEFAULT 0,
  total_deposited DECIMAL(15,2) DEFAULT 0.00,
  commission_earned DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id),
  UNIQUE KEY unique_referee (referee_id)
);
`;

async function migrate() {
  let conn;
  try {
    conn = await pool.getConnection();
    // Add columns one by one, ignore duplicate column errors (already exists)
    const alters = migration.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of alters) {
      try { await conn.query(stmt); } catch (e) {
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) throw e;
      }
    }
    // Create affiliations table
    await conn.query(affiliationsTable);
    // Add indexes, ignore if already exist
    const indexes = [
      'CREATE INDEX idx_affiliation_referrer ON affiliations(referrer_id)',
      'CREATE INDEX idx_affiliation_referee ON affiliations(referee_id)',
    ];
    for (const idx of indexes) {
      try { await conn.query(idx); } catch {}
    }
    // Add FK for referred_by if not exists
    try {
      await conn.query('ALTER TABLE users ADD CONSTRAINT fk_referred_by FOREIGN KEY (referred_by) REFERENCES users(id)');
    } catch {}
    console.log('Affiliation migration completed');
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
