import { errorCode } from '../errors';
import { listBoards, recordFetchFailure, saveBoardListings } from '../repositories/listings';
import { parseAshby } from './ashby';
import { parseGreenhouse } from './greenhouse';
import { boardUrl, fetchBoardJson, type Provider } from './http';
import type { ParseResult } from './listing';
import { parseLever } from './lever';

const parsers: Record<Provider, (raw: unknown) => ParseResult> = {
  greenhouse: parseGreenhouse,
  lever: parseLever,
  ashby: parseAshby,
};

export type FetchSummary = { boardsFetched: number; boardsFailed: number; listingsSaved: number; postingsSkipped: number };

// Visits every board one after another (a few seconds in total is fine, and it keeps the load on the
// providers low). A board that fails is recorded and skipped; it never stops the others.
// fetchJson is a parameter only so tests can run without the network.
export async function fetchAllBoards(
  fetchJson: (url: string) => Promise<unknown> = fetchBoardJson,
  log: (message: string) => void = console.error,
): Promise<FetchSummary> {
  const summary: FetchSummary = { boardsFetched: 0, boardsFailed: 0, listingsSaved: 0, postingsSkipped: 0 };

  for (const board of await listBoards()) {
    const label = `${board.provider}/${board.board_token}`;

    let raw: unknown;
    try {
      raw = await fetchJson(boardUrl(board.provider as Provider, board.board_token));
    } catch (err) {
      // Errors from the HTTP helper carry fixed text on purpose (see http.ts), so the message is safe to log.
      log(`${label}: fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      await recordFetchFailure(board.id, 'unreachable');
      summary.boardsFailed++;
      continue;
    }

    let parsed: ParseResult;
    try {
      parsed = parsers[board.provider as Provider](raw);
    } catch (err) {
      log(`${label}: reply not understood: ${err instanceof Error ? err.message : 'unknown error'}`);
      await recordFetchFailure(board.id, 'unreadable');
      summary.boardsFailed++;
      continue;
    }

    try {
      await saveBoardListings(board.id, parsed.listings);
    } catch (err) {
      // A database problem is not the board's fault, so the board's error message is left alone.
      // Only the code is logged: Drizzle's message can contain the row values.
      log(`${label}: saving failed (database error ${errorCode(err) ?? 'unknown'})`);
      summary.boardsFailed++;
      continue;
    }

    summary.boardsFetched++;
    summary.listingsSaved += parsed.listings.length;
    summary.postingsSkipped += parsed.skipped;
  }
  return summary;
}
