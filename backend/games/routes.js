const express = require('express');
const { notifyFishingCatch, notifyGameEvent } = require('./multiplayer');
const { query, pool } = require('../config/database');
const { authenticate, isAdmin, gameLimiter } = require('../middleware/auth');
const { debitWallet, creditWallet } = require('../wallet/routes');
const { GameEngine } = require('../../game-engine/engine');

const router = express.Router();

// In-memory cache with TTL (10s) — ensures settings sync quickly after admin changes
const gameControlsCache = new Map();
const CACHE_TTL = 10 * 1000; // 10 seconds

// Load controls from DB, fallback to defaults
async function getGameControls(gameId) {
  const cached = gameControlsCache.get(gameId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const result = await query('SELECT * FROM game_controls WHERE game_id = ?', [gameId]);
  let controls;
  if (result.rows[0]) {
    controls = {
      win_rate: parseFloat(result.rows[0].win_rate) || 25,
      force_outcome: result.rows[0].force_outcome || null,
      min_payout: parseFloat(result.rows[0].min_payout) || 0,
      max_payout: parseFloat(result.rows[0].max_payout) || 0,
      payout_cap: parseFloat(result.rows[0].payout_cap) || 0,
      dry_run: !!result.rows[0].dry_run,
      player_class_overrides: new Map()
    };
  } else {
    // No row yet — check if there is a global/default control row
    const globalResult = await query("SELECT * FROM game_controls WHERE game_id IS NULL OR game_id = '' LIMIT 1");
    const globalForce = globalResult.rows[0]?.force_outcome || null;
    controls = { win_rate: 25, force_outcome: globalForce, min_payout: 0, max_payout: 0, payout_cap: 0, dry_run: false, player_class_overrides: new Map() };
    // Insert defaults for this game so future saves work
    await query('INSERT IGNORE INTO game_controls (id, game_id, win_rate, force_outcome) VALUES (UUID(), ?, 25, ?)', [gameId, globalForce]);
  }
  gameControlsCache.set(gameId, { data: controls, ts: Date.now() });
  return controls;
}

// Persist controls to DB and immediately update cache
async function saveGameControls(gameId, updates, adminId) {
  const controls = await getGameControls(gameId);
  Object.assign(controls, updates);
  // Invalidate cache so next spin reads fresh from DB
  gameControlsCache.delete(gameId);

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
  const result = await query("SELECT id, name, slug, type, rtp, min_bet, max_bet, config, thumbnail_url FROM games WHERE status = 'active'");
  res.json(result.rows);
});

