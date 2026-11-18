import { describe, it, expect } from 'vitest';
import { normalizeWebsite } from './urlUtils';

describe('normalizeWebsite', () => {
  it('adds https:// when the protocol is missing', () => {
    expect(normalizeWebsite('acme.com')).toBe('https://acme.com');
  });
  it('leaves http and https links alone', () => {
    expect(normalizeWebsite('https://acme.com')).toBe('https://acme.com');
    expect(normalizeWebsite('http://acme.com')).toBe('http://acme.com');
  });
  it('returns undefined for empty values so no link is made', () => {
    expect(normalizeWebsite(null)).toBeUndefined();
    expect(normalizeWebsite('  ')).toBeUndefined();
  });
});
