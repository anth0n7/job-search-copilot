import { eq, sql } from 'drizzle-orm';
import type { NormalizedListing } from '../boards/listing';
import { db } from '../db';
import { BOARD_PROVIDERS, companyBoards, listings } from '../schema';

// SHARED DATA: company_boards and listings have no user_id (every user sees the same listings), so unlike
// every other repository the functions here take no userId and nothing scopes them to a user. They are for
// the fetch job only and must never be called from a route; the lint rule in .oxlintrc.json enforces that.

// The only texts that can land in company_boards.last_fetch_error. A fixed list, so raw error text
// (which can quote the provider's reply or a URL) can never be stored by accident.
export const fetchErrors = {
  unreachable: 'The board could not be fetched',
  unreadable: 'The board reply was not understood',
} as const;

// Every board the fetch job should visit, oldest first.
export async function listBoards() {
  return db
    .select({ id: companyBoards.id, provider: companyBoards.provider, board_token: companyBoards.board_token, company_name: companyBoards.company_name })
    .from(companyBoards)
    .orderBy(companyBoards.id);
}

// Adds boards, or corrects the company name of one already there. Safe to run again with the same list.
// The database rules (provider list, lowercase board name) reject a bad entry and the whole call with it.
export async function addBoards(boards: { provider: (typeof BOARD_PROVIDERS)[number]; board_token: string; company_name: string }[]) {
  if (boards.length === 0) return;
  await db
    .insert(companyBoards)
    .values(boards)
    .onConflictDoUpdate({ target: [companyBoards.provider, companyBoards.board_token], set: { company_name: sql`excluded.company_name` } });
}

// One insert statement is limited to 65,535 values (about 8,000 rows of 8 columns) and boards can hold
// thousands of long descriptions, so rows go in smaller groups, all inside one transaction.
const CHUNK_SIZE = 200;

// Stores a board's listings and marks the board as fetched, in one transaction: if saving fails nothing
// is kept, so a board never looks fresh while its listings are missing.
export async function saveBoardListings(boardId: number, fetched: NormalizedListing[]) {
  // The same id twice in one insert makes Postgres refuse the statement; the last copy wins.
  const byExternalId = new Map(fetched.map((item) => [item.external_id, item]));
  const rows = [...byExternalId.values()].map((item) => ({ ...item, board_id: boardId }));

  await db.transaction(async (tx) => {
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      await tx
        .insert(listings)
        .values(rows.slice(start, start + CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [listings.board_id, listings.external_id],
          // Only what the provider controls. first_seen_at and closed_at are deliberately not touched
          // (closing and reopening postings is a later ticket). excluded.* is the row we tried to insert.
          set: {
            title: sql`excluded.title`,
            location: sql`excluded.location`,
            url: sql`excluded.url`,
            description_text: sql`excluded.description_text`,
            posted_at: sql`excluded.posted_at`,
            last_seen_at: sql`now()`,
          },
        });
    }
    await tx.update(companyBoards).set({ last_fetched_at: sql`now()`, last_fetch_error: null }).where(eq(companyBoards.id, boardId));
  });
}

// Takes a key into fetchErrors, not text, so nothing but the fixed messages can be written.
export async function recordFetchFailure(boardId: number, reason: keyof typeof fetchErrors) {
  await db.update(companyBoards).set({ last_fetch_error: fetchErrors[reason] }).where(eq(companyBoards.id, boardId));
}
