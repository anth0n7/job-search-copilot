import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAshby } from './ashby';

const fixture: { jobs: Record<string, unknown>[] } = JSON.parse(readFileSync(new URL('./fixtures/ashby.json', import.meta.url), 'utf8'));

describe('parseAshby', () => {
  it('turns a reply into listings', () => {
    const { listings, skipped } = parseAshby(fixture);
    expect(skipped).toBe(0);
    expect(listings).toHaveLength(3);
    expect(listings[0]).toMatchObject({
      external_id: '7458d4e9-da2e-47bd-98cb-adfda43d42b2',
      title: 'Engineering Manager - EU',
      location: 'Remote - European Union',
      url: 'https://jobs.ashbyhq.com/Ashby/7458d4e9-da2e-47bd-98cb-adfda43d42b2',
      description_text: 'We are hiring a Engineering Manager - EU.\n\nRequirements\n- 3+ years of experience\n- Python & SQL',
    });
    expect(listings[0]?.posted_at).toEqual(new Date('2024-03-04T14:29:08.532Z'));
  });

  // An unlisted job is hidden on the company's own page, so it must not appear here either.
  // Skipping it is deliberate, not a failure, so it is not counted as "skipped".
  it('leaves out jobs that are not listed', () => {
    const { listings, skipped } = parseAshby({ jobs: [fixture.jobs[0], { ...fixture.jobs[1]!, isListed: false }] });
    expect(listings).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it('skips and counts postings that are unusable', () => {
    const good = fixture.jobs[0]!;
    const { listings, skipped } = parseAshby({
      jobs: [good, { ...good, id: 'b', title: ' ' }, { ...good, id: 'c', jobUrl: 'javascript:alert(1)' }, { ...good, id: 'd', jobUrl: undefined }],
    });
    expect(listings).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('keeps a posting that has no location or date', () => {
    const job = { ...fixture.jobs[0]!, location: null, publishedAt: null };
    expect(parseAshby({ jobs: [job] }).listings[0]).toMatchObject({ location: null, posted_at: null });
  });

  it('refuses a reply that is not a board', () => {
    expect(() => parseAshby({ error: 'nope' })).toThrow();
    expect(() => parseAshby([])).toThrow();
  });
});
