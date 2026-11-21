import { and, eq, isNull, lt, ne, sql } from 'drizzle-orm';
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
  incomplete: 'The board reply looked incomplete, so no listings were closed',
} as const;

// Safety rule for closing (see saveBoardListings): below this many open listings a board is too small for a
// percentage to mean anything, so only an empty reply is treated as suspicious.
const MIN_OPEN_FOR_DROP_CHECK = 10;

// Every company board the fetch job should visit, oldest first. Remotive is excluded: it has its own fetcher.
export async function listBoards() {
  return db
    .select({ id: companyBoards.id, provider: companyBoards.provider, board_token: companyBoards.board_token, company_name: companyBoards.company_name })
    .from(companyBoards)
    .where(ne(companyBoards.provider, 'remotive'))
    .orderBy(companyBoards.id);
}

// Remotive's row in company_boards, created the first time the daily job needs it.
export async function ensureRemotiveBoard() {
  await db
    .insert(companyBoards)
    .values({ provider: 'remotive', board_token: 'remotive', company_name: 'Remotive' })
    .onConflictDoNothing({ target: [companyBoards.provider, companyBoards.board_token] });
  const [row] = await db
    .select({ id: companyBoards.id })
    .from(companyBoards)
    .where(and(eq(companyBoards.provider, 'remotive'), eq(companyBoards.board_token, 'remotive')));
  return row!;
}

