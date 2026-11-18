import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGreenhouse } from './greenhouse';

// A real reply, trimmed to 3 jobs, with the descriptions replaced by invented text.
const fixture: { jobs: Record<string, unknown>[] } = JSON.parse(readFileSync(new URL('./fixtures/greenhouse.json', import.meta.url), 'utf8'));

describe('parseGreenhouse', () => {
  it('turns a reply into listings', () => {
    const { listings, skipped } = parseGreenhouse(fixture);
    expect(skipped).toBe(0);
    expect(listings).toHaveLength(3);
    expect(listings[0]).toMatchObject({
      external_id: '8351513',
      title: 'Account Executive',
      location: 'Singapore',
      url: 'https://careers.airbnb.com/positions/8351513?gh_jid=8351513',
    });
    expect(listings[0]?.posted_at).toEqual(new Date('2026-11-18T02:00:15Z'));
  });

  // Greenhouse sends its HTML escaped (&lt;div&gt;), so it has to be unescaped before it is turned into text.
  it('turns the escaped HTML description into plain text', () => {
    const text = parseGreenhouse(fixture).listings[0]!.description_text;
    expect(text).toContain('We are hiring a Account Executive.');
    expect(text).toContain('Python & SQL');
    expect(text).not.toMatch(/[<>]|&lt;|&amp;/);
  });

  // One bad posting must not throw away the rest of the board, and must not reach the database's CHECK rules.
  it('skips and counts postings that are unusable', () => {
    const good = fixture.jobs[0]!;
    const jobs = [
      good,
      { ...good, id: 2, title: '   ' },
      { ...good, id: 3, absolute_url: 'http://careers.example.com/3' },
      { ...good, id: 4, absolute_url: 'javascript:alert(1)' },
      { ...good, id: 5, title: undefined },
    ];
    const { listings, skipped } = parseGreenhouse({ jobs });
    expect(listings.map((l) => l.external_id)).toEqual(['8351513']);
    expect(skipped).toBe(4);
  });

  it('keeps a posting that has no location or date', () => {
    const job = { ...fixture.jobs[0]!, location: null, first_published: null };
    const [listing] = parseGreenhouse({ jobs: [job] }).listings;
    expect(listing).toMatchObject({ location: null, posted_at: null });
  });

  it('refuses a reply that is not a board', () => {
    expect(() => parseGreenhouse({ message: 'nope' })).toThrow();
    expect(() => parseGreenhouse(null)).toThrow();
  });
});
