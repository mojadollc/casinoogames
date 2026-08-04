/**
 * Multiplayer sync for fishing (and extensible game rooms).
 * Server-authoritative fish school per gameId room.
 */
const FISH_DEFS = [
  { type: 'small',  emoji: '🐟', label: 'Sardine',    speed: 2.8, size: 28, maxHp: 1,  weight: 40, color: '#4FC3F7' },
  { type: 'medium', emoji: '🐠', label: 'Clownfish',  speed: 2.2, size: 36, maxHp: 2,  weight: 25, color: '#FF8A65' },
  { type: 'large',  emoji: '🐡', label: 'Blowfish',   speed: 1.6, size: 42, maxHp: 3,  weight: 15, color: '#FFD54F' },
  { type: 'shark',  emoji: '🦈', label: 'Shark',      speed: 1.4, size: 52, maxHp: 5,  weight: 10, color: '#90A4AE' },
  { type: 'whale',  emoji: '🐋', label: 'Whale',      speed: 0.9, size: 64, maxHp: 8,  weight: 7,  color: '#5C6BC0' },
  { type: 'dragon', emoji: '🐉', label: 'Sea Dragon', speed: 0.7, size: 72, maxHp: 12, weight: 3,  color: '#FFD700' },
];

const rooms = new Map(); // gameId -> room
let fishSeq = 1;
let ioRef = null;

function pickDef() {
  const total = FISH_DEFS.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH_DEFS) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return FISH_DEFS[0];
}

function spawnFish() {
  const def = pickDef();
  const fromLeft = Math.random() > 0.5;
  return {
    id: `f${fishSeq++}`,
    type: def.type,
    emoji: def.emoji,
    label: def.label,
    color: def.color,
    size: def.size + Math.random() * 6,
    speed: def.speed * (0.85 + Math.random() * 0.3),
    maxHp: def.maxHp,
    hp: def.maxHp,
    x: fromLeft ? -8 : 108,
    y: 12 + Math.random() * 68,
    dir: fromLeft ? 1 : -1,
    wobble: Math.random() * Math.PI * 2,
  };
}

function getRoom(gameId) {
  if (!rooms.has(gameId)) {
    const fishes = [];
    for (let i = 0; i < 8; i++) fishes.push(spawnFish());
    rooms.set(gameId, {
      gameId,
      players: new Map(), // socketId -> { userId, username }
      fishes,
      tick: null,
      spawnAcc: 0,
    });
  }
  return rooms.get(gameId);
}

function playerList(room) {
  const seen = new Set();
  const list = [];
  for (const p of room.players.values()) {
    if (seen.has(p.userId)) continue;
    seen.add(p.userId);
    list.push({ userId: p.userId, username: p.username });
  }
  return list;
}

function broadcastState(room) {
  if (!ioRef) return;
  ioRef.to(`fishing:${room.gameId}`).emit('fishing:state', {
    fishes: room.fishes,
    players: playerList(room),
    ts: Date.now(),
  });
}

function tickRoom(room) {
  // Move
  room.fishes = room.fishes
    .map(f => ({
      ...f,
      x: f.x + f.dir * f.speed * 0.55,
      wobble: f.wobble + 0.08,
      y: Math.max(8, Math.min(88, f.y + Math.sin(f.wobble) * 0.15)),
    }))
    .filter(f => f.x > -12 && f.x < 112 && f.hp > 0);

  // Spawn
  room.spawnAcc += 1;
  if (room.spawnAcc >= 10 && room.fishes.length < 16) { // ~1s at 100ms tick
    room.spawnAcc = 0;
    room.fishes.push(spawnFish());
  }

  broadcastState(room);
}

function ensureTicker(room) {
  if (room.tick) return;
  room.tick = setInterval(() => tickRoom(room), 100);
}

function stopTickerIfEmpty(room) {
  if (room.players.size === 0) {
    if (room.tick) clearInterval(room.tick);
    room.tick = null;
    rooms.delete(room.gameId);
  }
}

/**
 * Wire Socket.IO multiplayer handlers. Call once from server.js.
 */
function initMultiplayer(io) {
  ioRef = io;

  io.on('connection', (socket) => {
    socket.on('fishing:join', (payload = {}) => {
      const { gameId, userId, username } = payload;
      if (!gameId || !userId) return;

      const room = getRoom(String(gameId));
      // Leave previous fishing rooms for this socket
      for (const [gid, r] of rooms) {
        if (r.players.has(socket.id)) {
          r.players.delete(socket.id);
          socket.leave(`fishing:${gid}`);
          io.to(`fishing:${gid}`).emit('fishing:player_left', {
            userId,
            players: playerList(r),
          });
          stopTickerIfEmpty(r);
        }
      }

      room.players.set(socket.id, {
        userId: String(userId),
        username: username || 'Player',
      });
      socket.join(`fishing:${gameId}`);
      socket.data.fishingGameId = String(gameId);
      socket.data.userId = String(userId);
      ensureTicker(room);

      socket.emit('fishing:state', {
        fishes: room.fishes,
        players: playerList(room),
        ts: Date.now(),
      });
      socket.to(`fishing:${gameId}`).emit('fishing:player_joined', {
        userId: String(userId),
        username: username || 'Player',
        players: playerList(room),
      });
    });

    socket.on('fishing:leave', () => {
      leaveFishing(socket);
    });

    socket.on('disconnect', () => {
      leaveFishing(socket);
    });
  });
}

function leaveFishing(socket) {
  const gameId = socket.data?.fishingGameId;
  if (!gameId) return;
  const room = rooms.get(gameId);
  if (!room) return;
  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  socket.leave(`fishing:${gameId}`);
  if (player) {
    ioRef?.to(`fishing:${gameId}`).emit('fishing:player_left', {
      userId: player.userId,
      players: playerList(room),
    });
  }
  stopTickerIfEmpty(room);
  socket.data.fishingGameId = null;
}

/**
 * Called after a successful fishing hit — remove a fish and notify room.
 * Prefer matching by type if fishId not in shared school.
 */
function notifyFishingCatch({ gameId, userId, username, fish, totalWin, fishId }) {
  if (!ioRef || !gameId) return;
  const room = rooms.get(String(gameId));
  let removed = null;
  if (room) {
    if (fishId && room.fishes.some(f => f.id === fishId)) {
      removed = room.fishes.find(f => f.id === fishId);
      room.fishes = room.fishes.filter(f => f.id !== fishId);
    } else if (fish?.emoji) {
      // Remove one matching type/emoji
      const idx = room.fishes.findIndex(f => f.emoji === fish.emoji || f.type === fish.type);
      if (idx >= 0) {
        removed = room.fishes[idx];
        room.fishes.splice(idx, 1);
      }
    }
    broadcastState(room);
  }

  ioRef.to(`fishing:${gameId}`).emit('fishing:catch', {
    userId: String(userId),
    username: username || 'Player',
    fish: fish || removed,
    totalWin: totalWin || 0,
    fishId: removed?.id || fishId || null,
    ts: Date.now(),
  });
}

/**
 * Optional: broadcast big wins / live activity to lobby watchers
 */
function notifyGameEvent(event, payload) {
  if (!ioRef) return;
  ioRef.emit('game:activity', { event, ...payload, ts: Date.now() });
}

module.exports = {
  initMultiplayer,
  notifyFishingCatch,
  notifyGameEvent,
  getRoom,
};
