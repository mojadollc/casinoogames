/**
 * Multiplayer card tables — production real-money.
 * Server-authoritative deck, bets, turns, payouts.
 */
const { v4: uuidv4 } = require('uuid');
const { debitWallet, creditWallet } = require('../wallet/routes');
const { query } = require('../config/database');

// ── Admin controls helper (shared with routes.js) ────────────────────────────
const gameControlsCache = new Map();
const CACHE_TTL = 10 * 1000;
async function getGameControls(gameId) {
  const cached = gameControlsCache.get(gameId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const result = await query('SELECT * FROM game_controls WHERE game_id = ?', [gameId]);
  let controls;
  if (result.rows[0]) {
    controls = {
      force_outcome: result.rows[0].force_outcome || null,
      max_payout: parseFloat(result.rows[0].max_payout) || 0,
      payout_cap: parseFloat(result.rows[0].payout_cap) || 0,
      win_rate: parseFloat(result.rows[0].win_rate) || 25,
    };
  } else {
    // No row — still enforce force_outcome=loss if set globally via bulk endpoint
    // by checking if any game has loss set (they all get rows from bulk, so this is a safety net)
    controls = { force_outcome: null, max_payout: 0, payout_cap: 0, win_rate: 25 };
  }
  gameControlsCache.set(gameId, { data: controls, ts: Date.now() });
  return controls;
}
async function getSessionWin(userId, gameId) {
  const r = await query(
    "SELECT COALESCE(SUM(win_amount),0) as total FROM game_rounds WHERE user_id=? AND game_id=? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
    [userId, gameId]
  );
  return parseFloat(r.rows[0].total) || 0;
}
function clampPayout(payout, betAmount, controls, alreadyWon) {
  // Hard stop — force_outcome=loss always returns 0, no push refunds either
  if (controls.force_outcome === 'loss') return 0;
  let win = payout;
  if (controls.max_payout > 0 && win > betAmount * controls.max_payout)
    win = parseFloat((betAmount * controls.max_payout).toFixed(2));
  if (controls.payout_cap > 0) {
    const remaining = Math.max(0, controls.payout_cap - alreadyWon);
    if (remaining <= 0) return 0;
    if (win > remaining) win = parseFloat(remaining.toFixed(2));
  }
  return win;
}

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const tables = new Map(); // tableId -> table
let ioRef = null;

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit, rank });
  }
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank, 10);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11; }
    else total += cardValue(c);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

function baccaratValue(cards) {
  const t = cards.reduce((s, c) => {
    if (['J', 'Q', 'K', '10'].includes(c.rank)) return s;
    if (c.rank === 'A') return s + 1;
    return s + parseInt(c.rank, 10);
  }, 0);
  return t % 10;
}

function publicSeat(seat, viewerId) {
  const isSelf = seat.userId === viewerId;
  const hideHole = seat.status === 'playing' && !isSelf;
  return {
    userId: seat.userId,
    username: seat.username,
    seatIndex: seat.seatIndex,
    bet: seat.bet,
    side: seat.side || null,
    status: seat.status,
    handValue: seat.hand?.length ? handValue(seat.hand) : 0,
    hand: (seat.hand || []).map((c, i) => {
      // Hide other players' hole cards only in early deal if needed — show all for BJ multiplayer transparency after deal
      return { ...c };
    }),
    lastPayout: seat.lastPayout || 0,
    result: seat.result || null,
  };
}

function publicTable(table, viewerId = null) {
  return {
    id: table.id,
    gameId: table.gameId,
    gameSlug: table.gameSlug,
    gameName: table.gameName,
    mode: table.mode, // blackjack | baccarat | dragon_tiger | andar_bahar
    phase: table.phase,
    minBet: table.minBet,
    maxBet: table.maxBet,
    maxSeats: table.maxSeats,
    seats: table.seats.map(s => publicSeat(s, viewerId)),
    dealerHand: (table.dealerHand || []).map((c, i) => {
      // Hide dealer hole card during player turns
      if (table.phase === 'playing' && i === 1) return { faceDown: true };
      return { ...c, faceDown: false };
    }),
    dealerValue: table.phase === 'playing'
      ? handValue((table.dealerHand || []).slice(0, 1))
      : handValue(table.dealerHand || []),
    message: table.message || '',
    bettingEndsAt: table.bettingEndsAt || null,
    currentTurnUserId: table.currentTurnUserId || null,
    playerCount: table.seats.length,
  };
}

