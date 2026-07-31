const express = require('express');
const { query, pool } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');
const { debitWallet, creditWallet } = require('../wallet/routes');
const { GameEngine } = require('../../game-engine/engine');

const router = express.Router();

// In-memory cache with TTL (60s) — ensures settings sync within 1 minute
const gameControlsCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

// Load controls from DB, fallback to defaults
async function getGameControls(gameId) {
  const cached = gameControlsCache.get(gameId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const result = await query('SELECT * FROM game_controls WHERE game_id = ?', [gameId]);
  let controls;
  if (result.rows[0]) {
    controls = {
      win_rate: parseFloat(result.rows[0].win_rate),
      force_outcome: result.rows[0].force_outcome || null,
      min_payout: parseFloat(result.rows[0].min_payout),
      max_payout: parseFloat(result.rows[0].max_payout),
      payout_cap: parseFloat(result.rows[0].payout_cap),
      dry_run: !!result.rows[0].dry_run,
      player_class_overrides: new Map()
    };
  } else {
    controls = { win_rate: 25, force_outcome: null, min_payout: 0, max_payout: 30, payout_cap: 0, dry_run: false, player_class_overrides: new Map() };
    // Insert defaults
    await query('INSERT IGNORE INTO game_controls (id, game_id, win_rate) VALUES (UUID(), ?, 25)', [gameId]);
  }
  gameControlsCache.set(gameId, { data: controls, ts: Date.now() });
  return controls;
}

// Persist controls to DB and immediately update cache
async function saveGameControls(gameId, updates, adminId) {
  const controls = await getGameControls(gameId);
  Object.assign(controls, updates);
  gameControlsCache.set(gameId, { data: controls, ts: Date.now() });

  await query(`
    INSERT INTO game_controls (id, game_id, win_rate, force_outcome, min_payout, max_payout, payout_cap, dry_run, updated_by)
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      win_rate = VALUES(win_rate),
      force_outcome = VALUES(force_outcome),
      min_payout = VALUES(min_payout),
      max_payout = VALUES(max_payout),
      payout_cap = VALUES(payout_cap),
      dry_run = VALUES(dry_run),
      updated_by = VALUES(updated_by),
      updated_at = NOW()
  `, [gameId, controls.win_rate, controls.force_outcome || null, controls.min_payout, controls.max_payout, controls.payout_cap, controls.dry_run ? 1 : 0, adminId || null]);

  return controls;
}

// Get jackpot totals (public — used by home page)
router.get('/jackpots/total', async (req, res) => {
  try {
    const result = await query("SELECT COALESCE(SUM(current_amount), 0) as total FROM jackpots WHERE status = 'active'");
    res.json({ total: parseFloat(result.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available games
router.get('/', async (req, res) => {
  const result = await query("SELECT id, name, slug, type, rtp, min_bet, max_bet, config FROM games WHERE status = 'active'");
  res.json(result.rows);
});

// Get game details
router.get('/:slug', authenticate, async (req, res) => {
  const result = await query("SELECT * FROM games WHERE slug = ? AND status = 'active'", [req.params.slug]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Game not found' });
  res.json(result.rows[0]);
});

// Spin
router.post('/:gameId/spin', authenticate, async (req, res) => {
  const { betAmount } = req.body;
  const { gameId } = req.params;

  try {
    const game = await query("SELECT * FROM games WHERE id = ? AND status = 'active'", [gameId]);
    if (!game.rows[0]) return res.status(404).json({ error: 'Game not found' });

    const g = game.rows[0];
    if (betAmount < g.min_bet || betAmount > g.max_bet) {
      return res.status(400).json({ error: `Bet must be between ${g.min_bet} and ${g.max_bet}` });
    }

    // Check responsible gaming limits
    const user = await query('SELECT responsible_gaming, player_class FROM users WHERE id = ?', [req.user.id]);
    const limits = user.rows[0]?.responsible_gaming;
    if (limits?.daily_limit) {
      const today = await query(
        "SELECT COALESCE(SUM(bet_amount), 0) as total FROM game_rounds WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)",
        [req.user.id]
      );
      if (parseFloat(today.rows[0].total) + betAmount > limits.daily_limit) {
        return res.status(400).json({ error: 'Daily betting limit reached' });
      }
    }

    // Session stats for RTP enforcement
    const sessionStats = await query(
      `SELECT COALESCE(SUM(bet_amount), 0) as total_bet, COALESCE(SUM(win_amount), 0) as total_win, COUNT(*) as spins
       FROM game_rounds WHERE user_id = ? AND game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [req.user.id, gameId]
    );
    const stats = sessionStats.rows[0];

    // Load controls from DB (TTL-cached)
    const controls = await getGameControls(gameId);
    // player_class comes from users table (persisted by /player-class endpoint)
    const playerClass = user.rows[0]?.player_class || 'normal';

    // Check forced outcome for this player
    const playerForces = await query(
      "SELECT * FROM forced_outcomes WHERE user_id = ? AND game_id = ? AND used = 0 ORDER BY created_at LIMIT 1",
      [req.user.id, gameId]
    );

    let forcedOutcome = controls.force_outcome;
    if (playerForces.rows[0]) forcedOutcome = playerForces.rows[0].outcome;

    const gameSettings = {
      win_rate: controls.win_rate,
      force_outcome: forcedOutcome,
      min_payout: controls.min_payout,
      max_payout: controls.max_payout,
      rtp: g.rtp,
      player_class: playerClass,
      dry_run: controls.dry_run,
      payout_cap: controls.payout_cap
    };

    if (!gameSettings.dry_run) {
      await debitWallet(req.user.id, betAmount, 'bet', `Bet on ${g.name}`, gameId);
    }

    const engine = new GameEngine(g.config?.symbols ? g.config : undefined, gameSettings);
    const result = engine.spin(betAmount, false, {
      totalBet: parseFloat(stats.total_bet),
      totalWin: parseFloat(stats.total_win),
      spins: parseInt(stats.spins)
    });

    // Jackpot
    const jackpot = await query("SELECT * FROM jackpots WHERE game_id = ? AND status = 'active'", [gameId]);
    let jackpotWin = 0;
    if (jackpot.rows[0]) {
      jackpotWin = engine.checkJackpot(parseFloat(jackpot.rows[0].current_amount));
      if (jackpotWin > 0) {
        result.totalWin += jackpotWin;
        result.jackpotWon = jackpotWin;
        await query('UPDATE jackpots SET current_amount = seed_amount, won_by = ?, won_at = NOW(), status = ? WHERE id = ?',
          [req.user.id, 'won', jackpot.rows[0].id]);
        await query('INSERT INTO jackpots (id, game_id, name, seed_amount, contribution_rate) VALUES (UUID(), ?, ?, ?, ?)',
          [gameId, jackpot.rows[0].name, jackpot.rows[0].seed_amount, jackpot.rows[0].contribution_rate]);
      } else {
        await query('UPDATE jackpots SET current_amount = current_amount + ? WHERE id = ?',
          [result.jackpotContribution, jackpot.rows[0].id]);
      }
    }

    // Mark forced outcome used
    if (playerForces.rows[0]) {
      await query('UPDATE forced_outcomes SET used = 1, used_at = NOW() WHERE id = ?', [playerForces.rows[0].id]);
    }

    if (result.totalWin > 0 && !gameSettings.dry_run) {
      await creditWallet(req.user.id, result.totalWin, 'win', `Win on ${g.name}`, gameId);
    }

    await query(
      'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed, player_class, forced_outcome) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [gameId, req.user.id, betAmount, result.totalWin, JSON.stringify(result), result.seed, playerClass, result.forcedOutcome || null]
    );

    if (!gameSettings.dry_run) {
      await query('INSERT INTO bets (id, user_id, game_id, amount, status) VALUES (UUID(),?,?,?,?)', [req.user.id, gameId, betAmount, 'settled']);
      if (result.totalWin > 0) {
        await query('INSERT INTO wins (id, user_id, game_id, amount, type) VALUES (UUID(),?,?,?,?)',
          [req.user.id, gameId, result.totalWin, jackpotWin > 0 ? 'jackpot' : 'regular']);
      }
    }

    if (result.freeSpinsAwarded > 0) {
      await query('INSERT INTO free_spins (id, user_id, game_id, total_spins, expires_at) VALUES (UUID(),?,?,?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
        [req.user.id, gameId, result.freeSpinsAwarded]);
    }

    const wallet = await query('SELECT balance, bonus_balance FROM wallets WHERE user_id = ?', [req.user.id]);
    res.json({ ...result, balance: wallet.rows[0].balance });
  } catch (err) {
    console.error('Spin error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Free spin
router.post('/:gameId/free-spin', authenticate, async (req, res) => {
  const { gameId } = req.params;
  try {
    const fs = await query(
      "SELECT * FROM free_spins WHERE user_id = ? AND game_id = ? AND used_spins < total_spins AND expires_at > NOW() ORDER BY created_at LIMIT 1",
      [req.user.id, gameId]
    );
    if (!fs.rows[0]) return res.status(400).json({ error: 'No free spins available' });

    const game = await query('SELECT * FROM games WHERE id = ?', [gameId]);
    const controls = await getGameControls(gameId);

    const gameSettings = {
      win_rate: controls.win_rate,
      force_outcome: controls.force_outcome,
      min_payout: controls.min_payout,
      max_payout: controls.max_payout,
      rtp: game.rows[0].rtp,
      player_class: 'normal',
      dry_run: false,
      payout_cap: controls.payout_cap
    };

    const engine = new GameEngine(game.rows[0].config?.symbols ? game.rows[0].config : undefined, gameSettings);
    const result = engine.spin(game.rows[0].min_bet, true);

    if (result.totalWin > 0) {
      await creditWallet(req.user.id, result.totalWin, 'free_spin_win', 'Free spin win', fs.rows[0].id);
    }

    await query('UPDATE free_spins SET used_spins = used_spins + 1 WHERE id = ?', [fs.rows[0].id]);
    await query('INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed, is_free_spin) VALUES (UUID(),?,?,?,?,?,?,1)',
      [gameId, req.user.id, 0, result.totalWin, JSON.stringify(result), result.seed]);

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    const remaining = fs.rows[0].total_spins - fs.rows[0].used_spins - 1;
    res.json({ ...result, balance: wallet.rows[0].balance, freeSpinsRemaining: remaining });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fishing shoot
router.post('/:gameId/fishing-shoot', authenticate, async (req, res) => {
  const { betAmount } = req.body;
  const { gameId } = req.params;
  try {
    const game = await query("SELECT * FROM games WHERE id = ? AND status = 'active'", [gameId]);
    if (!game.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const g = game.rows[0];
    if (betAmount < g.min_bet || betAmount > g.max_bet) {
      return res.status(400).json({ error: `Bet must be between ${g.min_bet} and ${g.max_bet}` });
    }

    const controls = await getGameControls(gameId);
    const rng = new (require('../../game-engine/engine').SecureRNG)();
    const FISH = [
      { name: 'Small Fish',  emoji: '🐟', weight: 35, multiplier: 1.2  },
      { name: 'Clownfish',   emoji: '🐠', weight: 25, multiplier: 1.5  },
      { name: 'Blowfish',    emoji: '🐡', weight: 15, multiplier: 2    },
      { name: 'Shark',       emoji: '🦈', weight: 8,  multiplier: 3    },
      { name: 'Octopus',     emoji: '🐙', weight: 6,  multiplier: 5    },
      { name: 'Whale',       emoji: '🐳', weight: 4,  multiplier: 8    },
      { name: 'Dragon Fish', emoji: '🐲', weight: 2,  multiplier: 15   },
      { name: 'Golden Fish', emoji: '✨', weight: 1,  multiplier: 30   },
    ];

    const winRoll = rng.generate(1, 100);
    const shouldHit = controls.force_outcome === 'win' ||
      (controls.force_outcome !== 'loss' && winRoll <= controls.win_rate);

    let fish = null, totalWin = 0, hit = false;
    if (shouldHit) {
      const totalWeight = FISH.reduce((s, f) => s + f.weight, 0);
      let rand = rng.generate(1, totalWeight);
      for (const f of FISH) { rand -= f.weight; if (rand <= 0) { fish = f; break; } }
      totalWin = parseFloat((betAmount * fish.multiplier).toFixed(2));
      hit = true;
    }

    await debitWallet(req.user.id, betAmount, 'bet', `Fishing shot on ${g.name}`, gameId);
    if (totalWin > 0) await creditWallet(req.user.id, totalWin, 'win', `Fishing win on ${g.name}`, gameId);

    await query('INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
      [gameId, req.user.id, betAmount, totalWin, JSON.stringify({ hit, fish }), 'fishing']);

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    res.json({ hit, fish, totalWin, balance: wallet.rows[0].balance });
  } catch (err) {
    console.error('Fishing shoot error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Game history
router.get('/:gameId/history', authenticate, async (req, res) => {
  const result = await query(
    'SELECT * FROM game_rounds WHERE user_id = ? AND game_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id, req.params.gameId]
  );
  res.json(result.rows);
});

// ========== ADMIN CONTROLS ==========

router.put('/bulk/win-rate', authenticate, isAdmin, async (req, res) => {
  try {
    const { win_rate, game_ids } = req.body;
    if (win_rate === undefined || win_rate === null) {
      return res.status(400).json({ error: 'win_rate is required' });
    }
    const rate = Math.min(100, Math.max(0, parseFloat(win_rate)));

    let targetGameIds = [];
    if (Array.isArray(game_ids) && game_ids.length > 0) {
      targetGameIds = game_ids;
    } else {
      const allGames = await query("SELECT id FROM games");
      targetGameIds = allGames.rows.map(g => g.id);
    }

    // Upsert win_rate for all target games in one loop, then invalidate cache
    for (const gameId of targetGameIds) {
      await query(`
        INSERT INTO game_controls (id, game_id, win_rate, updated_by)
        VALUES (UUID(), ?, ?, ?)
        ON DUPLICATE KEY UPDATE win_rate = VALUES(win_rate), updated_by = VALUES(updated_by), updated_at = NOW()
      `, [gameId, rate, req.user.id]);
      // Invalidate cache so next read fetches fresh value from DB
      gameControlsCache.delete(gameId);
    }

    await query('INSERT INTO audit_logs (id, user_id, action, entity, details) VALUES (UUID(), ?, ?, ?, ?)',
      [req.user.id, 'bulk_win_rate_update', 'games', JSON.stringify({ win_rate: rate, updated_count: targetGameIds.length })]);

    res.json({ success: true, message: `Win rate set to ${rate}% for ${targetGameIds.length} game(s)`, win_rate: rate, count: targetGameIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:gameId/controls', authenticate, isAdmin, async (req, res) => {
  try {
    const controls = await getGameControls(req.params.gameId);
    res.json({ game_id: req.params.gameId, ...controls, player_class_overrides: undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:gameId/controls', authenticate, isAdmin, async (req, res) => {
  try {
    const { win_rate, force_outcome, min_payout, max_payout, payout_cap, dry_run } = req.body;
    const updates = {};
    if (win_rate !== undefined) updates.win_rate = Math.min(100, Math.max(0, win_rate));
    if (force_outcome !== undefined) updates.force_outcome = force_outcome || null;
    if (min_payout !== undefined) updates.min_payout = min_payout;
    if (max_payout !== undefined) updates.max_payout = max_payout;
    if (payout_cap !== undefined) updates.payout_cap = payout_cap;
    if (dry_run !== undefined) updates.dry_run = dry_run;

    const controls = await saveGameControls(req.params.gameId, updates, req.user.id);

    await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
      [req.user.id, 'game_control_update', 'game', req.params.gameId, JSON.stringify({ gameId: req.params.gameId, ...req.body })]);

    res.json({ success: true, controls: { ...controls, player_class_overrides: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:gameId/force-outcome', authenticate, isAdmin, async (req, res) => {
  const { gameId } = req.params;
  const { user_id, outcome, spins } = req.body;

  if (!['win', 'loss', 'jackpot', 'big_win'].includes(outcome)) {
    return res.status(400).json({ error: 'Invalid outcome. Use: win, loss, jackpot, big_win' });
  }
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  // Verify user exists
  const userCheck = await query('SELECT id FROM users WHERE id = ?', [user_id]);
  if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found' });

  const spinsCount = parseInt(spins) || 1;
  for (let i = 0; i < spinsCount; i++) {
    await query('INSERT INTO forced_outcomes (id, user_id, game_id, outcome, created_by) VALUES (UUID(),?,?,?,?)',
      [user_id, gameId, outcome, req.user.id]);
  }

  await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
    [req.user.id, 'force_outcome', 'game', gameId, JSON.stringify({ gameId, target_user: user_id, outcome, spins: spinsCount })]);

  res.json({ success: true, message: `${spinsCount} forced ${outcome}(s) queued for player` });
});

router.post('/:gameId/player-class', authenticate, isAdmin, async (req, res) => {
  const { gameId } = req.params;
  const { user_id, player_class } = req.body;

  if (!['vip', 'normal', 'low'].includes(player_class)) {
    return res.status(400).json({ error: 'Invalid player class. Use: vip, normal, low' });
  }
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const userCheck = await query('SELECT id FROM users WHERE id = ?', [user_id]);
  if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found' });

  // Persist to DB — spin route reads player_class from users table
  await query('UPDATE users SET player_class = ? WHERE id = ?', [player_class, user_id]);

  await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
    [req.user.id, 'player_class_update', 'user', user_id, JSON.stringify({ gameId, target_user: user_id, player_class })]);

  res.json({ success: true, message: `Player class set to ${player_class}` });
});

router.post('/:gameId/trigger-jackpot', authenticate, isAdmin, async (req, res) => {
  const { gameId } = req.params;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const userCheck = await query('SELECT id FROM users WHERE id = ?', [user_id]);
  if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found' });

  await query('INSERT INTO forced_outcomes (id, user_id, game_id, outcome, created_by) VALUES (UUID(),?,?,?,?)',
    [user_id, gameId, 'jackpot', req.user.id]);

  await query('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (UUID(),?,?,?,?,?)',
    [req.user.id, 'manual_jackpot', 'game', gameId, JSON.stringify({ gameId, target_user: user_id })]);

  res.json({ success: true, message: `Jackpot queued for player on next spin` });
});

router.get('/:gameId/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await query(`
      SELECT COUNT(*) as total_spins, COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(win_amount), 0) as total_wins, COALESCE(AVG(win_amount), 0) as avg_win,
        COALESCE(MAX(win_amount), 0) as max_win,
        COUNT(CASE WHEN win_amount > 0 THEN 1 END) as winning_spins,
        COUNT(CASE WHEN forced_outcome IS NOT NULL THEN 1 END) as forced_spins
      FROM game_rounds WHERE game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
    `, [req.params.gameId]);

    const s = stats.rows[0];
    const rtp = s.total_bet > 0 ? (parseFloat(s.total_wins) / parseFloat(s.total_bet) * 100).toFixed(2) : '0.00';
    const win_rate = s.total_spins > 0 ? ((parseInt(s.winning_spins) / parseInt(s.total_spins)) * 100).toFixed(2) : '0.00';

    res.json({ ...s, rtp_actual: rtp, win_rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
