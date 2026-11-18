import { describe, it, expect } from 'vitest';
import { toDateTimeLocalValue, fromDateTimeLocalValue, formatDate } from './dateUtils';

// the tests run with TZ=America/New_York (see vite.config.ts), where Nov 9 2026 is UTC-5
describe('date helpers', () => {
  it('turns a UTC timestamp into the local value a datetime-local input needs', () => {
    expect(toDateTimeLocalValue('2026-11-09T15:00:00.000Z')).toBe('2026-11-09T10:00');
    expect(toDateTimeLocalValue(null)).toBe('');
  });

  it('turns the input value back into the same UTC moment', () => {
    expect(fromDateTimeLocalValue('2026-11-09T10:00')).toBe('2026-11-09T15:00:00.000Z');
    expect(fromDateTimeLocalValue('')).toBeNull();
  });

  it('round trips without moving the time', () => {
    const iso = '2026-11-09T15:00:00.000Z';
    expect(fromDateTimeLocalValue(toDateTimeLocalValue(iso))).toBe(iso);
  });

  it('formats a plain date without shifting the day, and shows a dash for none', () => {
    expect(formatDate('2026-11-09')).toBe(new Date(2026, 10, 9).toLocaleDateString());
    expect(formatDate(null)).toBe('—');
  });
});
