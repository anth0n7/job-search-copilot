import { BOARD_PROVIDERS } from '../schema';

// The only place the server fetches from company job boards. Every request passes through
// fetchBoardJson, so the safety rules (exact hosts, no redirects, timeout, size cap) live here once.

export { BOARD_PROVIDERS as PROVIDERS };
export type Provider = (typeof BOARD_PROVIDERS)[number];

// Exact host names, never "ends with": "boards-api.greenhouse.io.evil.com" must not pass.
const ALLOWED_HOSTS = new Set(['boards-api.greenhouse.io', 'api.lever.co', 'api.ashbyhq.com']);

// Remotive's one public endpoint. No parameters: the whole feed in one request.
export const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';

// The board name is pasted into a URL, so it must not be able to add a path, query or another host.
const BOARD_NAME = /^[a-z0-9_-]+$/;

export function boardUrl(provider: Provider, token: string): string {
  if (!BOARD_NAME.test(token)) throw new Error('Invalid board name');
  switch (provider) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${token}?mode=json`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=false`;
  }
}

function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  // Credentials in a URL ("https://x@evil.com@host") are a classic way to disguise the real host.
  // Remotive is allowed as one exact address, not as a host: its site has other pages, and a later ticket that fetches
  // user-supplied links must not be able to reach them through this helper.
  const isRemotiveFeed = url.hostname === 'remotive.com' && url.pathname === new URL(REMOTIVE_URL).pathname && url.search === '';
  if (url.protocol !== 'https:' || !(ALLOWED_HOSTS.has(url.hostname) || isRemotiveFeed) || url.username || url.password || url.port) {
    throw new Error('URL is not an approved job board address');
  }
  return url;
}

// Messages are fixed text on purpose: they get logged, and a reply body must not end up in logs.
class BoardFetchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export type FetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

const DEFAULTS = { maxBytes: 15_000_000, timeoutMs: 15_000, retries: 2, retryDelayMs: 1_000 };

export async function fetchBoardJson(rawUrl: string, options: FetchOptions = {}): Promise<unknown> {
  const { maxBytes, timeoutMs, retries, retryDelayMs } = { ...DEFAULTS, ...options };
  const url = assertAllowedUrl(rawUrl);

  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(url, maxBytes, timeoutMs);
    } catch (err) {
      const retryable = err instanceof BoardFetchError ? err.retryable : true; // network errors and timeouts
      if (!retryable || attempt >= retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
    }
  }
}

async function fetchOnce(url: URL, maxBytes: number, timeoutMs: number): Promise<unknown> {
  // "manual": an allowed host could redirect us anywhere, so we never follow one.
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });

  if (res.status >= 300 && res.status < 400) throw new BoardFetchError('Board redirected', false);
  if (res.status === 429 || res.status >= 500) throw new BoardFetchError(`Board answered ${res.status}`, true);
  if (!res.ok) throw new BoardFetchError(`Board answered ${res.status}`, false);

  const text = await readCapped(res, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new BoardFetchError('Board reply was not JSON', false);
  }
}

// Stops reading as soon as the cap is passed, so a huge reply is never held in memory.
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) throw new BoardFetchError('Board reply too large', false);
  if (!res.body) return '';

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BoardFetchError('Board reply too large', false);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
