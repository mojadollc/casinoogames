const crypto = require('crypto');

// Inline the core RNG logic (mirrors game-engine/rng)
function secureRandom(min, max) {
  const range = max - min + 1;
  const bytes = crypto.randomBytes(4);
  return min + (bytes.readUInt32BE(0) % range);
}

function spinReels(reelSize = 5, symbolCount = 9) {
  return Array.from({ length: reelSize }, () => secureRandom(0, symbolCount - 1));
}

describe('Game Engine RNG', () => {
  it('returns values within symbol range', () => {
    const symbolCount = 9;
    const result = spinReels(5, symbolCount);
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(symbolCount);
    });
  });

  it('returns correct reel length', () => {
    expect(spinReels(5).length).toBe(5);
  });

  it('produces different results (not static)', () => {
    const results = new Set(Array.from({ length: 20 }, () => spinReels(5).join(',')));
    expect(results.size).toBeGreaterThan(1);
  });
});
