import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardUrl, fetchBoardJson } from './http';

// Only the network is faked. The helper's own rules (allow-list, redirects, size cap, retries) run for real.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

const GOOD_URL = 'https://boards-api.greenhouse.io/v1/boards/acme/jobs';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

describe('boardUrl', () => {
  it('builds the official API address for each provider', () => {
    expect(boardUrl('greenhouse', 'acme')).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true');
    expect(boardUrl('lever', 'acme')).toBe('https://api.lever.co/v0/postings/acme?mode=json');
    expect(boardUrl('ashby', 'acme')).toBe('https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=false');
  });

  // The token is put inside a URL, so anything that could change the host or path must be refused.
  it.each(['../evil', 'a.b', 'x@evil.com', 'a/b', 'Acme', '', 'a b', 'acme?x=1'])('rejects the board name %j', (token) => {
    expect(() => boardUrl('greenhouse', token)).toThrow();
  });
});

describe('fetchBoardJson (Remotive)', () => {
  it('accepts exactly Remotive\'s feed address and nothing else on remotive.com', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ jobs: [] }));
    await expect(fetchBoardJson('https://remotive.com/api/remote-jobs')).resolves.toEqual({ jobs: [] });

    for (const url of ['https://remotive.com/', 'https://remotive.com/api/remote-jobs/extra', 'https://remotive.com/api/remote-jobs?limit=5', 'https://remotive.com/other']) {
      await expect(fetchBoardJson(url)).rejects.toThrow('not an approved job board address');
    }
  });
});

describe('fetchBoardJson', () => {
  it('returns the parsed JSON on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ jobs: [] }));
    await expect(fetchBoardJson(GOOD_URL)).resolves.toEqual({ jobs: [] });
  });

  it.each([
    'http://boards-api.greenhouse.io/v1/boards/acme/jobs',
    'https://evil.example.com/v1/boards/acme/jobs',
    'https://boards-api.greenhouse.io.evil.com/v1/boards/acme/jobs',
    'https://user@evil.com@boards-api.greenhouse.io/x',
    'https://127.0.0.1/',
    'not a url',
  ])('refuses %s without making a request', async (url) => {
    await expect(fetchBoardJson(url)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Following a redirect would let an allowed host send us anywhere, so a redirect is an error.
  it('does not follow redirects', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));
    await expect(fetchBoardJson(GOOD_URL)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('rejects a reply larger than the size cap', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x'.repeat(2000)));
    await expect(fetchBoardJson(GOOD_URL, { maxBytes: 1000 })).rejects.toThrow(/too large/i);
  });

  // Real boards are big: Ashby's own board is 4.4 MB for 77 jobs, so the default cap must leave room above that.
  it('accepts a large real-world reply under the default cap', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: 'x'.repeat(6_000_000) })));
    await expect(fetchBoardJson(GOOD_URL)).resolves.toMatchObject({ text: expect.any(String) });
  });

  it('rejects a reply over the default cap', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: 'x'.repeat(16_000_000) })));
    await expect(fetchBoardJson(GOOD_URL)).rejects.toThrow(/too large/i);
  });

  it('gives up when the server never answers', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    await expect(fetchBoardJson(GOOD_URL, { timeoutMs: 20, retries: 0 })).rejects.toThrow();
  });

  it('retries a server error and then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 503 })).mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(fetchBoardJson(GOOD_URL, { retryDelayMs: 1 })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404 (the board name is wrong; asking again will not help)', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(fetchBoardJson(GOOD_URL, { retryDelayMs: 1 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
