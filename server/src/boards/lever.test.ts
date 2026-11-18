import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLever } from './lever';

const fixture: Record<string, unknown>[] = JSON.parse(readFileSync(new URL('./fixtures/lever.json', import.meta.url), 'utf8'));

describe('parseLever', () => {
  it('turns a reply into listings', () => {
    const { listings, skipped } = parseLever(fixture);
    expect(skipped).toBe(0);
    expect(listings).toHaveLength(3);
    expect(listings[0]).toMatchObject({
      external_id: 'ad208490-4052-4f91-a57e-433f2d1e484b',
      title: 'Customer Success Manager',
      location: 'Atlanta, Georgia',
      url: 'https://jobs.lever.co/leverdemo/ad208490-4052-4f91-a57e-433f2d1e484b',
    });
    // Lever sends the posting time as milliseconds since 1970
    expect(listings[0]?.posted_at).toEqual(new Date(1788199939703));
  });

  // Lever's plain description is only the intro; the requirements live in `lists`, and scoring needs them.
  it('puts the intro, the requirement lists and the closing text into one description', () => {
    const job = { ...fixture[0]!, additionalPlain: 'We are an equal opportunity employer.' };
    const text = parseLever([job]).listings[0]!.description_text;
    expect(text).toContain('We are hiring a Customer Success Manager.');
    expect(text).toContain('Skill Set:');
    expect(text).toContain('Invented list item');
    expect(text).toContain('We are an equal opportunity employer.');
    expect(text).not.toMatch(/[<>]/);
  });

  it('skips and counts postings that are unusable', () => {
    const good = fixture[0]!;
    const { listings, skipped } = parseLever([
      good,
      { ...good, id: 'b', text: '' },
      { ...good, id: 'c', hostedUrl: 'http://jobs.lever.co/x/c' },
      { ...good, id: 'd', id_missing: true, hostedUrl: undefined },
    ]);
    expect(listings).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('keeps a posting that has no location, date or lists', () => {
    const job = { ...fixture[0]!, categories: {}, createdAt: null, lists: undefined, additionalPlain: undefined };
    expect(parseLever([job]).listings[0]).toMatchObject({ location: null, posted_at: null });
  });

  it('refuses a reply that is not a list of postings', () => {
    expect(() => parseLever({ message: 'Not found' })).toThrow();
    expect(() => parseLever('nope')).toThrow();
  });
});
