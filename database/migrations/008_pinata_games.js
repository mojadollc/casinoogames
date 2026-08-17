require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.production') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const PINATA_GAMES = [
  {
    name: 'Piñata Wins',
    slug: 'pinata-wins',
    rtp: 96.71,
    min_bet: 5,
    max_bet: 50000,
    config: {
      reels: 5, rows: 3, paylines: 20,
      cascading: true,
      cascadeMultipliers: [1, 2, 3, 5],
      freeSpins: { trigger: 'scatter', minCount: 3, spins: { 3: 10, 4: 15, 5: 20 }, multiplier: 2 },
      symbols: [
        { id: 'wild',     name: 'Wild',          weight: 2,  isWild: true,    payout: { 3: 0, 4: 5,  5: 10 } },
        { id: 'scatter',  name: 'Scatter',        weight: 3,  isScatter: true, payout: { 3: 2, 4: 5,  5: 20 } },
        { id: 'gold',     name: 'Gold Frame',     weight: 4,  multiplier: true,payout: { 3: 4, 4: 10, 5: 25 } },
        { id: 'pinata_r', name: 'Red Piñata',     weight: 6,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_b', name: 'Blue Piñata',    weight: 6,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_g', name: 'Green Piñata',   weight: 7,  payout: { 3: 2, 4: 6,  5: 15 } },
        { id: 'star',     name: 'Star',           weight: 8,  payout: { 3: 2, 4: 5,  5: 12 } },
        { id: 'bell',     name: 'Bell',           weight: 9,  payout: { 3: 1, 4: 4,  5: 10 } },
        { id: 'candy_r',  name: 'Red Candy',      weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_b',  name: 'Blue Candy',     weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_y',  name: 'Yellow Candy',   weight: 14, payout: { 3: 1, 4: 2,  5: 6  } },
      ],
    },
  },
  {
    name: 'Piñatas & Ponies',
    slug: 'pinatas-ponies',
    rtp: 96.10,
    min_bet: 5,
    max_bet: 50000,
    config: {
      reels: 6, rows: 6, paylines: 0,
      scatterPays: true,
      minMatchCount: 10,
      freeSpins: { trigger: 'scatter', minCount: 4, spins: { 4: 8, 5: 12, 6: 15 }, multiplier: 1 },
      symbols: [
        { id: 'wild',     name: 'Wild',          weight: 2,  isWild: true,    payout: { 10: 5,  12: 10, 15: 20, 20: 50,  36: 100 } },
        { id: 'scatter',  name: 'Bonus',          weight: 3,  isScatter: true, payout: { 10: 2,  12: 5,  15: 10, 20: 20,  36: 50  } },
        { id: 'pony_g',   name: 'Gold Pony',      weight: 4,  payout: { 10: 3,  12: 8,  15: 15, 20: 30,  36: 75  } },
        { id: 'pony_r',   name: 'Red Pony',       weight: 5,  payout: { 10: 2,  12: 6,  15: 12, 20: 25,  36: 60  } },
        { id: 'pinata_r', name: 'Red Piñata',     weight: 6,  payout: { 10: 2,  12: 5,  15: 10, 20: 20,  36: 50  } },
        { id: 'pinata_b', name: 'Blue Piñata',    weight: 6,  payout: { 10: 2,  12: 5,  15: 10, 20: 20,  36: 50  } },
        { id: 'pinata_g', name: 'Green Piñata',   weight: 7,  payout: { 10: 1,  12: 4,  15: 8,  20: 15,  36: 40  } },
        { id: 'candy_r',  name: 'Red Candy',      weight: 10, payout: { 10: 1,  12: 3,  15: 6,  20: 12,  36: 30  } },
        { id: 'candy_b',  name: 'Blue Candy',     weight: 10, payout: { 10: 1,  12: 3,  15: 6,  20: 12,  36: 30  } },
        { id: 'candy_y',  name: 'Yellow Candy',   weight: 12, payout: { 10: 1,  12: 2,  15: 5,  20: 10,  36: 25  } },
        { id: 'flower',   name: 'Flower',         weight: 14, payout: { 10: 1,  12: 2,  15: 4,  20: 8,   36: 20  } },
      ],
    },
  },
  {
    name: 'Pick A Piñata',
    slug: 'pick-a-pinata',
    rtp: 96.30,
    min_bet: 5,
    max_bet: 50000,
    config: {
      reels: 5, rows: 3, paylines: 25,
      freeSpins: { trigger: 'scatter', minCount: 3, spins: { 3: 8, 4: 12, 5: 20 }, multiplier: 1 },
      bonusGame: {
        trigger: 'scatter', minCount: 3, type: 'pick',
        picks: 3, multipliers: [2, 3, 5, 8, 10, 15, 20, 25, 50],
      },
      symbols: [
        { id: 'wild',     name: 'Wild',            weight: 2,  isWild: true,    payout: { 3: 0, 4: 5,  5: 10 } },
        { id: 'scatter',  name: 'Piñata Scatter',  weight: 3,  isScatter: true, payout: { 3: 2, 4: 5,  5: 20 } },
        { id: 'pinata_g', name: 'Gold Piñata',     weight: 4,  payout: { 3: 4, 4: 10, 5: 25 } },
        { id: 'pinata_r', name: 'Red Piñata',      weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_b', name: 'Blue Piñata',     weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'sombrero', name: 'Sombrero',        weight: 7,  payout: { 3: 2, 4: 6,  5: 15 } },
        { id: 'guitar',   name: 'Guitar',          weight: 8,  payout: { 3: 2, 4: 5,  5: 12 } },
        { id: 'maracas',  name: 'Maracas',         weight: 9,  payout: { 3: 1, 4: 4,  5: 10 } },
        { id: 'candy_r',  name: 'Red Candy',       weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_b',  name: 'Blue Candy',      weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_y',  name: 'Yellow Candy',    weight: 14, payout: { 3: 1, 4: 2,  5: 6  } },
      ],
    },
  },
  {
    name: 'Spinata Piñata',
    slug: 'spinata-pinata',
    rtp: 96.00,
    min_bet: 5,
    max_bet: 50000,
    config: {
      reels: 5, rows: 3, paylines: 20,
      expandingWilds: true,
      freeSpins: { trigger: 'scatter', minCount: 3, spins: { 3: 10, 4: 15, 5: 20 }, multiplier: 3 },
      symbols: [
        { id: 'wild',     name: 'Piñata Wild',    weight: 3,  isWild: true, expandingWild: true, payout: { 3: 0, 4: 5,  5: 10 } },
        { id: 'scatter',  name: 'Scatter',         weight: 3,  isScatter: true, payout: { 3: 2, 4: 5,  5: 20 } },
        { id: 'pinata_g', name: 'Gold Piñata',     weight: 4,  payout: { 3: 4, 4: 10, 5: 25 } },
        { id: 'pinata_r', name: 'Red Piñata',      weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_b', name: 'Blue Piñata',     weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_p', name: 'Purple Piñata',   weight: 6,  payout: { 3: 2, 4: 6,  5: 15 } },
        { id: 'star',     name: 'Star',            weight: 8,  payout: { 3: 2, 4: 5,  5: 12 } },
        { id: 'bell',     name: 'Bell',            weight: 9,  payout: { 3: 1, 4: 4,  5: 10 } },
        { id: 'candy_r',  name: 'Red Candy',       weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_b',  name: 'Blue Candy',      weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_y',  name: 'Yellow Candy',    weight: 14, payout: { 3: 1, 4: 2,  5: 6  } },
      ],
    },
  },
  {
    name: 'Calle Piñata',
    slug: 'calle-pinata',
    rtp: 96.45,
    min_bet: 5,
    max_bet: 50000,
    config: {
      reels: 5, rows: 3, paylines: 20,
      multipleScatterTypes: true,
      freeSpins: {
        trigger: 'scatter_fs', minCount: 3,
        spins: { 3: 10, 4: 15, 5: 20 }, multiplier: 2, retrigger: true,
      },
      bonusScatter: { trigger: 'scatter_b', minCount: 3, type: 'multiplier_pick' },
      symbols: [
        { id: 'wild',       name: 'Wild',              weight: 2,  isWild: true,    payout: { 3: 0, 4: 5,  5: 10 } },
        { id: 'scatter_fs', name: 'Free Spin Scatter', weight: 3,  isScatter: true, payout: { 3: 2, 4: 5,  5: 20 } },
        { id: 'scatter_b',  name: 'Bonus Scatter',     weight: 3,  isScatter: true, payout: { 3: 2, 4: 5,  5: 15 } },
        { id: 'pinata_g',   name: 'Gold Piñata',       weight: 4,  payout: { 3: 4, 4: 10, 5: 25 } },
        { id: 'pinata_r',   name: 'Red Piñata',        weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'pinata_b',   name: 'Blue Piñata',       weight: 5,  payout: { 3: 3, 4: 8,  5: 20 } },
        { id: 'mariachi',   name: 'Mariachi',          weight: 7,  payout: { 3: 2, 4: 6,  5: 15 } },
        { id: 'cactus',     name: 'Cactus',            weight: 8,  payout: { 3: 2, 4: 5,  5: 12 } },
        { id: 'taco',       name: 'Taco',              weight: 9,  payout: { 3: 1, 4: 4,  5: 10 } },
        { id: 'candy_r',    name: 'Red Candy',         weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_b',    name: 'Blue Candy',        weight: 12, payout: { 3: 1, 4: 3,  5: 8  } },
        { id: 'candy_y',    name: 'Yellow Candy',      weight: 14, payout: { 3: 1, 4: 2,  5: 6  } },
      ],
    },
  },
];

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    for (const g of PINATA_GAMES) {
      await conn.execute(
        `INSERT IGNORE INTO games (id, name, slug, type, rtp, min_bet, max_bet, config, status)
         VALUES (UUID(), ?, ?, 'slot', ?, ?, ?, ?, 'active')`,
        [g.name, g.slug, g.rtp, g.min_bet, g.max_bet, JSON.stringify(g.config)]
      );

      const [rows] = await conn.execute(`SELECT id FROM games WHERE slug = ?`, [g.slug]);
      if (rows[0]) {
        await conn.execute(
          `INSERT IGNORE INTO game_controls (id, game_id, win_rate, force_outcome)
           VALUES (UUID(), ?, 25, NULL)`,
          [rows[0].id]
        );
        await conn.execute(
          `INSERT IGNORE INTO jackpots (id, game_id, name, current_amount, seed_amount, contribution_rate, status)
           VALUES (UUID(), ?, ?, ?, 10000, 0.01, 'active')`,
          [rows[0].id, `${g.name} Jackpot`, 10000 + Math.floor(Math.random() * 40000)]
        );
      }
      console.log(`✅  ${g.name} (${g.slug})`);
    }

    console.log('\n🎉 Migration 008 complete — 5 Piñata games added with game_controls + jackpots');
    process.exit(0);
  } catch (err) {
    console.error('Migration 008 failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

run();
