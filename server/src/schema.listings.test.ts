import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { errorCode } from './errors';
import { companyBoards, listings } from './schema';

// These are rules our own code relies on (re-fetches update a row instead of duplicating it,
// bad values never get stored), so they are tested against the real database.

const board = { provider: 'greenhouse', board_token: 'acme', company_name: 'Acme' };

async function addBoard(overrides: Partial<typeof board> = {}) {
  const [row] = await db
    .insert(companyBoards)
    .values({ ...board, ...overrides })
    .returning();
  return row!;
}

const listing = (board_id: number, overrides: Partial<typeof listings.$inferInsert> = {}) => ({
  board_id,
  external_id: '1',
  title: 'Engineer',
  url: 'https://example.com/jobs/1',
  description_text: 'Build things',
  ...overrides,
});

describe('company_boards rules', () => {
  it('allows the same board name on different providers but not twice on one', async () => {
    await addBoard();
    await addBoard({ provider: 'lever' });
    await expect(addBoard()).rejects.toSatisfy((e) => errorCode(e) === '23505');
  });

  it.each(['../evil', 'Acme', 'a.b', 'a b', ''])('refuses the board name %j', async (board_token) => {
    await expect(addBoard({ board_token })).rejects.toSatisfy((e) => errorCode(e) === '23514');
  });

  it('refuses an unknown provider', async () => {
    await expect(addBoard({ provider: 'workday' })).rejects.toSatisfy((e) => errorCode(e) === '23514');
  });
});

describe('listings rules', () => {
  it('stores one row per posting on a board', async () => {
    const b = await addBoard();
    await db.insert(listings).values(listing(b.id));
    await expect(db.insert(listings).values(listing(b.id))).rejects.toSatisfy((e) => errorCode(e) === '23505');
    // the same provider id on another board is a different posting
    const other = await addBoard({ board_token: 'other' });
    await db.insert(listings).values(listing(other.id));
  });

  it('only accepts https links', async () => {
    const b = await addBoard();
    for (const url of ['javascript:alert(1)', 'http://example.com/job', 'ftp://example.com']) {
      await expect(db.insert(listings).values(listing(b.id, { url }))).rejects.toSatisfy((e) => errorCode(e) === '23514');
    }
  });

  it('accepts a long job title but not an enormous one', async () => {
    const b = await addBoard();
    await db.insert(listings).values(listing(b.id, { title: 'x'.repeat(300) }));
    await expect(db.insert(listings).values(listing(b.id, { external_id: '2', title: 'x'.repeat(501) }))).rejects.toSatisfy(
      (e) => errorCode(e) === '23514',
    );
  });

  it('is deleted along with its board', async () => {
    const b = await addBoard();
    await db.insert(listings).values(listing(b.id));
    await db.delete(companyBoards).where(eq(companyBoards.id, b.id));
    expect(await db.select().from(listings)).toHaveLength(0);
  });
});