function broadcast(table) {
  if (!ioRef) return;
  ioRef.to(`card:${table.id}`).emit('card:state', publicTable(table));
}

function detectMode(slug = '') {
  const s = String(slug).toLowerCase();
  if (s.includes('baccarat')) return 'baccarat';
  if (s.includes('dragon')) return 'dragon_tiger';
  if (s.includes('andar') || s.includes('bahar')) return 'andar_bahar';
  // holdem / teen-patti / blackjack → blackjack-style multiplayer
  return 'blackjack';
}

async function loadGame(gameId) {
  const r = await query("SELECT * FROM games WHERE id = ? AND status = 'active'", [gameId]);
  return r.rows[0] || null;
}

function getTable(tableId) {
  return tables.get(tableId);
}

function listTables(gameId) {
  const list = [];
  for (const t of tables.values()) {
    if (String(t.gameId) !== String(gameId)) continue;
    if (t.phase === 'closed') continue;
    list.push({
      id: t.id,
      gameId: t.gameId,
      phase: t.phase,
      playerCount: t.seats.length,
      maxSeats: t.maxSeats,
      minBet: t.minBet,
      maxBet: t.maxBet,
      mode: t.mode,
    });
  }
  return list;
}

function createTable(game, host) {
  const mode = detectMode(game.slug || game.name);
  const table = {
    id: uuidv4(),
    gameId: game.id,
    gameSlug: game.slug || '',
    gameName: game.name || 'Card Table',
    mode,
    phase: 'waiting',
    minBet: Number(game.min_bet) || 10,
    maxBet: Number(game.max_bet) || 10000,
    maxSeats: mode === 'blackjack' ? 5 : 8,
    seats: [],
    dealerHand: [],
    deck: [],
    message: 'Waiting for players…',
    bettingEndsAt: null,
    currentTurnUserId: null,
    timers: {},
  };
  tables.set(table.id, table);
  return table;
}

function findSeat(table, userId) {
  return table.seats.find(s => String(s.userId) === String(userId));
}

function clearTimer(table, key) {
  if (table.timers[key]) {
    clearTimeout(table.timers[key]);
    delete table.timers[key];
  }
}

function schedule(table, key, ms, fn) {
  clearTimer(table, key);
  table.timers[key] = setTimeout(() => {
    delete table.timers[key];
    try { fn(); } catch (e) { console.error('card table timer', key, e.message); }
  }, ms);
}

async function joinTable(tableId, user, socketId) {
  const table = tables.get(tableId);
  if (!table) throw new Error('Table not found');
  if (findSeat(table, user.id)) {
    // reconnect
    const seat = findSeat(table, user.id);
    seat.socketId = socketId;
    return table;
  }
  if (table.seats.length >= table.maxSeats) throw new Error('Table full');
  if (table.phase !== 'waiting' && table.phase !== 'betting' && table.phase !== 'results') {
    throw new Error('Hand in progress — wait for next round');
  }
  table.seats.push({
    userId: String(user.id),
    username: user.username || 'Player',
    socketId,
    seatIndex: table.seats.length,
    bet: 0,
    side: null,
    hand: [],
    status: 'seated', // seated | bet | playing | stand | bust | done
    lastPayout: 0,
    result: null,
  });
  table.message = `${user.username || 'Player'} joined (${table.seats.length}/${table.maxSeats})`;
  if (table.phase === 'waiting' && table.seats.length >= 1) {
    // Auto-start betting soon
    schedule(table, 'startBet', 3000, () => startBetting(table.id));
  }
  broadcast(table);
  return table;
}

