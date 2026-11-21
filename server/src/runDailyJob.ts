import { fetchAllBoards, type FetchSummary } from './boards/fetchAll';
import { refreshRemotive, type RemotiveSummary } from './boards/refreshRemotive';
import { runEmbeddingStep, type EmbedSummary } from './embeddings/embedStep';
import type { Embedder } from './embeddings/embedder';
import { markDuplicates } from './repositories/listings';

export type DailyJobSummary = { boards: FetchSummary; remotive: RemotiveSummary; embeddings: EmbedSummary | 'skipped' };

// Spec 3.3, in order: fetch boards, fetch Remotive, merge duplicates, then the cheap similarity numbers.
// Each step reports its own failures and the next one still runs: a down board must not stop the numbers, and a
// failed embedding service must not undo the listings. Duplicates are marked before embedding so hidden Remotive
// copies are not paid for. The collaborators are parameters so tests use fixtures and a fake embedder.
export async function runDailyJob(
  deps: { embedder: Embedder | null; fetchJson?: (url: string) => Promise<unknown>; fetchRemotiveFeed?: Parameters<typeof refreshRemotive>[0]; log?: (message: string) => void },
): Promise<DailyJobSummary> {
  const log = deps.log ?? console.error;
  const boards = await fetchAllBoards(deps.fetchJson, log);
  const remotive = await refreshRemotive(deps.fetchRemotiveFeed, log);
  await markDuplicates();
  const embeddings = deps.embedder ? await runEmbeddingStep(deps.embedder, log) : 'skipped';
  return { boards, remotive, embeddings };
}
