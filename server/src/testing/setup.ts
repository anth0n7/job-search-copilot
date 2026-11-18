// Runs before every test file (see setupFiles in vitest.config.ts): the shared fake login and database reset.
import { beforeEach, afterAll, vi } from 'vitest';

// Fake Clerk: the x-test-user header decides who is "logged in", so no real sign-in is needed.
// This only exists in tests; nothing in the app reads that header.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => {
    const userId = req.headers['x-test-user'];
    return { userId, isAuthenticated: Boolean(userId) };
  },
}));

import { pool } from '../db';

// Before every test, put the test database back to a clean, known state.
beforeEach(async () => {
  // Safety net: this wipes every table, so refuse to run against anything but a test database
  const { rows } = await pool.query('SELECT current_database() AS db');
  if (!rows[0].db.endsWith('_test')) throw new Error(`Refusing to wipe database "${rows[0].db}"`);

  await pool.query('TRUNCATE companies, applications, contacts, interview_stages, resumes, company_boards, listings RESTART IDENTITY CASCADE');
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});
