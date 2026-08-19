module.exports = async () => {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'casino',
    password: process.env.DB_PASSWORD || 'your_password_here',
    database: process.env.DB_NAME || 'casino_platform'
  });

  try {
    // Add multiplier column to game_controls if not exists
    await connection.query(`
      ALTER TABLE game_controls 
      ADD COLUMN IF NOT EXISTS wild_multiplier DECIMAL(5,2) DEFAULT 2.00
    `);
    
    console.log('✓ Added wild_multiplier column to game_controls');
    
    // Set default multiplier for existing games
    await connection.query(`
      UPDATE game_controls SET wild_multiplier = 2.00 WHERE wild_multiplier IS NULL
    `);
    
    console.log('✓ Set default wild_multiplier to 2.00');
    
  } catch (err) {
    if (err.code === 'ER_DUP_FIELD_NAME') {
      console.log('✓ wild_multiplier column already exists');
    } else {
      throw err;
    }
  } finally {
    await connection.end();
  }
};

if (require.main === module) {
  require('dotenv').config({ path: '../backend/.env' });
  module.exports().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
