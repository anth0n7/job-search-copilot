import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { NormalizedListing } from '../boards/listing';
import { db } from '../db';
import { errorCode } from '../errors';
import { companyBoards, listings } from '../schema';
import { addBoards, claimFetchSlot, fetchErrors, markDuplicates, recordFetchFailure, saveBoardListings } from './listings';

async function addBoard(board_token = 'acme') {
  const [row] = await db.insert(companyBoards).values({ provider: 'greenhouse', board_token, company_name: 'Acme' }).returning();
  return row!;
}

const posting = (external_id: string, overrides: Partial<NormalizedListing> = {}): NormalizedListing => ({
  external_id,
  title: `Engineer ${external_id}`,
  location: null,
  url: `https://example.com/jobs/${external_id}`,
  description_text: 'Build things',
  posted_at: null,
  ...overrides,
});

const rowsFor = (board_id: number) => db.select().from(listings).where(eq(listings.board_id, board_id));
const boardRow = async (id: number) => (await db.select().from(companyBoards).where(eq(companyBoards.id, id)))[0]!;

describe('saveBoardListings', () => {
  it('stores new listings and marks the board as fetched', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1'), posting('2')]);

    expect(await rowsFor(board.id)).toHaveLength(2);
    expect((await boardRow(board.id)).last_fetched_at).not.toBeNull();
  });

  it('updates a posting it already has instead of duplicating it', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1')]);
    const [first] = await rowsFor(board.id);

    await saveBoardListings(board.id, [posting('1', { title: 'Senior Engineer' })]);
    const rows = await rowsFor(board.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('Senior Engineer');
    expect(rows[0]!.first_seen_at).toEqual(first!.first_seen_at);
    expect(rows[0]!.last_seen_at.getTime()).toBeGreaterThan(first!.last_seen_at.getTime());
  });

  it('keeps the same posting id on two boards as two listings', async () => {
    const a = await addBoard('acme');
    const b = await addBoard('globex');
    await saveBoardListings(a.id, [posting('1')]);
    await saveBoardListings(b.id, [posting('1')]);

    expect(await rowsFor(a.id)).toHaveLength(1);
    expect(await rowsFor(b.id)).toHaveLength(1);
  });

  it('copes with a provider sending the same id twice in one reply', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1', { title: 'Old' }), posting('1', { title: 'New' })]);

    const rows = await rowsFor(board.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('New');
  });

  it('saves a board with more postings than fit in one statement', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, Array.from({ length: 450 }, (_, i) => posting(String(i))));

    expect(await rowsFor(board.id)).toHaveLength(450);
  });

  it('saves nothing and does not mark the board fetched when one posting breaks a database rule', async () => {
    const board = await addBoard();
    const bad = posting('2', { url: 'http://example.com/not-https' });

    await expect(saveBoardListings(board.id, [posting('1'), bad])).rejects.toSatisfy((e) => errorCode(e) === '23514');

    expect(await rowsFor(board.id)).toHaveLength(0);
    expect((await boardRow(board.id)).last_fetched_at).toBeNull();
  });
});

describe('recordFetchFailure', () => {
  it('stores a fixed message, leaves listings alone, and a later success clears it', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1')]);

    await recordFetchFailure(board.id, 'unreachable');
    expect((await boardRow(board.id)).last_fetch_error).toBe(fetchErrors.unreachable);
    expect(await rowsFor(board.id)).toHaveLength(1);

    await saveBoardListings(board.id, [posting('1')]);
    expect((await boardRow(board.id)).last_fetch_error).toBeNull();
  });
});

describe('addBoards', () => {
  it('can be run again without duplicating boards, and picks up a corrected company name', async () => {
    const board = { provider: 'greenhouse' as const, board_token: 'acme', company_name: 'Acme' };
    await addBoards([board]);
    await addBoards([{ ...board, company_name: 'Acme Inc' }]);

    const rows = await db.select().from(companyBoards);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.company_name).toBe('Acme Inc');
  });
});

const many = (count: number) => Array.from({ length: count }, (_, i) => posting(String(i)));
const rowByExternalId = async (board_id: number, external_id: string) => (await rowsFor(board_id)).find((r) => r.external_id === external_id)!;

