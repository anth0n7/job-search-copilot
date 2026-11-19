import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { NormalizedListing } from '../boards/listing';
import { db } from '../db';
import { errorCode } from '../errors';
import { companyBoards, listings } from '../schema';
import { addBoards, fetchErrors, recordFetchFailure, saveBoardListings } from './listings';

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
