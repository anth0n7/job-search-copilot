import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { boardUrl } from './boards/http';
import { db, pool } from './db';
import type { Embedder } from './embeddings/embedder';
import { companyBoards, listings, resumes } from './schema';
import { parseRemotive } from './boards/remotive';
import { DAILY_JOB_LOCK_KEY, needsAttention, runDailyJob } from './runDailyJob';

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

    if (summary.status !== 'ran') throw new Error('expected the job to run');
    expect(summary.boards).toMatchObject({ boardsFetched: 1 });
    expect(summary.remotive).toMatchObject({ status: 'fetched' });
    const dup = (await db.select().from(listings).where(eq(listings.external_id, '1901234')))[0]!;
    expect(dup.duplicate_of).not.toBeNull();
    expect(summary.embeddings).toMatchObject({ stoppedEarly: false, resumesEmbedded: 1 });
    // 3 board listings + Remotive's second listing; its duplicate of the board listing is not embedded
    expect(summary.embeddings).toMatchObject({ listingsEmbedded: 4 });
  });

  it('skips only the similarity step when there is no embedder, and a second run does not call Remotive again', async () => {
    const feed = vi.fn(async () => ({ listings: [], skipped: 0 }));

    const first = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: feed });
    const second = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: feed });

    expect(first).toMatchObject({ status: 'ran', embeddings: 'skipped', remotive: { status: 'fetched' } });
    expect(second).toMatchObject({ remotive: { status: 'too-soon' } });
    expect(feed).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a step throws, logging only a fixed message and the database error code', async () => {
    const log = vi.fn();
    await db.insert(companyBoards).values({ provider: 'greenhouse', board_token: 'acme', company_name: 'Acme' });
    await db.insert(resumes).values({ user_id: 'user_A', resume_text: 'secret resume words' });
    const throwingEmbedder: Embedder = {
      model: 'fake',
      embed: async () => {
        throw new Error('secret resume words');
      },
    };

    const summary = await runDailyJob({
      embedder: throwingEmbedder,
      log,
      fetchJson: async () => {
        throw new Error('down');
      },
      fetchRemotiveFeed: async () => {
        throw new Error('detail');
      },
    });

    expect(summary).toMatchObject({ status: 'ran', remotive: { status: 'failed' }, embeddings: { stoppedEarly: true } });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret resume words');
  });

  it('records a step that throws as failed and still runs the later steps', async () => {
    const log = vi.fn();
    await db.insert(resumes).values({ user_id: 'user_A', resume_text: 'my resume' });
    // Like a Drizzle error: the wrapper's message holds the query values, the real code is on `cause`.
    const exploding = async () => {
      throw Object.assign(new Error('insert into resumes values (secret resume words)'), { cause: { code: '57P01' } });
    };

    const summary = await runDailyJob({ embedder, log, fetchJson: async () => null, fetchRemotiveFeed: async () => ({ listings: [], skipped: 0 }), mergeDuplicates: exploding });

    expect(summary).toMatchObject({ status: 'ran', duplicates: 'failed', embeddings: { resumesEmbedded: 1 } });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('57P01');
    expect(logged).not.toContain('secret resume words');
  });

  it('does nothing when another run holds the lock, and releases the lock afterwards', async () => {
    const other = await pool.connect();
    try {
      await other.query('select pg_advisory_lock($1)', [DAILY_JOB_LOCK_KEY]);
      const feed = vi.fn(async () => ({ listings: [], skipped: 0 }));

      const blocked = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: feed });
      expect(blocked).toEqual({ status: 'already-running' });
      expect(feed).not.toHaveBeenCalled();
    } finally {
      await other.query('select pg_advisory_unlock($1)', [DAILY_JOB_LOCK_KEY]);
      other.release();
    }

    const afterwards = await runDailyJob({ embedder: null, log: vi.fn(), fetchJson: async () => null, fetchRemotiveFeed: async () => ({ listings: [], skipped: 0 }) });
    expect(afterwards.status).toBe('ran');
  });
});

describe('needsAttention', () => {
  const ran = (over: object = {}) => ({
    status: 'ran' as const,
    boards: { boardsFetched: 5, boardsFailed: 0, listingsSaved: 0, postingsSkipped: 0, listingsClosed: 0, closingSkipped: 0, closedAfterWarnings: 0 },
    remotive: { status: 'fetched' as const, listingsSaved: 0, listingsClosed: 0, closingSkipped: false },
    duplicates: 'done' as const,
    embeddings: 'skipped' as const,
    ...over,
  });

  it('is quiet for routine single-board failures and a skipped Remotive fetch', () => {
    expect(needsAttention(ran({ boards: { ...ran().boards, boardsFailed: 1 }, remotive: { ...ran().remotive, status: 'too-soon' } }))).toEqual([]);
  });

  it('reports a failed step, a stopped embedding run, and a board whose reply looked incomplete', () => {
    expect(needsAttention(ran({ duplicates: 'failed' }))).toHaveLength(1);
    expect(needsAttention(ran({ embeddings: { listingsEmbedded: 0, resumesEmbedded: 0, similaritiesSaved: 0, stoppedEarly: true } }))).toHaveLength(1);
    expect(needsAttention(ran({ boards: { ...ran().boards, closingSkipped: 2 } }))).toHaveLength(1);
    expect(needsAttention({ status: 'already-running' })).toEqual([]);
  });
});
