#!/usr/bin/env node
/**
 * Smoke test against a running API (default http://localhost:3020/api)
 *
 * Usage:
 *   API_URL=http://localhost:3020/api node scripts/smoke-test.js
 *
 * Requires seeded demo accounts:
 *   admin@casino.com / admin123
 *   player@casino.com / player123
 */
const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3020/api';
const client = axios.create({ baseURL: API, validateStatus: () => true, timeout: 15000 });

let passed = 0;
let failed = 0;

const ok = (name) => { passed++; console.log(`  ✅ ${name}`); };
const fail = (name, detail) => { failed++; console.log(`  ❌ ${name}: ${detail}`); };

async function step(title, fn) {
  console.log(`\n▸ ${title}`);
  try {
    await fn();
  } catch (e) {
    fail(title, e.message);
  }
}

async function main() {
  console.log(`Smoke testing ${API}`);

  let playerToken = null;
  let adminToken = null;
  let gameId = null;

  await step('Health', async () => {
    const base = API.replace(/\/api\/?$/, '');
    const r = await axios.get(`${base}/health`, { timeout: 5000, validateStatus: () => true });
    if (r.status === 200 && r.data?.status === 'ok') ok('GET /health');
    else fail('GET /health', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Player login', async () => {
    const r = await client.post('/auth/login', { email: 'player@casino.com', password: 'player123' });
    if (r.status === 200 && r.data.token) {
      playerToken = r.data.token;
      ok('player login');
    } else fail('player login', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Admin login', async () => {
    const r = await client.post('/auth/login', { email: 'admin@casino.com', password: 'admin123' });
    if (r.status === 200 && r.data.token) {
      adminToken = r.data.token;
      ok('admin login');
    } else fail('admin login', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Wallet balance', async () => {
    const r = await client.get('/wallet/balance', { headers: { Authorization: `Bearer ${playerToken}` } });
    if (r.status === 200 && r.data.balance != null) ok(`balance ₱${r.data.balance}`);
    else fail('balance', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Games list', async () => {
    const r = await client.get('/games');
    if (r.status === 200 && Array.isArray(r.data) && r.data.length) {
      gameId = r.data.find((g) => (g.type || '').includes('slot'))?.id || r.data[0].id;
      ok(`${r.data.length} games, sample=${gameId}`);
    } else fail('games', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Slot spin (may fail if insufficient balance)', async () => {
    if (!gameId || !playerToken) return fail('spin', 'missing game/token');
    const r = await client.post(
      `/games/${gameId}/spin`,
      { betAmount: 1 },
      { headers: { Authorization: `Bearer ${playerToken}` } }
    );
    if (r.status === 200 && r.data.grid) ok(`spin totalWin=${r.data.totalWin}`);
    else if (r.status === 400 && /balance|Bet/i.test(r.data?.error || '')) ok(`spin blocked as expected: ${r.data.error}`);
    else fail('spin', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Table play endpoint', async () => {
    const games = await client.get('/games');
    const card = (games.data || []).find((g) => g.slug === 'blackjack-vip' || g.type === 'card');
    if (!card) return ok('no card game seeded — skip');
    const r = await client.post(
      `/games/${card.id}/play`,
      { betAmount: card.min_bet || 10 },
      { headers: { Authorization: `Bearer ${playerToken}` } }
    );
    if (r.status === 200 && r.data.outcome) ok(`play outcome=${r.data.outcome} win=${r.data.totalWin}`);
    else if (r.status === 400) ok(`play rejected: ${r.data?.error}`);
    else fail('play', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Promotions daily-login', async () => {
    const r = await client.post('/promotions/daily-login', {}, { headers: { Authorization: `Bearer ${playerToken}` } });
    if (r.status === 200 || (r.status === 400 && /Already claimed/i.test(r.data?.error || ''))) {
      ok(r.status === 200 ? `claimed ₱${r.data.amount}` : 'already claimed');
    } else fail('daily-login', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Admin dashboard', async () => {
    const r = await client.get('/admin/dashboard', { headers: { Authorization: `Bearer ${adminToken}` } });
    if (r.status === 200) ok('dashboard loaded');
    else fail('dashboard', `${r.status} ${JSON.stringify(r.data)}`);
  });

  await step('Invalid credentials rejected', async () => {
    const r = await client.post('/auth/login', { email: 'player@casino.com', password: 'wrong-password' });
    if (r.status === 401) ok('bad password rejected');
    else fail('bad password', `${r.status}`);
  });

  console.log(`\n──────────────\nPassed: ${passed}  Failed: ${failed}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
