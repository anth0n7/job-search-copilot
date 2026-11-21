import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fetchRemotive, parseRemotive } from './remotive';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/remotive.json', import.meta.url), 'utf8'));

describe('parseRemotive', () => {
  it('turns a reply into listings that carry their own company name', () => {
    const { listings, skipped } = parseRemotive(fixture);

    expect(listings).toHaveLength(2);
    // The http link and the posting with no url/company are unusable and counted, not silently dropped.
    expect(skipped).toBe(2);
    expect(listings[0]).toMatchObject({
      external_id: '1901234',
      company_name: 'Acme Corp',
      title: 'Senior Backend Engineer',
      location: 'Remote - USA',
      url: 'https://remotive.com/remote-jobs/software-dev/senior-backend-engineer-1901234',
    });
    expect(listings[0]?.description_text).toContain('5+ years of Python');
    expect(listings[0]?.description_text).not.toMatch(/[<>]/);
    expect(listings[0]?.posted_at).toBeInstanceOf(Date);
  });

  it('calls a posting with no location restriction plain "Remote"', () => {
    expect(parseRemotive(fixture).listings[1]?.location).toBe('Remote');
  });

  it('throws a fixed message for a reply that is not a Remotive feed', () => {
    expect(() => parseRemotive({ jobs: 'nope' })).toThrow('Remotive reply was not a job feed');
  });
});

// Remotive allows 4 requests a day, and a retry is a request, so a failing feed must be asked exactly once.
describe('fetchRemotive', () => {
  it('asks the feed once even when it answers with a server error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(fetchRemotive()).rejects.toThrow('Board answered 503');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toBe('https://remotive.com/api/remote-jobs');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
