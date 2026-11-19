import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { fetchErrors } from '../repositories/listings';
import { companyBoards, listings } from '../schema';
import { fetchAllBoards } from './fetchAll';
import { boardUrl } from './http';

// Only the network is faked: the boards, the parsers and the saving all run for real.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

async function addBoard(provider: 'greenhouse' | 'lever' | 'ashby', board_token: string) {
  const [row] = await db.insert(companyBoards).values({ provider, board_token, company_name: board_token }).returning();
  return row!;
}
const boardRow = async (id: number) => (await db.select().from(companyBoards).where(eq(companyBoards.id, id)))[0]!;
const listingCount = async (board_id: number) => (await db.select().from(listings).where(eq(listings.board_id, board_id))).length;

describe('fetchAllBoards', () => {
  it('saves each board with the parser for its provider and reports the counts', async () => {
    const gh = await addBoard('greenhouse', 'acme');
    const lv = await addBoard('lever', 'globex');
    const replies: Record<string, unknown> = {
      [boardUrl('greenhouse', 'acme')]: fixture('greenhouse'),
      [boardUrl('lever', 'globex')]: fixture('lever'),
    };

    const summary = await fetchAllBoards(async (url) => replies[url], vi.fn());

    expect(summary).toMatchObject({ boardsFetched: 2, boardsFailed: 0, postingsSkipped: 0 });
    expect(await listingCount(gh.id)).toBe(3);
    expect(await listingCount(lv.id)).toBeGreaterThan(0);
    expect(summary.listingsSaved).toBe((await listingCount(gh.id)) + (await listingCount(lv.id)));
  });

  it('keeps going when one board fails, and stores only a fixed message for it', async () => {
    const broken = await addBoard('greenhouse', 'broken');
    const fine = await addBoard('lever', 'globex');
    const log = vi.fn();

    const summary = await fetchAllBoards(async (url) => {
      if (url === boardUrl('greenhouse', 'broken')) throw new Error('secret detail from the reply');
      return fixture('lever');
    }, log);

    expect(summary).toMatchObject({ boardsFetched: 1, boardsFailed: 1 });
    expect((await boardRow(broken.id)).last_fetch_error).toBe(fetchErrors.unreachable);
    expect(await listingCount(fine.id)).toBeGreaterThan(0);
  });

  it('records an unreadable reply differently from an unreachable board', async () => {
    const board = await addBoard('ashby', 'weird');

    const summary = await fetchAllBoards(async () => ({ not: 'a board' }), vi.fn());

    expect(summary.boardsFailed).toBe(1);
    expect((await boardRow(board.id)).last_fetch_error).toBe(fetchErrors.unreadable);
  });
});
