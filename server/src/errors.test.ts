import { describe, it, expect, vi, afterEach } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Response } from 'express';
import { sendServerError } from './errors';

// A stand-in for Express's response that remembers what was sent
function fakeResponse() {
  const res = { statusCode: 0, body: undefined as unknown } as { statusCode: number; body: unknown; status: (c: number) => unknown; json: (b: unknown) => unknown };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

afterEach(() => vi.restoreAllMocks());

describe('sendServerError', () => {
  it('never writes the query values (resume text, names, notes) to the log', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Drizzle puts the query's values in the error message, e.g. "params: <the user's whole resume>"
    const err = new DrizzleQueryError('update "resumes" set "resume_text" = $1', ['MY SECRET RESUME TEXT'], new Error('connection terminated'));
    const res = fakeResponse();

    sendServerError(res as unknown as Response, err);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong on the server.' });
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain('MY SECRET RESUME TEXT');
  });

  it('finds the Postgres error code inside a Drizzle error', () => {
    const cause = Object.assign(new Error('duplicate key'), { code: '23505' });
    const res = fakeResponse();
    sendServerError(res as unknown as Response, new DrizzleQueryError('insert ...', [], cause));
    expect(res.statusCode).toBe(409);
  });
});
