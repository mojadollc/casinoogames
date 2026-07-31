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

async function migrate() {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log('Running game controls migration...');
    
    // 1. Add player_class column to users
    try {
      await conn.execute("ALTER TABLE users ADD COLUMN player_class VARCHAR(20) DEFAULT 'normal'");
      console.log('✓ Added player_class to users');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ player_class column already exists');
      } else {
        console.log('  player_class:', e.message);
      }
    }
    
    // 2. Add forced_outcome column to game_rounds
    try {
      await conn.execute("ALTER TABLE game_rounds ADD COLUMN forced_outcome VARCHAR(30)");
      console.log('✓ Added forced_outcome to game_rounds');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ forced_outcome column already exists');
      } else {
        console.log('  forced_outcome:', e.message);
      }
    }
    
    // 3. Add player_class column to game_rounds
    try {
      await conn.execute("ALTER TABLE game_rounds ADD COLUMN player_class VARCHAR(20)");
      console.log('✓ Added player_class to game_rounds');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ player_class column already exists in game_rounds');
      } else {
        console.log('  game_rounds player_class:', e.message);
      }
    }
    
    // 4. Create forced_outcomes table
    try {
      await conn.execute(`
        CREATE TABLE forced_outcomes (
          id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id CHAR(36),
          game_id CHAR(36),
          outcome VARCHAR(20) NOT NULL,
          used TINYINT(1) DEFAULT 0,
          used_at TIMESTAMP NULL,
          created_by CHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (game_id) REFERENCES games(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      console.log('✓ Created forced_outcomes table');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ forced_outcomes table already exists');
      } else {
        console.log('  forced_outcomes table:', e.message);
      }
    }
    
    // 5. Create game_controls table
    try {
      await conn.execute(`
        CREATE TABLE game_controls (
          id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
          game_id CHAR(36) UNIQUE,
          win_rate DECIMAL(5,2) DEFAULT 35.00,
          force_outcome VARCHAR(20),
          min_payout DECIMAL(10,2) DEFAULT 0,
          max_payout DECIMAL(10,2) DEFAULT 100,
          payout_cap DECIMAL(15,2) DEFAULT 0,
          dry_run TINYINT(1) DEFAULT 0,
          updated_by CHAR(36),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `);
      console.log('✓ Created game_controls table');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ game_controls table already exists');
      } else {
        console.log('  game_controls table:', e.message);
      }
    }
    
    // 6. Add indexes
    try {
      await conn.execute("CREATE INDEX idx_forced_user ON forced_outcomes(user_id)");
      console.log('✓ Added idx_forced_user index');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ idx_forced_user index already exists');
      }
    }
    
    try {
      await conn.execute("CREATE INDEX idx_forced_game ON forced_outcomes(game_id)");
      console.log('✓ Added idx_forced_game index');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ idx_forced_game index already exists');
      }
    }
    
    try {
      await conn.execute("CREATE INDEX idx_gc_game ON game_controls(game_id)");
      console.log('✓ Added idx_gc_game index');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('✓ idx_gc_game index already exists');
      }
    }
    
    // 7. Insert default controls for existing games
    try {
      const [games] = await conn.execute("SELECT id FROM games");
      for (const game of games) {
        try {
          await conn.execute(
            "INSERT IGNORE INTO game_controls (id, game_id, win_rate) VALUES (UUID(), ?, 35.00)",
            [game.id]
          );
        } catch (e) {
          // Ignore duplicate errors
        }
      }
      console.log('✓ Added default game controls for existing games');
    } catch (e) {
      console.log('  default controls:', e.message);
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