// Get game details
router.get('/:slug', authenticate, async (req, res) => {
  const result = await query("SELECT * FROM games WHERE slug = ? AND status = 'active'", [req.params.slug]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Game not found' });
  res.json(result.rows[0]);
});

// Spin
router.post('/:gameId/spin', authenticate, gameLimiter, async (req, res) => {
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

    // Global force_outcome=loss CANNOT be overridden by per-player queue
    let forcedOutcome = controls.force_outcome;
    if (controls.force_outcome !== 'loss' && playerForces.rows[0]) forcedOutcome = playerForces.rows[0].outcome;

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

    // Parse config if stored as JSON string; only use custom config when it has symbols
    let engineConfig;
    try {
      const rawConfig = typeof g.config === 'string' ? JSON.parse(g.config) : g.config;
      engineConfig = rawConfig?.symbols ? rawConfig : undefined;
    } catch {
      engineConfig = undefined;
    }

    let result;
    try {
      const engine = new GameEngine(engineConfig, gameSettings);
      result = engine.spin(betAmount, false, {
        totalBet: parseFloat(stats.total_bet) || 0,
        totalWin: parseFloat(stats.total_win) || 0,
        spins: parseInt(stats.spins) || 0
      });
    } catch (spinErr) {
      // Refund bet if engine fails after debit
      if (!gameSettings.dry_run) {
        try {
          await creditWallet(req.user.id, betAmount, 'refund', `Spin failed refund on ${g.name}`, gameId);
        } catch (refundErr) {
          console.error('Refund after spin failure failed:', refundErr.message);
        }
      }
      throw spinErr;
    }

    // Re-create engine reference for jackpot check (same settings)
    const engine = new GameEngine(engineConfig, gameSettings);

    // Jackpot — never awarded on forced loss
    const jackpot = await query("SELECT * FROM jackpots WHERE game_id = ? AND status = 'active'", [gameId]);
    let jackpotWin = 0;
    const isSpinForcedLoss = result.forcedOutcome === 'loss_forced' || result.forcedOutcome === 'loss_cap';
    if (jackpot.rows[0] && !isSpinForcedLoss) {
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
    } else if (jackpot.rows[0] && isSpinForcedLoss) {
      // Still accumulate jackpot contribution even on forced loss
      await query('UPDATE jackpots SET current_amount = current_amount + ? WHERE id = ?',
        [result.jackpotContribution, jackpot.rows[0].id]);
    }

    // Mark forced outcome used — only if it was actually applied (not overridden by global loss)
    if (playerForces.rows[0] && controls.force_outcome !== 'loss') {
      await query('UPDATE forced_outcomes SET used = 1, used_at = NOW() WHERE id = ?', [playerForces.rows[0].id]);
    }

    // Final hard stop — if global force_outcome=loss, zero win unconditionally
    if (controls.force_outcome === 'loss') {
      result.totalWin = 0;
      result.freeSpinsAwarded = 0;
      result.bonusTriggered = false;
      result.jackpotWon = 0;
      jackpotWin = 0;
    }

    // Clamp win to remaining payout cap allowance
    if (gameSettings.payout_cap > 0 && result.totalWin > 0) {
      const alreadyWon = parseFloat(stats.total_win) || 0;
      const remaining = Math.max(0, gameSettings.payout_cap - alreadyWon);
      if (remaining <= 0) {
        result.totalWin = 0;
        result.forcedOutcome = 'loss_cap';
      } else if (result.totalWin > remaining) {
        result.totalWin = parseFloat(remaining.toFixed(2));
      }
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

    // Never award free spins on forced loss
    if (result.freeSpinsAwarded > 0 && controls.force_outcome !== 'loss') {
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
router.post('/:gameId/free-spin', authenticate, gameLimiter, async (req, res) => {
  const { gameId } = req.params;
  try {
    const fs = await query(
      "SELECT * FROM free_spins WHERE user_id = ? AND game_id = ? AND used_spins < total_spins AND expires_at > NOW() ORDER BY created_at LIMIT 1",
      [req.user.id, gameId]
    );
    if (!fs.rows[0]) return res.status(400).json({ error: 'No free spins available' });

    const game = await query('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const controls = await getGameControls(gameId);
    const userRow = await query('SELECT player_class FROM users WHERE id = ?', [req.user.id]);
    const playerClass = userRow.rows[0]?.player_class || 'normal';

    const gameSettings = {
      win_rate: controls.win_rate,
      force_outcome: controls.force_outcome,
      min_payout: controls.min_payout,
      max_payout: controls.max_payout,
      rtp: game.rows[0].rtp,
      player_class: playerClass,
      dry_run: false,
      payout_cap: controls.payout_cap
    };

    // Session stats needed for payout cap
    const sessionStats = await query(
      `SELECT COALESCE(SUM(win_amount), 0) as total_win FROM game_rounds
       WHERE user_id = ? AND game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [req.user.id, gameId]
    );
    const alreadyWon = parseFloat(sessionStats.rows[0].total_win) || 0;

    const engine = new GameEngine(game.rows[0].config?.symbols ? game.rows[0].config : undefined, gameSettings);
    const result = engine.spin(game.rows[0].min_bet, true, { totalBet: 0, totalWin: alreadyWon, spins: 0 });

    // Clamp free spin win to remaining payout cap
    if (controls.payout_cap > 0 && result.totalWin > 0) {
      const remaining = Math.max(0, controls.payout_cap - alreadyWon);
      if (remaining <= 0) result.totalWin = 0;
      else if (result.totalWin > remaining) result.totalWin = parseFloat(remaining.toFixed(2));
    }

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
router.post('/:gameId/fishing-shoot', authenticate, gameLimiter, async (req, res) => {
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

    // force_outcome=loss overrides hit result
    if (controls.force_outcome === 'loss') { totalWin = 0; hit = false; fish = null; }

    // Apply min/max payout — only on real wins
    if (totalWin > 0) {
      const mult = totalWin / betAmount;
      if (controls.min_payout > 0 && mult < controls.min_payout) totalWin = parseFloat((betAmount * controls.min_payout).toFixed(2));
      if (controls.max_payout > 0 && mult > controls.max_payout) totalWin = parseFloat((betAmount * controls.max_payout).toFixed(2));
    }
    // Payout cap — clamp current win to remaining allowance
    if (controls.payout_cap > 0 && totalWin > 0) {
      const sessionWin = await query(
        "SELECT COALESCE(SUM(win_amount), 0) as total FROM game_rounds WHERE user_id = ? AND game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        [req.user.id, gameId]
      );
      const alreadyWon = parseFloat(sessionWin.rows[0].total) || 0;
      const remaining = Math.max(0, controls.payout_cap - alreadyWon);
      if (remaining <= 0) { totalWin = 0; hit = false; }
      else if (totalWin > remaining) totalWin = parseFloat(remaining.toFixed(2));
    }

    if (!controls.dry_run) {
      await debitWallet(req.user.id, betAmount, 'bet', `Fishing shot on ${g.name}`, gameId);
      if (totalWin > 0) await creditWallet(req.user.id, totalWin, 'win', `Fishing win on ${g.name}`, gameId);
    }

    await query('INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
      [gameId, req.user.id, betAmount, totalWin, JSON.stringify({ hit, fish, dry_run: !!controls.dry_run }), 'fishing']);

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);

    // Multiplayer: sync catch to everyone in this fishing room
    if (hit && fish) {
      try {
        notifyFishingCatch({
          gameId,
          userId: req.user.id,
          username: req.user.username,
          fish,
          totalWin,
          fishId: req.body.fishId || null,
        });
        if (totalWin >= betAmount * 10) {
          notifyGameEvent('big_catch', {
            username: req.user.username,
            fish,
            totalWin,
            gameId,
          });
        }
      } catch (e) {
        console.warn('multiplayer notify failed:', e.message);
      }
    }

    res.json({ hit, fish, totalWin, balance: wallet.rows[0]?.balance ?? 0, dryRun: !!controls.dry_run });
  } catch (err) {
    console.error('Fishing shoot error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── Generic table / live / card play (server-authoritative RNG) ──────────────
// Used by Card, Sic Bo, Live games instead of the slot reel engine.
router.post('/:gameId/play', authenticate, gameLimiter, async (req, res) => {
  const { gameId } = req.params;
  const { betAmount, bets, side } = req.body; // bets = sicbo map, side = optional card side bet

  try {
    const game = await query("SELECT * FROM games WHERE id = ? AND status = 'active'", [gameId]);
    if (!game.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const g = game.rows[0];
    const type = (g.type || '').toLowerCase();

    const amount = parseFloat(betAmount);
    if (!amount || amount < g.min_bet || amount > g.max_bet) {
      return res.status(400).json({ error: `Bet must be between ${g.min_bet} and ${g.max_bet}` });
    }

    const controls = await getGameControls(gameId);
    const userRow = await query('SELECT player_class, responsible_gaming FROM users WHERE id = ?', [req.user.id]);
    const playerClass = userRow.rows[0]?.player_class || 'normal';

    // Daily limit check
    const limits = userRow.rows[0]?.responsible_gaming;
    if (limits?.daily_limit) {
      const today = await query(
        "SELECT COALESCE(SUM(bet_amount), 0) as total FROM game_rounds WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)",
        [req.user.id]
      );
      if (parseFloat(today.rows[0].total) + amount > limits.daily_limit) {
        return res.status(400).json({ error: 'Daily betting limit reached' });
      }
    }

    // Per-player forced outcome queue — global loss cannot be overridden
    const playerForces = await query(
      "SELECT * FROM forced_outcomes WHERE user_id = ? AND game_id = ? AND used = 0 ORDER BY created_at LIMIT 1",
      [req.user.id, gameId]
    );
    let forceOutcome = controls.force_outcome;
    if (controls.force_outcome !== 'loss' && playerForces.rows[0]) forceOutcome = playerForces.rows[0].outcome;

    const { SecureRNG } = require('../../game-engine/engine');
    const rng = new SecureRNG();
    const seed = rng.generateSeed();

    const winRoll = rng.generate(1, 100);
    let shouldWin = forceOutcome === 'win' || forceOutcome === 'big_win' || forceOutcome === 'jackpot'
      ? true
      : forceOutcome === 'loss'
        ? false
        : winRoll <= (controls.win_rate || 25);

    // VIP slight boost
    if (playerClass === 'vip' && forceOutcome !== 'loss' && !shouldWin) {
      if (rng.generate(1, 100) <= 10) shouldWin = true;
    }

    let totalWin = 0;
    let resultPayload = { type, seed, forcedOutcome: forceOutcome || null, playerClass };

    // ── SIC BO ──────────────────────────────────────────────────────────────
    if (type === 'table' && (g.slug || '').includes('sic') || (g.slug || '').includes('sic-bo') || type === 'card' && (g.slug || '') === 'sic-bo' || (g.slug || '').includes('sic-bo') || (g.slug || '') === 'sicbo') {
      // handled below by slug check
    }

    const slug = (g.slug || '').toLowerCase();

    if (slug.includes('sic') || type === 'sicbo') {
      const placed = bets && typeof bets === 'object' ? bets : {};
      // Build dice server-side
      let dice;
      if (shouldWin && Object.keys(placed).length > 0) {
        // Prefer a result that matches at least one bet
        const betKeys = Object.keys(placed).filter(k => placed[k] > 0);
        const pick = betKeys[rng.generate(0, Math.max(0, betKeys.length - 1))] || 'big';
        dice = generateSicBoDiceForBet(rng, pick);
      } else if (!shouldWin && Object.keys(placed).length > 0) {
        dice = generateSicBoDiceAvoiding(rng, placed);
      } else {
        dice = [rng.generate(1, 6), rng.generate(1, 6), rng.generate(1, 6)];
      }
      const total = dice[0] + dice[1] + dice[2];
      const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
      const hasDouble = new Set(dice).size < 3;

      // Evaluate payouts against player bets
      let win = 0;
      for (const [betType, betAmt] of Object.entries(placed)) {
        const a = parseFloat(betAmt) || 0;
        if (a <= 0) continue;
        // mult = total return multiplier (includes stake). Even money => 2x
        let mult = 0;
        if (betType === 'big' && total >= 11 && total <= 17 && !isTriple) mult = 2;
        else if (betType === 'small' && total >= 4 && total <= 10 && !isTriple) mult = 2;
        else if (betType === 'odd' && total % 2 === 1 && !isTriple) mult = 2;
        else if (betType === 'even' && total % 2 === 0 && !isTriple) mult = 2;
        else if (betType === 'triple' && isTriple) mult = 31; // 30:1 + stake
        else if (betType === 'double' && hasDouble && !isTriple) mult = 9;
        else if (betType.startsWith('total_')) {
          const t = parseInt(betType.split('_')[1], 10);
          if (t === total) {
            const odds = { 4:50,5:18,6:14,7:12,8:8,9:6,10:6,11:6,12:6,13:8,14:12,15:14,16:18,17:50 };
            mult = (odds[t] || 6) + 1;
          }
        }
        if (mult > 0) win += a * mult;
      }

      // If admin forced win but no bet matched, pay 1:1 on total stake
      const stake = Object.values(placed).reduce((s, v) => s + (parseFloat(v) || 0), 0) || amount;
      if (shouldWin && win === 0 && forceOutcome) win = stake * 2;
      if (!shouldWin) win = 0; // enforce force loss / win_rate miss even if dice accidentally matched

      totalWin = parseFloat(win.toFixed(2));
      resultPayload = { ...resultPayload, dice, total, isTriple, bets: placed };
    }
    // ── LIVE / WHEEL ────────────────────────────────────────────────────────
    else if (type === 'live' || ['monopoly-live','crazy-time','lightning-roulette','dream-catcher'].some(s => slug.includes(s))) {
      // Weighted segment pick driven by shouldWin
      const segments = liveSegmentsForSlug(slug);
      let segmentIndex;
      if (shouldWin) {
        const winIdx = segments.map((s, i) => (s.multiplier > 1 ? i : -1)).filter(i => i >= 0);
        segmentIndex = winIdx.length ? winIdx[rng.generate(0, winIdx.length - 1)] : rng.generate(0, segments.length - 1);
      } else {
        const loseIdx = segments.map((s, i) => (s.multiplier <= 1 ? i : -1)).filter(i => i >= 0);
        segmentIndex = loseIdx.length ? loseIdx[rng.generate(0, loseIdx.length - 1)] : rng.generate(0, segments.length - 1);
      }
      const segment = segments[segmentIndex];
      totalWin = shouldWin ? parseFloat((amount * (segment.multiplier || 1)).toFixed(2)) : 0;
      // force loss zeros even if segment would pay
      if (forceOutcome === 'loss') totalWin = 0;
      resultPayload = { ...resultPayload, segmentIndex, segment, segments: segments.length };
    }
    // ── CARD / BLACKJACK-STYLE ──────────────────────────────────────────────
    else {
      // Single-round outcome: win pays 2x (1:1), blackjack-style 2.5x on "big_win"
      const playerHand = dealBlackjackHand(rng, shouldWin ? 'player' : 'dealer');
      const dealerHand = dealBlackjackHand(rng, shouldWin ? 'dealer' : 'player');
      let outcome = 'lose';
      if (shouldWin) {
        outcome = forceOutcome === 'big_win' || forceOutcome === 'jackpot' ? 'blackjack' : 'win';
        totalWin = outcome === 'blackjack'
          ? parseFloat((amount * 2.5).toFixed(2))
          : parseFloat((amount * 2).toFixed(2)); // returns stake + win
      } else {
        // 10% push chance when not forced loss
        if (forceOutcome !== 'loss' && rng.generate(1, 100) <= 8) {
          outcome = 'push';
          totalWin = amount; // refund stake
        } else {
          outcome = 'lose';
          totalWin = 0;
        }
      }
      resultPayload = { ...resultPayload, outcome, playerHand, dealerHand };
    }

    // force_outcome=loss overrides everything — zero win, no min_payout boost
    if (forceOutcome === 'loss') totalWin = 0;

    // Apply min/max payout — only on real wins, never on forced losses
    if (totalWin > 0 && forceOutcome !== 'loss') {
      const mult = totalWin / amount;
      if (controls.min_payout > 0 && mult < controls.min_payout) totalWin = parseFloat((amount * controls.min_payout).toFixed(2));
      if (controls.max_payout > 0 && mult > controls.max_payout) totalWin = parseFloat((amount * controls.max_payout).toFixed(2));
    }
    // Payout cap — clamp current win to remaining allowance
    if (controls.payout_cap > 0 && totalWin > 0) {
      const sessionWin = await query(
        "SELECT COALESCE(SUM(win_amount), 0) as total FROM game_rounds WHERE user_id = ? AND game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        [req.user.id, gameId]
      );
      const alreadyWon = parseFloat(sessionWin.rows[0].total) || 0;
      const remaining = Math.max(0, controls.payout_cap - alreadyWon);
      if (remaining <= 0) totalWin = 0;
      else if (totalWin > remaining) totalWin = parseFloat(remaining.toFixed(2));
    }
    // VIP bonus — never on forced loss
    if (playerClass === 'vip' && totalWin > 0 && forceOutcome !== 'loss') {
      totalWin = parseFloat((totalWin * 1.05).toFixed(2));
    }

    // Final hard stop — force_outcome=loss always pays zero, no exceptions
    if (forceOutcome === 'loss') totalWin = 0;

    // Stake amount for debit: for sicbo use sum of bets if provided
    let debitAmount = amount;
    if (resultPayload.bets) {
      const stake = Object.values(resultPayload.bets).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (stake > 0) debitAmount = stake;
    }

    if (!controls.dry_run) {
      await debitWallet(req.user.id, debitAmount, 'bet', `Play on ${g.name}`, gameId);
      if (totalWin > 0) await creditWallet(req.user.id, totalWin, 'win', `Win on ${g.name}`, gameId);
    }

    if (playerForces.rows[0]) {
      await query('UPDATE forced_outcomes SET used = 1, used_at = NOW() WHERE id = ?', [playerForces.rows[0].id]);
    }

    await query(
      'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed, player_class, forced_outcome) VALUES (UUID(),?,?,?,?,?,?,?,?)',
      [gameId, req.user.id, debitAmount, totalWin, JSON.stringify(resultPayload), seed, playerClass, forceOutcome || null]
    );

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    res.json({
      totalWin,
      balance: wallet.rows[0]?.balance ?? 0,
      ...resultPayload,
      dryRun: !!controls.dry_run,
      betAmount: debitAmount
    });
  } catch (err) {
    console.error('Table play error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Helpers for /play
function generateSicBoDiceForBet(rng, betType) {
  if (betType === 'big') return splitTotal(rng, 11 + rng.generate(0, 6));
  if (betType === 'small') return splitTotal(rng, 4 + rng.generate(0, 6));
  if (betType === 'odd') {
    const odds = [5, 7, 9, 11, 13, 15];
    return splitTotal(rng, odds[rng.generate(0, odds.length - 1)]);
  }
  if (betType === 'even') {
    const evens = [6, 8, 10, 12, 14, 16];
    return splitTotal(rng, evens[rng.generate(0, evens.length - 1)]);
  }
  if (betType === 'triple') {
    const v = rng.generate(1, 6);
    return [v, v, v];
  }
  if (betType === 'double') {
    const v = rng.generate(1, 6);
    let other = rng.generate(1, 6);
    while (other === v) other = rng.generate(1, 6);
    return [v, v, other];
  }
  if (String(betType).startsWith('total_')) {
    return splitTotal(rng, parseInt(String(betType).split('_')[1], 10));
  }
  return [rng.generate(1, 6), rng.generate(1, 6), rng.generate(1, 6)];
}

function generateSicBoDiceAvoiding(rng, placed) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const d = [rng.generate(1, 6), rng.generate(1, 6), rng.generate(1, 6)];
    const t = d[0] + d[1] + d[2];
    const isTriple = d[0] === d[1] && d[1] === d[2];
    const hasDouble = new Set(d).size < 3;
    const matches = (
      (placed.big && t >= 11 && t <= 17 && !isTriple) ||
      (placed.small && t >= 4 && t <= 10 && !isTriple) ||
      (placed.odd && t % 2 === 1 && !isTriple) ||
      (placed.even && t % 2 === 0 && !isTriple) ||
      (placed.triple && isTriple) ||
      (placed.double && hasDouble && !isTriple) ||
      Object.keys(placed).some(k => k.startsWith('total_') && parseInt(k.split('_')[1], 10) === t)
    );
    if (!matches) return d;
  }
  return [1, 2, 3]; // safe low non-matching
}

function splitTotal(rng, total) {
  const clamped = Math.max(3, Math.min(18, total));
  let d1 = rng.generate(1, 6);
  let d2 = rng.generate(1, 6);
  let d3 = clamped - d1 - d2;
  let guard = 0;
  while ((d3 < 1 || d3 > 6) && guard++ < 30) {
    d1 = rng.generate(1, 6);
    d2 = rng.generate(1, 6);
    d3 = clamped - d1 - d2;
  }
  if (d3 < 1 || d3 > 6) return [1, 1, Math.min(6, Math.max(1, clamped - 2))];
  return [d1, d2, d3];
}

function liveSegmentsForSlug(slug) {
  if (slug.includes('crazy-time')) {
    return [
      { label: '1', multiplier: 1 }, { label: '2', multiplier: 2 }, { label: '5', multiplier: 5 },
      { label: '10', multiplier: 10 }, { label: 'COIN FLIP', multiplier: 2 }, { label: 'CASH HUNT', multiplier: 5 },
      { label: 'PACHINKO', multiplier: 8 }, { label: 'CRAZY TIME', multiplier: 50 }
    ];
  }
  if (slug.includes('lightning')) {
    return Array.from({ length: 37 }, (_, i) => ({ label: String(i), multiplier: i === 0 ? 35 : 35 }));
  }
  if (slug.includes('monopoly')) {
    return [
      { label: '1', multiplier: 1 }, { label: '2', multiplier: 2 }, { label: '5', multiplier: 5 },
      { label: '10', multiplier: 10 }, { label: '2 ROLLS', multiplier: 15 }, { label: '4 ROLLS', multiplier: 30 },
      { label: 'CHANCE', multiplier: 5 }
    ];
  }
  // dream-catcher default
  return [
    { label: '1', multiplier: 1 }, { label: '2', multiplier: 2 }, { label: '5', multiplier: 5 },
    { label: '10', multiplier: 10 }, { label: '20', multiplier: 20 }, { label: '40', multiplier: 40 },
    { label: '2×', multiplier: 2 }, { label: '7×', multiplier: 7 }
  ];
}

function dealBlackjackHand(rng, favor) {
  // favor 'player' → stronger hand, 'dealer' → weaker (for visual consistency with outcome)
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['hearts','diamonds','clubs','spades'];
  const card = () => ({
    rank: ranks[rng.generate(0, ranks.length - 1)],
    suit: suits[rng.generate(0, suits.length - 1)]
  });
  if (favor === 'player') {
    // Aim for 18-21
    const high = ['10','J','Q','K','A','9','8'];
    return [
      { rank: high[rng.generate(0, high.length - 1)], suit: suits[rng.generate(0, 3)] },
      { rank: high[rng.generate(0, high.length - 1)], suit: suits[rng.generate(0, 3)] }
    ];
  }
  return [card(), card()];
}

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

    for (const gameId of targetGameIds) {
      await query(`
        INSERT INTO game_controls (id, game_id, win_rate, updated_by)
        VALUES (UUID(), ?, ?, ?)
        ON DUPLICATE KEY UPDATE win_rate = VALUES(win_rate), updated_by = VALUES(updated_by), updated_at = NOW()
      `, [gameId, rate, req.user.id]);
      gameControlsCache.delete(gameId);
    }

    await query('INSERT INTO audit_logs (id, user_id, action, entity, details) VALUES (UUID(), ?, ?, ?, ?)',
      [req.user.id, 'bulk_win_rate_update', 'games', JSON.stringify({ win_rate: rate, updated_count: targetGameIds.length })]);

    res.json({ success: true, message: `Win rate set to ${rate}% for ${targetGameIds.length} game(s)`, win_rate: rate, count: targetGameIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk force outcome across ALL games
router.put('/bulk/force-outcome', authenticate, isAdmin, async (req, res) => {
  try {
    const { force_outcome, game_ids } = req.body;
    const outcome = force_outcome || null;

    let targetGameIds = [];
    if (Array.isArray(game_ids) && game_ids.length > 0) {
      targetGameIds = game_ids;
    } else {
      const allGames = await query("SELECT id FROM games");
      targetGameIds = allGames.rows.map(g => g.id);
    }

    for (const gameId of targetGameIds) {
      await query(`
        INSERT INTO game_controls (id, game_id, win_rate, force_outcome, updated_by)
        VALUES (UUID(), ?, 25, ?, ?)
        ON DUPLICATE KEY UPDATE force_outcome = VALUES(force_outcome), updated_by = VALUES(updated_by), updated_at = NOW()
      `, [gameId, outcome, req.user.id]);
      gameControlsCache.delete(gameId);
    }

    await query('INSERT INTO audit_logs (id, user_id, action, entity, details) VALUES (UUID(), ?, ?, ?, ?)',
      [req.user.id, 'bulk_force_outcome_update', 'games', JSON.stringify({ force_outcome: outcome, updated_count: targetGameIds.length })]);

    res.json({ success: true, message: `Force outcome set to "${outcome || 'random'}" for ${targetGameIds.length} game(s)`, force_outcome: outcome, count: targetGameIds.length });
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


// ── Cockfighting / Sabong (Meron vs Wala) ─────────────────────────────────────
// Real-money bet on MERON | WALA | DRAW. Outcome uses admin win_rate / force_outcome.
router.post('/:gameId/cockfight', authenticate, gameLimiter, async (req, res) => {
  const { gameId } = req.params;
  const betAmount = parseFloat(req.body.betAmount);
  const side = String(req.body.side || '').toLowerCase(); // meron | wala | draw

  try {
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    if (!['meron', 'wala', 'draw'].includes(side)) {
      return res.status(400).json({ error: 'Choose side: meron, wala, or draw' });
    }

    const game = await query("SELECT * FROM games WHERE id = ? AND status = 'active'", [gameId]);
    if (!game.rows[0]) return res.status(404).json({ error: 'Game not found' });
    const g = game.rows[0];
    if (betAmount < Number(g.min_bet) || betAmount > Number(g.max_bet)) {
      return res.status(400).json({ error: `Bet must be between ${g.min_bet} and ${g.max_bet}` });
    }

    const controls = await getGameControls(gameId);
    const { SecureRNG } = require('../../game-engine/engine');
    const rng = new SecureRNG();

    // Odds (decimal, includes stake return style for straight bets)
    const ODDS = { meron: 1.95, wala: 1.95, draw: 8 };

    // Determine fight winner under admin controls
    // force_outcome: win = player's side wins, loss = player's side loses, null = RNG
    let winner; // meron | wala | draw
    const force = controls.force_outcome;
    if (force === 'win') {
      winner = side === 'draw' ? 'draw' : side;
    } else if (force === 'loss') {
      if (side === 'meron') winner = 'wala';
      else if (side === 'wala') winner = 'meron';
      else winner = rng.generate(1, 2) === 1 ? 'meron' : 'wala';
    } else {
      const roll = rng.generate(1, 100);
      // Small natural draw chance (~4%) unless player bet draw (then use win_rate)
      if (side === 'draw') {
        winner = roll <= controls.win_rate ? 'draw' : (rng.generate(1, 2) === 1 ? 'meron' : 'wala');
      } else {
        const drawRoll = rng.generate(1, 100);
        if (drawRoll <= 4) {
          winner = 'draw';
        } else if (roll <= controls.win_rate) {
          winner = side; // player wins
        } else {
          winner = side === 'meron' ? 'wala' : 'meron';
        }
      }
    }

    const playerWon = winner === side;
    let totalWin = 0;
    if (playerWon) {
      totalWin = parseFloat((betAmount * ODDS[side]).toFixed(2));
    } else if (winner === 'draw' && side !== 'draw') {
      // Straight bets push on draw (refund stake)
      totalWin = betAmount;
    }

    // force_outcome=loss overrides winner — zero win, no push refund
    if (controls.force_outcome === 'loss') { totalWin = 0; }

    // Apply min/max payout — only on real wins, never on forced losses
    if (totalWin > 0 && controls.force_outcome !== 'loss') {
      const mult = totalWin / betAmount;
      if (controls.min_payout > 0 && mult < controls.min_payout) totalWin = parseFloat((betAmount * controls.min_payout).toFixed(2));
      if (controls.max_payout > 0 && mult > controls.max_payout) totalWin = parseFloat((betAmount * controls.max_payout).toFixed(2));
    }
    // Payout cap — clamp current win to remaining allowance
    if (controls.payout_cap > 0 && totalWin > 0) {
      const sessionWin = await query(
        "SELECT COALESCE(SUM(win_amount), 0) as total FROM game_rounds WHERE user_id = ? AND game_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        [req.user.id, gameId]
      );
      const alreadyWon = parseFloat(sessionWin.rows[0].total) || 0;
      const remaining = Math.max(0, controls.payout_cap - alreadyWon);
      if (remaining <= 0) totalWin = 0;
      else if (totalWin > remaining) totalWin = parseFloat(remaining.toFixed(2));
    }

    if (!controls.dry_run) {
      if (totalWin > 0) {
        await creditWallet(req.user.id, totalWin, 'win', `Cockfight ${winner} on ${g.name}`, gameId);
      }
    }

    await query(
      'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
      [gameId, req.user.id, betAmount, totalWin, JSON.stringify({
        side, winner, playerWon, odds: ODDS[side], dry_run: !!controls.dry_run, force
      }), 'cockfight']
    );

    const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [req.user.id]);
    res.json({
      side,
      winner,
      playerWon: playerWon || (winner === 'draw' && side !== 'draw'), // push counts as non-loss UI
      isPush: winner === 'draw' && side !== 'draw',
      totalWin,
      odds: ODDS[side],
      balance: wallet.rows[0]?.balance ?? 0,
      dryRun: !!controls.dry_run,
      // Fight flavor for animation
      rounds: rng.generate(3, 6),
      critical: playerWon && totalWin >= betAmount * 3,
    });
  } catch (err) {
    console.error('Cockfight error:', err);
    res.status(400).json({ error: err.message });
  }
});


module.exports = router;
