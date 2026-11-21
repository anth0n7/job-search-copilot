import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { fetchErrors } from '../repositories/listings';
import { companyBoards, listings } from '../schema';
import { refreshRemotive } from './refreshRemotive';
import type { ParseResult } from './listing';

const feedWith = (...ids: string[]): ParseResult => ({
  skipped: 0,
  listings: ids.map((id) => ({ external_id: id, company_name: `Company ${id}`, title: 'Engineer', location: 'Remote', url: `https://remotive.com/j/${id}`, description_text: 'text', posted_at: null })),
});
const remotiveRow = async () => (await db.select().from(companyBoards).where(eq(companyBoards.provider, 'remotive')))[0]!;

describe('refreshRemotive', () => {
  it('stores the feed under a Remotive source row and keeps each listing\'s own company', async () => {
    const result = await refreshRemotive(async () => feedWith('1', '2'), vi.fn());

    expect(result).toMatchObject({ status: 'fetched', listingsSaved: 2 });
    expect((await db.select().from(listings)).map((l) => l.company_name).sort((a, b) => a!.localeCompare(b!))).toEqual(['Company 1', 'Company 2']);
  });

  it('refuses a second request within 6 hours without calling the feed', async () => {
    const feed = vi.fn(async () => feedWith('1'));
    await refreshRemotive(feed, vi.fn());

    const second = await refreshRemotive(feed, vi.fn());

    expect(second.status).toBe('too-soon');
    expect(feed).toHaveBeenCalledTimes(1);
  });

  it('records a fixed message and closes nothing when the fetch fails', async () => {
    await refreshRemotive(async () => feedWith('1'), vi.fn());
    await db.update(companyBoards).set({ last_attempt_at: null });

    const result = await refreshRemotive(async () => {
      throw new Error('detail that must not be stored');
    }, vi.fn());

    expect(result.status).toBe('failed');
    expect((await remotiveRow()).last_fetch_error).toBe(fetchErrors.unreachable);
    expect((await db.select().from(listings))[0]!.closed_at).toBeNull();
  });

  it('closes a listing that left the feed', async () => {
    await refreshRemotive(async () => feedWith('1', '2'), vi.fn());
    await db.update(companyBoards).set({ last_attempt_at: null });

    const result = await refreshRemotive(async () => feedWith('1'), vi.fn());

    expect(result.listingsClosed).toBe(1);
  });
});