describe('closing listings that disappeared', () => {
  it('closes a listing missing from a later fetch and keeps the ones still there', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1'), posting('2'), posting('3')]);

    const result = await saveBoardListings(board.id, [posting('1'), posting('3')]);

    expect(result).toEqual({ closed: 1, closingSkipped: false });
    expect((await rowByExternalId(board.id, '2')).closed_at).not.toBeNull();
    expect((await rowByExternalId(board.id, '1')).closed_at).toBeNull();
  });

  it('does not touch the closing time of a listing that is already closed, or another board', async () => {
    const board = await addBoard('acme');
    const other = await addBoard('globex');
    await saveBoardListings(board.id, [posting('1'), posting('2')]);
    await saveBoardListings(other.id, [posting('1')]);
    await saveBoardListings(board.id, [posting('1')]);
    const closedAt = (await rowByExternalId(board.id, '2')).closed_at;

    await saveBoardListings(board.id, [posting('1')]);

    expect((await rowByExternalId(board.id, '2')).closed_at).toEqual(closedAt);
    expect((await rowByExternalId(other.id, '1')).closed_at).toBeNull();
  });

  // Decision (ticket 5): a posting that is on the board again is open again.
  it('reopens a closed listing when it shows up again', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, [posting('1'), posting('2')]);
    await saveBoardListings(board.id, [posting('1')]);

    await saveBoardListings(board.id, [posting('1'), posting('2')]);

    expect((await rowByExternalId(board.id, '2')).closed_at).toBeNull();
  });

  // Safety rule: a broken reply must not make every job look closed.
  it('never closes anything when the board answers with no postings', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, many(3));

    const result = await saveBoardListings(board.id, []);

    expect(result).toEqual({ closed: 0, closingSkipped: true });
    expect((await rowsFor(board.id)).filter((r) => r.closed_at)).toHaveLength(0);
    expect((await boardRow(board.id)).last_fetch_error).toBe(fetchErrors.incomplete);
  });

  it('closes nothing when a board of 10 or more shrinks by more than half, but still saves what it sent', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, many(20));

    const result = await saveBoardListings(board.id, [...many(5), posting('new')]);

    expect(result).toEqual({ closed: 0, closingSkipped: true });
    expect((await rowsFor(board.id)).filter((r) => r.closed_at)).toHaveLength(0);
    expect(await rowsFor(board.id)).toHaveLength(21);
    expect((await boardRow(board.id)).last_fetch_error).toBe(fetchErrors.incomplete);
  });

  it('closes a drop of exactly half, and a later normal fetch clears the warning', async () => {
    const board = await addBoard();
    await saveBoardListings(board.id, many(20));
    await saveBoardListings(board.id, many(5));

    const result = await saveBoardListings(board.id, many(10));

    expect(result.closingSkipped).toBe(false);
    expect((await boardRow(board.id)).last_fetch_error).toBeNull();
  });

  it('stores the company name a source sends with a listing', async () => {
    const board = await addBoard('remotive');
    await saveBoardListings(board.id, [posting('1', { company_name: 'Globex' })]);

    expect((await rowByExternalId(board.id, '1')).company_name).toBe('Globex');
  });
});

describe('claimFetchSlot', () => {
  it('grants a slot once, then refuses until enough time has passed', async () => {
    const board = await addBoard();

    expect(await claimFetchSlot(board.id, 6)).toBe(true);
    expect(await claimFetchSlot(board.id, 6)).toBe(false);

    await db.update(companyBoards).set({ last_attempt_at: new Date(Date.now() - 7 * 3_600_000) }).where(eq(companyBoards.id, board.id));
    expect(await claimFetchSlot(board.id, 6)).toBe(true);
  });
});

describe('markDuplicates', () => {
  async function setup() {
    const [gh] = await db.insert(companyBoards).values({ provider: 'greenhouse', board_token: 'acme', company_name: 'Acme Corp' }).returning();
    const [rem] = await db.insert(companyBoards).values({ provider: 'remotive', board_token: 'remotive', company_name: 'Remotive' }).returning();
    return { gh: gh!, rem: rem! };
  }

  it('points a Remotive listing at the company board listing with the same company, title and location', async () => {
    const { gh, rem } = await setup();
    await saveBoardListings(gh.id, [posting('1', { title: 'Backend Engineer', location: 'Remote - USA' })]);
    await saveBoardListings(rem.id, [
      posting('r1', { company_name: '  ACME   corp', title: 'backend  engineer', location: 'remote - usa' }),
      posting('r2', { company_name: 'Acme Corp', title: 'Designer', location: 'Remote - USA' }),
    ]);

    await markDuplicates();

    const boardRowId = (await rowByExternalId(gh.id, '1')).id;
    expect((await rowByExternalId(rem.id, 'r1')).duplicate_of).toBe(boardRowId);
    expect((await rowByExternalId(rem.id, 'r2')).duplicate_of).toBeNull();
    expect((await rowByExternalId(gh.id, '1')).duplicate_of).toBeNull();
  });

  it('treats a missing location as its own value, and lets go when the board listing closes', async () => {
    const { gh, rem } = await setup();
    await saveBoardListings(gh.id, [posting('1', { title: 'Engineer', location: null }), posting('2', { title: 'Other', location: null })]);
    await saveBoardListings(rem.id, [posting('r1', { company_name: 'Acme Corp', title: 'Engineer', location: null })]);
    await markDuplicates();
    expect((await rowByExternalId(rem.id, 'r1')).duplicate_of).not.toBeNull();

    await saveBoardListings(gh.id, [posting('2', { title: 'Other', location: null })]);
    await markDuplicates();

    expect((await rowByExternalId(rem.id, 'r1')).duplicate_of).toBeNull();
  });
});