// Records that a fetch is starting and says whether it may. One statement, so two overlapping runs cannot both
// get the slot. Remotive allows 4 requests a day; with a 6 hour gap and no retries that limit cannot be exceeded.
export async function claimFetchSlot(boardId: number, minHoursBetween: number): Promise<boolean> {
  const claimed = await db
    .update(companyBoards)
    .set({ last_attempt_at: sql`now()` })
    .where(
      and(
        eq(companyBoards.id, boardId),
        sql`(${companyBoards.last_attempt_at} is null or ${companyBoards.last_attempt_at} < now() - make_interval(hours => ${minHoursBetween}))`,
      ),
    )
    .returning({ id: companyBoards.id });
  return claimed.length > 0;
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

// A reply that looks too small to trust this many times in a row is believed (the board really did change).
const SUSPICIOUS_REPLIES_BEFORE_CLOSING = 3;

export type SaveResult = { closed: number; closingSkipped: boolean; closedAfterRepeatedWarnings: boolean };

// Stores a board's listings, closes the ones that disappeared and marks the board as fetched, in one
// transaction: if saving fails nothing is kept, so a board never looks fresh while its listings are missing.
//
// Closing safety rule: a reply that is empty, or that would close more than half of a board with 10 or more
// open listings, is more likely a broken reply than a company closing everything. Then nothing is closed
// (the new listings are still saved) and the board gets the "incomplete" message. A non-empty reply that looks
// that way 3 fetches in a row is believed and the missing listings are closed (e.g. the provider changed its id
// format, or the company really did close most of its jobs). An empty reply never closes anything, and does not
// count towards the 3. A normal reply resets the count.
export async function saveBoardListings(boardId: number, fetched: NormalizedListing[]): Promise<SaveResult> {
  // The same id twice in one insert makes Postgres refuse the statement; the last copy wins.
  const byExternalId = new Map(fetched.map((item) => [item.external_id, item]));
  const rows = [...byExternalId.values()].map((item) => ({ ...item, board_id: boardId }));

  return db.transaction(async (tx) => {
    const [openRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(eq(listings.board_id, boardId), isNull(listings.closed_at)));
    const openBefore = openRow?.count ?? 0;

    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      await tx
        .insert(listings)
        .values(rows.slice(start, start + CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [listings.board_id, listings.external_id],
          // Only what the provider controls. first_seen_at is kept. closed_at is cleared: a posting that is
          // on the board again is open again. excluded.* is the row we tried to insert.
          set: {
            company_name: sql`excluded.company_name`,
            title: sql`excluded.title`,
            location: sql`excluded.location`,
            url: sql`excluded.url`,
            description_text: sql`excluded.description_text`,
            posted_at: sql`excluded.posted_at`,
            last_seen_at: sql`now()`,
            closed_at: null,
          },
        });
    }

    // now() is the start of this transaction, so every row saved above has last_seen_at = now() and a row
    // from this board that was not in the reply has an earlier time.
    const unseenOpen = and(eq(listings.board_id, boardId), isNull(listings.closed_at), lt(listings.last_seen_at, sql`now()`));
    const [unseenRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(listings).where(unseenOpen);
    const unseen = unseenRow?.count ?? 0;

    const suspicious = (rows.length === 0 && openBefore > 0) || (openBefore >= MIN_OPEN_FOR_DROP_CHECK && unseen > openBefore / 2);

    const [streakRow] = await tx.select({ streak: companyBoards.suspicious_streak }).from(companyBoards).where(eq(companyBoards.id, boardId));
    const previousStreak = streakRow?.streak ?? 0;
    const streak = !suspicious ? 0 : rows.length === 0 ? previousStreak : previousStreak + 1;
    const believed = suspicious && rows.length > 0 && streak >= SUSPICIOUS_REPLIES_BEFORE_CLOSING;

    const skip = suspicious && !believed;
    let closed = 0;
    if (!skip && unseen > 0) {
      closed = (await tx.update(listings).set({ closed_at: sql`now()` }).where(unseenOpen).returning({ id: listings.id })).length;
    }

    await tx
      .update(companyBoards)
      .set({ last_fetched_at: sql`now()`, last_fetch_error: skip ? fetchErrors.incomplete : null, suspicious_streak: believed ? 0 : streak })
      .where(eq(companyBoards.id, boardId));
    return { closed, closingSkipped: skip, closedAfterRepeatedWarnings: believed };
  });
}

// Spec 3.4: the same company, title and location (ignoring capitals and spacing) is one job, and the company
// board's version wins because it has the full text. Open Remotive listings that a company board also lists point at
// it through duplicate_of; Discover hides those. Recomputed from scratch each run, so it follows boards closing
// and reopening. Two board listings that match each other (a company on two boards) are not merged.
//
// Each side's key is computed once and the two are joined, so the cost grows with the number of listings, not with
// their product (the first version compared every pair and took ~60 ms per Remotive row). Only rows whose answer changes
// are written. Returns how many rows changed.
//
// `materialized` stops Postgres from folding the CTEs into the join, where (without statistics) it picks a plan that
// recomputes the keys for every pair.
//
// Locations: board and Remotive spell "remote" differently ("Remote - US", "United States (Remote)", "Remote - USA"), so
// two locations that both mention remote count as the same place. Other locations must match after normalising.
export async function markDuplicates(): Promise<number> {
  const norm = (value: unknown) => sql`lower(btrim(regexp_replace(coalesce(${value}, ''), '[[:space:]\\u00a0]+', ' ', 'g')))`;
  const place = (value: unknown) => sql`case when ${value} ~* 'remote' then 'remote' else ${norm(value)} end`;
  const result = await db.execute(sql`
    with board_keys as materialized (
      select distinct on (company, title, place) company, title, place, id
      from (
        select b.id,
               ${norm(sql`coalesce(b.company_name, bb.company_name)`)} as company,
               ${norm(sql`b.title`)} as title,
               ${place(sql`b.location`)} as place
        from listings b
        join company_boards bb on bb.id = b.board_id
        where bb.provider <> 'remotive' and b.closed_at is null
      ) keyed
      order by company, title, place, id
    ),
    wanted as materialized (
      select r.id, bk.id as board_listing_id
      from (
        select l.id,
               ${norm(sql`coalesce(l.company_name, rb.company_name)`)} as company,
               ${norm(sql`l.title`)} as title,
               ${place(sql`l.location`)} as place
        from listings l
        join company_boards rb on rb.id = l.board_id
        where rb.provider = 'remotive' and l.closed_at is null
      ) r
      left join board_keys bk on bk.company = r.company and bk.title = r.title and bk.place = r.place
    )
    update listings l
    set duplicate_of = w.board_listing_id
    from wanted w
    where l.id = w.id and l.duplicate_of is distinct from w.board_listing_id
  `);
  return result.rowCount ?? 0;
}

// Takes a key into fetchErrors, not text, so nothing but the fixed messages can be written.
export async function recordFetchFailure(boardId: number, reason: keyof typeof fetchErrors) {
  await db.update(companyBoards).set({ last_fetch_error: fetchErrors[reason] }).where(eq(companyBoards.id, boardId));
}
