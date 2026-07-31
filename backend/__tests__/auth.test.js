const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';

describe('JWT Auth Utility', () => {
  it('signs and verifies a token', () => {
    const token = jwt.sign({ userId: 1, role: 'player' }, SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.userId).toBe(1);
    expect(decoded.role).toBe('player');
  });

  it('rejects a tampered token', () => {
    const token = jwt.sign({ userId: 1 }, SECRET);
    expect(() => jwt.verify(token + 'x', SECRET)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ userId: 1 }, SECRET, { expiresIn: '-1s' });
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/);
  });
});
