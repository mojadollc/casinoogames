// Seed games for CasinoPlus-style platform
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const GAMES = [
  // Slots
  { name: 'Fortune Tiger',      slug: 'fortune-tiger',      type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Fortune Ox',         slug: 'fortune-ox',         type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Fortune Mouse',      slug: 'fortune-mouse',      type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Gates of Olympus',   slug: 'gates-of-olympus',   type: 'slots', rtp: 92.00, min_bet: 5,   max_bet: 5000  },
  { name: 'Starlight Princess', slug: 'starlight-princess', type: 'slots', rtp: 92.00, min_bet: 5,   max_bet: 5000  },
  { name: 'Sweet Bonanza',      slug: 'sweet-bonanza',      type: 'slots', rtp: 92.00, min_bet: 5,   max_bet: 5000  },
  { name: 'Wild Bandito',       slug: 'wild-bandito',       type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Mahjong Ways',       slug: 'mahjong-ways',       type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Mahjong Ways 2',     slug: 'mahjong-ways-2',     type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Dragon Legend',      slug: 'dragon-legend',      type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Lucky Neko',         slug: 'lucky-neko',         type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Bali Vacation',      slug: 'bali-vacation',      type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Caishen Wins',       slug: 'caishen-wins',       type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Double Fortune',     slug: 'double-fortune',     type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },
  { name: 'Gem Saviour',        slug: 'gem-saviour',        type: 'slots', rtp: 92.00, min_bet: 1,   max_bet: 2000  },

  // Live Casino
  { name: 'Dragon Tiger',       slug: 'dragon-tiger',       type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Speed Baccarat',     slug: 'speed-baccarat',     type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Baccarat',           slug: 'baccarat',           type: 'live',  rtp: 92.00, min_bet: 100, max_bet: 20000 },
  { name: 'Monopoly Live',      slug: 'monopoly-live',      type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Crazy Time',         slug: 'crazy-time',         type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Lightning Roulette', slug: 'lightning-roulette', type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Dream Catcher',      slug: 'dream-catcher',      type: 'live',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },

  // Card Games
  { name: 'Blackjack VIP',      slug: 'blackjack-vip',      type: 'card',  rtp: 92.00, min_bet: 100, max_bet: 10000 },
  { name: 'Texas Holdem',       slug: 'texas-holdem',       type: 'card',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Teen Patti',         slug: 'teen-patti',         type: 'card',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Andar Bahar',        slug: 'andar-bahar',        type: 'card',  rtp: 92.00, min_bet: 50,  max_bet: 10000 },
  { name: 'Sic Bo',             slug: 'sic-bo',             type: 'card',  rtp: 92.00, min_bet: 10,  max_bet: 5000  },

  // Fishing Games
  { name: 'Fishing God',        slug: 'fishing-god',        type: 'fishing', rtp: 92.00, min_bet: 1, max_bet: 500   },
  { name: 'Ocean King',         slug: 'ocean-king',         type: 'fishing', rtp: 92.00, min_bet: 1, max_bet: 500   },
  { name: 'Golden Dragon',      slug: 'golden-dragon',      type: 'fishing', rtp: 92.00, min_bet: 1, max_bet: 500   },
  { name: 'Fish Hunter',        slug: 'fish-hunter',        type: 'fishing', rtp: 92.00, min_bet: 1, max_bet: 500   },

  // Cockfighting / Sabong
  { name: 'Sabong Arena',       slug: 'sabong-arena',       type: 'cockfight', rtp: 92.00, min_bet: 20,  max_bet: 20000 },
  { name: 'Cockfight Classic',  slug: 'cockfight-classic',  type: 'cockfight', rtp: 92.00, min_bet: 10,  max_bet: 10000 },
  { name: 'Meron Wala Live',    slug: 'meron-wala-live',    type: 'cockfight', rtp: 92.00, min_bet: 50,  max_bet: 50000 },

  // Table Games
  { name: 'European Roulette',  slug: 'european-roulette',  type: 'table', rtp: 92.00, min_bet: 10,  max_bet: 5000  },
  { name: 'American Roulette',  slug: 'american-roulette',  type: 'table', rtp: 92.00, min_bet: 10,  max_bet: 5000  },
  { name: 'Craps',              slug: 'craps',              type: 'table', rtp: 92.00, min_bet: 10,  max_bet: 5000  },

  // Original Slot
  { name: 'Dragon Fortune',     slug: 'dragon-fortune',     type: 'slot',  rtp: 92.00, min_bet: 1,   max_bet: 2000  },
];

async function seed() {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log('🎰 Seeding games...');
    
    for (const game of GAMES) {
      try {
        await conn.execute(
          `INSERT INTO games (id, name, slug, type, status, rtp, min_bet, max_bet, version, config, created_at)
           VALUES (UUID(), ?, ?, ?, 'active', ?, ?, ?, '1.0', ?, NOW())
           ON DUPLICATE KEY UPDATE name = VALUES(name), rtp = VALUES(rtp)`,
          [
            game.name,
            game.slug,
            game.type,
            game.rtp,
            game.min_bet,
            game.max_bet,
            JSON.stringify({
              reels: 5,
              rows: 3,
              jackpot_enabled: game.type === 'slots'
            })
          ]
        );
        console.log(`✓ ${game.name}`);
      } catch (e) {
        console.log(`  ${game.name}: ${e.message}`);
      }
    }
    
    // Create jackpots for slot games
    const [slots] = await conn.execute("SELECT id FROM games WHERE type = 'slots'");
    for (const slot of slots) {
      try {
        await conn.execute(
          `INSERT IGNORE INTO jackpots (id, game_id, name, current_amount, seed_amount, contribution_rate, status)
           VALUES (UUID(), ?, 'Progressive Jackpot', 10000.00, 5000.00, 0.0100, 'active')`,
          [slot.id]
        );
      } catch (e) {}
    }
    
    console.log('\n✅ Games seeded successfully!');
    console.log(`📊 Total games: ${GAMES.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

seed();
