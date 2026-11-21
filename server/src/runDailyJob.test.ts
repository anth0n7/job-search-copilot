import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { boardUrl } from './boards/http';
import { db } from './db';
import type { Embedder } from './embeddings/embedder';
import { companyBoards, listings, resumes } from './schema';
import { parseRemotive } from './boards/remotive';
import { runDailyJob } from './runDailyJob';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./boards/fixtures/${name}.json`, import.meta.url), 'utf8'));
const embedder: Embedder = { model: 'fake', embed: async (texts) => texts.map(() => [1, 0.5]) };

describe('runDailyJob', () => {
  it('runs every step: boards, Remotive, duplicates, similarity numbers', async () => {
    await db.insert(companyBoards).values({ provider: 'greenhouse', board_token: 'acme', company_name: 'Acme Corp' });
    await db.insert(resumes).values({ user_id: 'user_A', resume_text: 'my resume' });
    // The Greenhouse fixture's first job also appears on Remotive, so the Remotive copy must be marked a duplicate.
    const gh = fixture('greenhouse');
    const remotive = fixture('remotive');
    remotive.jobs[0].title = gh.jobs[0].title;
    remotive.jobs[0].company_name = 'ACME corp';
    remotive.jobs[0].candidate_required_location = '';
    gh.jobs[0].location = { name: 'Remote' };

    const summary = await runDailyJob({
      embedder,
      log: vi.fn(),
      fetchJson: async (url) => (url === boardUrl('greenhouse', 'acme') ? gh : null),
      fetchRemotiveFeed: async () => parseRemotive(remotive),
    });

    expect(summary.boards.boardsFetched).toBe(1);
    expect(summary.remotive.status).toBe('fetched');
    const dup = (await db.select().from(listings).where(eq(listings.external_id, '1901234')))[0]!;
    expect(dup.duplicate_of).not.toBeNull();
    expect(summary.embeddings).toMatchObject({ stoppedEarly: false, resumesEmbedded: 1 });
    // 3 board listings + Remotive's second listing; its duplicate of the board listing is not embedded
    expect(summary.embeddings !== 'skipped' && summary.embeddings.listingsEmbedded).toBe(4);
  });

  it('skips only the similarity step when there is no embedder, and a second run does not call Remotive again', async () => {
    const feed = vi.fn(async () => ({ listings: [], skipped: 0 }));

    const first = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: feed });
    const second = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: feed });

    expect(first.embeddings).toBe('skipped');
    expect(first.remotive.status).toBe('fetched');
    expect(second.remotive.status).toBe('too-soon');
    expect(feed).toHaveBeenCalledTimes(1);
  });
});
