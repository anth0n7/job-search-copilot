import { fetchAllBoards, type FetchSummary } from './boards/fetchAll';
import { refreshRemotive, type RemotiveSummary } from './boards/refreshRemotive';
import { pool } from './db';
import { runEmbeddingStep, type EmbedSummary } from './embeddings/embedStep';
import type { Embedder } from './embeddings/embedder';
import { errorCode } from './errors';
import { markDuplicates } from './repositories/listings';

export type DailyJobSummary =
  | { status: 'already-running' }
  | {
      status: 'ran';
      // 'failed' means the step threw (a bug or a database problem), as opposed to a board or Remotive being unreachable.
      boards: FetchSummary | 'failed';
      remotive: RemotiveSummary | 'failed';
      duplicates: 'done' | 'failed';
      embeddings: EmbedSummary | 'skipped' | 'failed';
    };

// An arbitrary number; every session that runs the job asks for the same one.
export const DAILY_JOB_LOCK_KEY = 5_017_001;

// Runs one step so that nothing it throws stops the next one. Only a fixed message and the database error code are
// logged: Drizzle's wrapper message contains the query values (resume text, vectors).
async function step<T>(name: string, log: (message: string) => void, run: () => Promise<T>): Promise<T | 'failed'> {
  try {
    return await run();
  } catch (err) {
    log(`${name}: step failed (database error ${errorCode(err) ?? 'none'})`);
    return 'failed';
  }
}

// Spec 3.3, in order: fetch boards, fetch Remotive, merge duplicates, then the cheap similarity numbers. A failed step
// is recorded and the next one still runs: a down board must not stop the numbers, and a failed embedding service must
// not undo the listings. Duplicates are marked before embedding so hidden Remotive copies are not paid for.
// Two overlapping runs would double the Remotive requests and the paid embedding calls, so a database lock (held on its
// own connection for the whole run) lets only one run at a time; the other returns at once.
// The collaborators are parameters so tests use fixtures and a fake embedder.
export async function runDailyJob(deps: {
  embedder: Embedder | null;
  fetchJson?: (url: string) => Promise<unknown>;
  fetchRemotiveFeed?: Parameters<typeof refreshRemotive>[0];
  // A parameter so a test can make this step throw; the fetch and embedding steps catch their own errors.
  mergeDuplicates?: () => Promise<unknown>;
  log?: (message: string) => void;
}): Promise<DailyJobSummary> {
  const log = deps.log ?? console.error;
  const lockConnection = await pool.connect();
  try {
    const { rows } = await lockConnection.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [DAILY_JOB_LOCK_KEY]);
    if (!rows[0]?.locked) return { status: 'already-running' };

    try {
      const boards = await step('boards', log, () => fetchAllBoards(deps.fetchJson, log));
      const remotive = await step('remotive', log, () => refreshRemotive(deps.fetchRemotiveFeed, log));
      const duplicates = await step('duplicates', log, async () => {
        await (deps.mergeDuplicates ?? markDuplicates)();
        return 'done' as const;
      });
      const embeddings = deps.embedder ? await step('embeddings', log, () => runEmbeddingStep(deps.embedder!, log)) : 'skipped';
      return { status: 'ran', boards, remotive, duplicates, embeddings };
    } finally {
      await lockConnection.query('select pg_advisory_unlock($1)', [DAILY_JOB_LOCK_KEY]);
    }
  } finally {
    lockConnection.release();
  }
}

// What the person running the job should look at. Routine trouble (one board down, Remotive not due yet) is not
// listed: it is in the summary and would otherwise make every run exit non-zero.
export function needsAttention(summary: DailyJobSummary): string[] {
  if (summary.status !== 'ran') return [];
  const reasons: string[] = [];
  if (summary.boards === 'failed') reasons.push('the board step crashed');
  else {
    if (summary.boards.closingSkipped > 0) reasons.push(`${summary.boards.closingSkipped} board(s) returned a reply that looked incomplete, so nothing was closed there`);
    if (summary.boards.closedAfterWarnings > 0) reasons.push(`${summary.boards.closedAfterWarnings} board(s) were closed out after 3 incomplete replies in a row; check they really shrank`);
  }
  if (summary.remotive === 'failed') reasons.push('the Remotive step crashed');
  else if (summary.remotive.closingSkipped) reasons.push('the Remotive reply looked incomplete, so nothing was closed');
  if (summary.duplicates === 'failed') reasons.push('the duplicate step crashed');
  if (summary.embeddings === 'failed') reasons.push('the similarity step crashed');
  else if (summary.embeddings !== 'skipped' && summary.embeddings.stoppedEarly) reasons.push('the similarity step stopped early');
  return reasons;
}