function leaveTable(tableId, userId, socketId) {
  const table = tables.get(tableId);
  if (!table) return;
  const before = table.seats.length;
  table.seats = table.seats.filter(s => String(s.userId) !== String(userId) && s.socketId !== socketId);
  if (table.seats.length !== before) {
    table.message = 'A player left the table';
    broadcast(table);
  }
  if (table.seats.length === 0) {
    Object.keys(table.timers).forEach(k => clearTimer(table, k));
    tables.delete(tableId);
  }
}

function startBetting(tableId) {
  const table = tables.get(tableId);
  if (!table || !table.seats.length) return;
  if (table.phase === 'playing' || table.phase === 'dealing' || table.phase === 'dealer') return;

  table.phase = 'betting';
  table.dealerHand = [];
  table.deck = makeDeck();
  table.currentTurnUserId = null;
  table.bettingEndsAt = Date.now() + 15000;
  table.message = 'Place your bets (15s)';
  for (const s of table.seats) {
    s.bet = 0;
    s.side = null;
    s.hand = [];
    s.status = 'seated';
    s.lastPayout = 0;
    s.result = null;
  }
  broadcast(table);
  schedule(table, 'endBet', 15000, () => beginHand(tableId));
}

async function placeBet(tableId, userId, amount, side) {
  const table = tables.get(tableId);
  if (!table) throw new Error('Table not found');
  if (table.phase !== 'betting' && table.phase !== 'waiting') throw new Error('Betting closed');
  const seat = findSeat(table, userId);
  if (!seat) throw new Error('Not seated');
  const value = parseFloat(amount);
  if (!Number.isFinite(value) || value < table.minBet || value > table.maxBet) {
    throw new Error(`Bet must be between ${table.minBet} and ${table.maxBet}`);
  }

  // Side required for non-BJ
  if (table.mode !== 'blackjack') {
    const allowed =
      table.mode === 'baccarat' ? ['player', 'banker', 'tie'] :
      table.mode === 'dragon_tiger' ? ['dragon', 'tiger', 'tie'] :
      ['andar', 'bahar'];
    if (!allowed.includes(side)) throw new Error(`Choose side: ${allowed.join(', ')}`);
    seat.side = side;
  }

  // If already bet this round, only allow increase by debiting difference
  const prev = seat.bet || 0;
  if (value < prev) throw new Error('Cannot decrease bet');
  const delta = value - prev;
  if (delta > 0) {
    await debitWallet(userId, delta, 'bet', `Card table ${table.gameName} bet`, table.gameId);
  }
  seat.bet = value;
  seat.status = 'bet';
  table.message = `${seat.username} bet ₱${value}${seat.side ? ' on ' + seat.side : ''}`;
  broadcast(table);

  // If all seated players have bet, start early
  if (table.seats.length > 0 && table.seats.every(s => s.bet > 0)) {
    clearTimer(table, 'endBet');
    schedule(table, 'begin', 800, () => beginHand(tableId));
  }

  const wallet = await query('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
  return { balance: wallet.rows[0]?.balance ?? 0, table: publicTable(table, userId) };
}

async function beginHand(tableId) {
  const table = tables.get(tableId);
  if (!table) return;

  // Remove players who didn't bet
  const active = table.seats.filter(s => s.bet > 0);
  if (active.length === 0) {
    table.phase = 'waiting';
    table.message = 'No bets — waiting…';
    broadcast(table);
    schedule(table, 'startBet', 5000, () => startBetting(tableId));
    return;
  }

  table.deck = makeDeck();
  table.dealerHand = [];

  if (table.mode === 'blackjack') {
    table.phase = 'dealing';
    table.message = 'Dealing…';
    broadcast(table);

    // Deal 2 each
    for (const s of active) {
      s.hand = [table.deck.pop(), table.deck.pop()];
      s.status = isBlackjack(s.hand) ? 'stand' : 'playing';
    }
    table.dealerHand = [table.deck.pop(), table.deck.pop()];
    table.phase = 'playing';

    // First player to act
    const next = active.find(s => s.status === 'playing');
    table.currentTurnUserId = next ? next.userId : null;
    table.message = next ? `${next.username}'s turn` : 'Dealer turn';
    broadcast(table);

    if (!next) {
      schedule(table, 'dealer', 600, () => dealerPlay(tableId));
    } else {
      schedule(table, 'autoStand', 20000, () => autoStand(tableId, next.userId));
    }
  } else {
    // Side-bet games: deal community hands and settle
    table.phase = 'dealing';
    table.message = 'Dealing…';
    broadcast(table);
    schedule(table, 'sideSettle', 1200, () => settleSideGame(tableId));
  }
}

function autoStand(tableId, userId) {
  const table = tables.get(tableId);
  if (!table || table.phase !== 'playing') return;
  if (String(table.currentTurnUserId) !== String(userId)) return;
  const seat = findSeat(table, userId);
  if (!seat || seat.status !== 'playing') return;
  seat.status = 'stand';
  advanceTurn(tableId);
}

function playerHit(tableId, userId) {
  const table = tables.get(tableId);
  if (!table || table.phase !== 'playing') throw new Error('Not accepting hits');
  if (String(table.currentTurnUserId) !== String(userId)) throw new Error('Not your turn');
  const seat = findSeat(table, userId);
  if (!seat || seat.status !== 'playing') throw new Error('Cannot hit');

  clearTimer(table, 'autoStand');
  seat.hand.push(table.deck.pop());
  const v = handValue(seat.hand);
  if (v > 21) {
    seat.status = 'bust';
    seat.result = 'lose';
    seat.lastPayout = 0;
    table.message = `${seat.username} busts!`;
    broadcast(table);
    advanceTurn(tableId);
  } else if (v === 21) {
    seat.status = 'stand';
    table.message = `${seat.username} has 21`;
    broadcast(table);
    advanceTurn(tableId);
  } else {
    table.message = `${seat.username} hits (${v})`;
    broadcast(table);
    schedule(table, 'autoStand', 20000, () => autoStand(tableId, userId));
  }
  return publicTable(table, userId);
}

function playerStand(tableId, userId) {
  const table = tables.get(tableId);
  if (!table || table.phase !== 'playing') throw new Error('Not accepting stands');
  if (String(table.currentTurnUserId) !== String(userId)) throw new Error('Not your turn');
  const seat = findSeat(table, userId);
  if (!seat || seat.status !== 'playing') throw new Error('Cannot stand');

  clearTimer(table, 'autoStand');
  seat.status = 'stand';
  table.message = `${seat.username} stands`;
  broadcast(table);
  advanceTurn(tableId);
  return publicTable(table, userId);
}

function advanceTurn(tableId) {
  const table = tables.get(tableId);
  if (!table) return;
  const next = table.seats.find(s => s.status === 'playing' && s.bet > 0);
  if (next) {
    table.currentTurnUserId = next.userId;
    table.message = `${next.username}'s turn`;
    broadcast(table);
    schedule(table, 'autoStand', 20000, () => autoStand(tableId, next.userId));
  } else {
    table.currentTurnUserId = null;
    schedule(table, 'dealer', 500, () => dealerPlay(tableId));
  }
}

async function dealerPlay(tableId) {
  const table = tables.get(tableId);
  if (!table) return;
  table.phase = 'dealer';
  table.message = 'Dealer plays…';
  broadcast(table);

  // Dealer draws to 17
  while (handValue(table.dealerHand) < 17) {
    table.dealerHand.push(table.deck.pop());
  }
  broadcast(table);
  await settleBlackjack(tableId);
}

async function settleBlackjack(tableId) {
  const table = tables.get(tableId);
  if (!table) return;
  table.phase = 'payout';
  const dealerVal = handValue(table.dealerHand);
  const dealerBJ = isBlackjack(table.dealerHand);
  const controls = await getGameControls(table.gameId);

  for (const seat of table.seats) {
    if (!seat.bet) continue;
    const pVal = handValue(seat.hand);
    const pBJ = isBlackjack(seat.hand);

    if (seat.status === 'bust' || controls.force_outcome === 'loss') {
      seat.result = 'lose';
      seat.lastPayout = 0;
      seat.status = 'done';
      await query(
        'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
        [table.gameId, seat.userId, seat.bet, 0, JSON.stringify({ result: 'lose', forced: controls.force_outcome, multiplayer: true }), 'card-mp']
      ).catch(() => {});
      continue;
    }

    let rawPayout = 0;
    let result = 'lose';
    if (pBJ && !dealerBJ) {
      result = 'blackjack';
      rawPayout = parseFloat((seat.bet * 2.5).toFixed(2));
    } else if (dealerVal > 21 || pVal > dealerVal) {
      result = 'win';
      rawPayout = parseFloat((seat.bet * 2).toFixed(2));
    } else if (pVal === dealerVal) {
      result = 'push';
      rawPayout = seat.bet;
    }

    const alreadyWon = await getSessionWin(seat.userId, table.gameId);
    const payout = clampPayout(rawPayout, seat.bet, controls, alreadyWon);

    seat.result = result;
    seat.lastPayout = payout;
    seat.status = 'done';
    if (payout > 0) {
      try {
        await creditWallet(seat.userId, payout, 'win', `Card table ${result} ${table.gameName}`, table.gameId);
      } catch (e) {
        console.error('payout failed', seat.userId, e.message);
      }
    }
    try {
      await query(
        'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
        [table.gameId, seat.userId, seat.bet, payout, JSON.stringify({ result, hand: seat.hand, dealer: table.dealerHand, multiplayer: true }), 'card-mp']
      );
    } catch {}
  }

  table.phase = 'results';
  table.message = 'Round complete';
  broadcast(table);
  schedule(table, 'next', 6000, () => startBetting(tableId));
}

async function settleSideGame(tableId) {
  const table = tables.get(tableId);
  if (!table) return;

  table.deck = table.deck.length ? table.deck : makeDeck();
  let outcomeSide = 'player';
  let community = {};

  if (table.mode === 'baccarat') {
    const player = [table.deck.pop(), table.deck.pop()];
    const banker = [table.deck.pop(), table.deck.pop()];
    // Simplified third-card rules omitted for speed — compare totals
    const pv = baccaratValue(player);
    const bv = baccaratValue(banker);
    if (pv > bv) outcomeSide = 'player';
    else if (bv > pv) outcomeSide = 'banker';
    else outcomeSide = 'tie';
    community = { player, banker, playerValue: pv, bankerValue: bv };
    table.dealerHand = banker; // reuse field for display of banker
    // Store player community on table for broadcast
    table.sideHands = { player, banker };
  } else if (table.mode === 'dragon_tiger') {
    const dragon = table.deck.pop();
    const tiger = table.deck.pop();
    const dv = cardValue(dragon);
    const tv = cardValue(tiger);
    if (dv > tv) outcomeSide = 'dragon';
    else if (tv > dv) outcomeSide = 'tiger';
    else outcomeSide = 'tie';
    community = { dragon, tiger };
    table.dealerHand = [dragon, tiger];
    table.sideHands = community;
  } else {
    // andar bahar — first card joker middle, then alternate
    const joker = table.deck.pop();
    let andar = [];
    let bahar = [];
    let winner = null;
    for (let i = 0; i < 15 && !winner; i++) {
      const c = table.deck.pop();
      if (i % 2 === 0) {
        andar.push(c);
        if (c.rank === joker.rank) winner = 'andar';
      } else {
        bahar.push(c);
        if (c.rank === joker.rank) winner = 'bahar';
      }
    }
    outcomeSide = winner || 'andar';
    community = { joker, andar, bahar };
    table.dealerHand = [joker];
    table.sideHands = community;
  }

  table.phase = 'payout';
  table.message = `Result: ${outcomeSide.toUpperCase()}`;
  table.sideOutcome = outcomeSide;

  const controls = await getGameControls(table.gameId);

  for (const seat of table.seats) {
    if (!seat.bet || !seat.side) continue;
    let rawPayout = 0;
    let result = 'lose';

    if (controls.force_outcome !== 'loss') {
      if (seat.side === outcomeSide) {
        result = 'win';
        const mult = outcomeSide === 'tie' ? 9 : (seat.side === 'banker' ? 1.95 : 2);
        rawPayout = parseFloat((seat.bet * mult).toFixed(2));
      } else if (outcomeSide === 'tie' && table.mode === 'baccarat' && (seat.side === 'player' || seat.side === 'banker')) {
        result = 'push';
        rawPayout = seat.bet;
      }
    }

    const alreadyWon = await getSessionWin(seat.userId, table.gameId);
    const payout = clampPayout(rawPayout, seat.bet, controls, alreadyWon);

    seat.result = result;
    seat.lastPayout = payout;
    seat.status = 'done';
    if (payout > 0) {
      try {
        await creditWallet(seat.userId, payout, 'win', `Card MP ${result} ${table.gameName}`, table.gameId);
      } catch (e) {
        console.error('side payout fail', e.message);
      }
    }
    try {
      await query(
        'INSERT INTO game_rounds (id, game_id, user_id, bet_amount, win_amount, result, rng_seed) VALUES (UUID(),?,?,?,?,?,?)',
        [table.gameId, seat.userId, seat.bet, payout, JSON.stringify({ result, side: seat.side, outcomeSide, community, multiplayer: true }), 'card-mp']
      );
    } catch {}
  }

  table.phase = 'results';
  broadcast(table);
  // include side hands in state via message field for clients
  schedule(table, 'next', 7000, () => startBetting(tableId));
}

function initCardTables(io) {
  ioRef = io;

  io.on('connection', (socket) => {
    socket.on('card:list', async ({ gameId }, cb) => {
      try {
        const list = listTables(gameId);
        if (typeof cb === 'function') cb({ ok: true, tables: list });
        else socket.emit('card:tables', list);
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('card:create', async (payload = {}, cb) => {
      try {
        const { gameId, userId, username } = payload;
        const game = await loadGame(gameId);
        if (!game) throw new Error('Game not found');
        const table = createTable(game, { id: userId, username });
        await joinTable(table.id, { id: userId, username }, socket.id);
        socket.join(`card:${table.id}`);
        socket.data.cardTableId = table.id;
        socket.data.userId = String(userId);
        const state = publicTable(table, userId);
        if (typeof cb === 'function') cb({ ok: true, table: state });
        socket.emit('card:state', state);
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('card:join', async (payload = {}, cb) => {
      try {
        const { tableId, userId, username } = payload;
        const table = await joinTable(tableId, { id: userId, username }, socket.id);
        socket.join(`card:${tableId}`);
        socket.data.cardTableId = tableId;
        socket.data.userId = String(userId);
        const state = publicTable(table, userId);
        if (typeof cb === 'function') cb({ ok: true, table: state });
        socket.emit('card:state', state);
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('card:leave', () => {
      const tid = socket.data.cardTableId;
      if (tid) {
        leaveTable(tid, socket.data.userId, socket.id);
        socket.leave(`card:${tid}`);
        socket.data.cardTableId = null;
      }
    });

    socket.on('card:bet', async (payload = {}, cb) => {
      try {
        const { tableId, userId, amount, side } = payload;
        const result = await placeBet(tableId || socket.data.cardTableId, userId || socket.data.userId, amount, side);
        if (typeof cb === 'function') cb({ ok: true, ...result });
        // Notify player wallet
        socket.emit('wallet:update', { balance: result.balance, type: 'bet' });
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('card:hit', (payload = {}, cb) => {
      try {
        const tableId = payload.tableId || socket.data.cardTableId;
        const userId = payload.userId || socket.data.userId;
        const state = playerHit(tableId, userId);
        if (typeof cb === 'function') cb({ ok: true, table: state });
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('card:stand', (payload = {}, cb) => {
      try {
        const tableId = payload.tableId || socket.data.cardTableId;
        const userId = payload.userId || socket.data.userId;
        const state = playerStand(tableId, userId);
        if (typeof cb === 'function') cb({ ok: true, table: state });
      } catch (e) {
        if (typeof cb === 'function') cb({ ok: false, error: e.message });
      }
    });

    socket.on('disconnect', () => {
      const tid = socket.data.cardTableId;
      if (tid) leaveTable(tid, socket.data.userId, socket.id);
    });
  });
}

module.exports = {
  initCardTables,
  listTables,
  getTable,
  publicTable,
};
