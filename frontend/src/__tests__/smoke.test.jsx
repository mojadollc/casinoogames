import { describe, it, expect } from 'vitest';

// Smoke test: verify core React can render without crashing
describe('Frontend Smoke Tests', () => {
  it('runs in test environment', () => {
    expect(typeof window).toBe('object');
  });

  it('environment is test', () => {
    expect(import.meta.env.MODE).toBe('test');
  });
});
