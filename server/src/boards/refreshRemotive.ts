import { claimFetchSlot, ensureRemotiveBoard, recordFetchFailure, saveBoardListings } from '../repositories/listings';
import { errorCode } from '../errors';
import { fetchRemotive } from './remotive';
import type { ParseResult } from './listing';

// Remotive allows 4 requests a day. One request per run and 6 hours between runs keeps us at or under 4 even if the job
// is started by hand several times; the time of the last attempt is stored, so the limit survives restarts.
export const REMOTIVE_MIN_HOURS_BETWEEN_FETCHES = 6;

export type RemotiveSummary = { status: 'fetched' | 'too-soon' | 'failed'; listingsSaved: number; listingsClosed: number; closingSkipped: boolean };

// fetchFeed is a parameter only so tests run without the network.
export async function refreshRemotive(fetchFeed: () => Promise<ParseResult> = fetchRemotive, log: (message: string) => void = console.error): Promise<RemotiveSummary> {
  const none = { listingsSaved: 0, listingsClosed: 0, closingSkipped: false };
  const board = await ensureRemotiveBoard();

  if (!(await claimFetchSlot(board.id, REMOTIVE_MIN_HOURS_BETWEEN_FETCHES))) {
    log('remotive: fetched less than 6 hours ago, skipped');
    return { status: 'too-soon', ...none };
  }

  let parsed: ParseResult;
  try {
    parsed = await fetchFeed();
  } catch (err) {
    // Same fixed-message approach as the boards: the thrown text comes from our own helper and parser.
    log(`remotive: fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    await recordFetchFailure(board.id, 'unreachable');
    return { status: 'failed', ...none };
  }

  try {
    const saved = await saveBoardListings(board.id, parsed.listings);
    if (saved.closingSkipped) log(`remotive: reply looked incomplete (${parsed.listings.length} postings), nothing closed`);
    return { status: 'fetched', listingsSaved: parsed.listings.length, listingsClosed: saved.closed, closingSkipped: saved.closingSkipped };
  } catch (err) {
    log(`remotive: saving failed (database error ${errorCode(err) ?? 'unknown'})`);
    return { status: 'failed', ...none };
  }
}
