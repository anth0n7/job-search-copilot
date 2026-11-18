import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Fake Clerk: pretend a user is signed in and hand out a fixed token
// Like the real Clerk, this hands back the same getToken function on every render
vi.mock('@clerk/react', () => {
  const auth = { getToken: async () => 'fake-token' };
  return { useAuth: () => auth };
});

import { useApi } from './useApi';

// Fake the server's reply so no real server is needed
function mockReply(status: number, body: string, contentType: string) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(body, { status, headers: { 'Content-Type': contentType } })
  ));
}

const callApi = () => renderHook(() => useApi()).result.current('/applications');

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('useApi identity', () => {
  it('returns the same function on every render, so effects can list it as a dependency', () => {
    const { result, rerender } = renderHook(() => useApi());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useApi error handling', () => {
  it('says the request was too large when the server replies with an HTML 413', async () => {
    mockReply(413, '<html>Payload Too Large</html>', 'text/html');
    await expect(callApi()).rejects.toThrow(/too large/i);
  });

  it('uses the error message from a JSON error reply', async () => {
    mockReply(400, JSON.stringify({ error: 'Name is required' }), 'application/json');
    await expect(callApi()).rejects.toThrow('Name is required');
  });

  it('falls back to a status message when the JSON has no error field', async () => {
    mockReply(500, JSON.stringify({}), 'application/json');
    await expect(callApi()).rejects.toThrow(/request failed \(500\)/i);
  });

  it("says it can't reach the server when the network fails", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(callApi()).rejects.toThrow(/can't reach the server/i);
  });
});
