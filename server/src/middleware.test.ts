import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { currentUserId } from './middleware';

// The fake Clerk in testing/setup.ts reads the x-test-user header
const requestFrom = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

describe('currentUserId', () => {
  it('returns the signed-in user id', () => {
    expect(currentUserId(requestFrom({ 'x-test-user': 'user_A' }))).toBe('user_A');
  });

  it('throws instead of continuing when nobody is signed in', () => {
    expect(() => currentUserId(requestFrom({}))).toThrow(/signed-in user/);
  });
});
