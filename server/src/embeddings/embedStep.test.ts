import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { companyBoards, listingEmbeddings, listings, listingSimilarities, resumeEmbeddings, resumes } from '../schema';
import { EmbeddingError, type Embedder } from './embedder';
import { runEmbeddingStep } from './embedStep';

// A fake embedder (no paid call): a text's vector is how often it mentions each topic, so similarity is predictable.
function fakeEmbedder(): Embedder & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    model: 'fake-1',
    calls,
    async embed(texts) {
      calls.push(texts);
      return texts.map((t) => [(t.match(/python/gi) ?? []).length, (t.match(/design/gi) ?? []).length, 0.1]);
    },
  };
}

async function setup() {
  const [board] = await db.insert(companyBoards).values({ provider: 'greenhouse', board_token: 'acme', company_name: 'Acme' }).returning();
  const add = async (external_id: string, description_text: string, extra: Partial<typeof listings.$inferInsert> = {}) => {
    const [row] = await db
      .insert(listings)
      .values({ board_id: board!.id, external_id, title: `Job ${external_id}`, url: 'https://example.com/x', description_text, ...extra })
      .returning();
    return row!;
  };
  const [resume] = await db.insert(resumes).values({ user_id: 'user_A', resume_text: 'python python developer' }).returning();
  return { add, resume: resume! };
}

const similarityOf = async (resume_id: number) => new Map((await db.select().from(listingSimilarities).where(eq(listingSimilarities.resume_id, resume_id))).map((r) => [r.listing_id, r.cosine]));

describe('runEmbeddingStep', () => {
  it('embeds open listings and resumes, stores similarity, and skips closed and duplicate listings', async () => {
    const { add, resume } = await setup();
    const py = await add('1', 'python backend');
    const design = await add('2', 'design systems');
    const closed = await add('3', 'python', { closed_at: new Date() });
    const dup = await add('4', 'python', { duplicate_of: py.id });

    const summary = await runEmbeddingStep(fakeEmbedder(), vi.fn());

    expect(summary).toMatchObject({ listingsEmbedded: 2, resumesEmbedded: 1, stoppedEarly: false });
    const embedded = (await db.select().from(listingEmbeddings)).map((r) => r.listing_id);
    expect(embedded.sort((a, b) => a - b)).toEqual([py.id, design.id].sort((a, b) => a - b));
    expect(embedded).not.toContain(closed.id);
    expect(embedded).not.toContain(dup.id);

    const sims = await similarityOf(resume.id);
    expect(sims.get(py.id)!).toBeGreaterThan(sims.get(design.id)!);
  });

  it('does no paid work the second time when nothing changed', async () => {
    const { add } = await setup();
    await add('1', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());

    const second = fakeEmbedder();
    const summary = await runEmbeddingStep(second, vi.fn());

    expect(second.calls).toHaveLength(0);
    expect(summary).toMatchObject({ listingsEmbedded: 0, resumesEmbedded: 0, similaritiesSaved: 0 });
  });

  it('re-embeds an edited resume and replaces its similarity numbers', async () => {
    const { add, resume } = await setup();
    const py = await add('1', 'python');
    await add('2', 'design');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());
    const before = (await similarityOf(resume.id)).get(py.id)!;

    await db.update(resumes).set({ resume_text: 'design design' }).where(eq(resumes.id, resume.id));
    const summary = await runEmbeddingStep(fakeEmbedder(), vi.fn());

    expect(summary.resumesEmbedded).toBe(1);
    expect(summary.similaritiesSaved).toBe(2);
    expect((await similarityOf(resume.id)).get(py.id)!).toBeLessThan(before);
  });

  it('computes similarity for a listing that arrives after the first run, without re-embedding old ones', async () => {
    const { add, resume } = await setup();
    await add('1', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());
    const late = await add('2', 'python');

    const embedder = fakeEmbedder();
    await runEmbeddingStep(embedder, vi.fn());

    expect(embedder.calls.flat()).toHaveLength(1);
    expect((await similarityOf(resume.id)).has(late.id)).toBe(true);
  });

  it('stops after a failed call, keeps what was already saved, and logs no text', async () => {
    const { add } = await setup();
    await add('1', 'python secret posting text');
    await add('2', 'design');
    await add('3', 'design');
    const base = fakeEmbedder();
    let call = 0;
    const flaky: Embedder = {
      model: base.model,
      embed: async (texts, kind) => {
        if (++call === 3) throw new EmbeddingError('Embedding service answered 429');
        return base.embed(texts, kind);
      },
    };
    const log = vi.fn();

    const summary = await runEmbeddingStep(flaky, log, { batchSize: 1 });

    // call 1 = the resume, call 2 = first listing, call 3 fails
    expect(summary).toMatchObject({ resumesEmbedded: 1, listingsEmbedded: 1, stoppedEarly: true });
    expect(await db.select().from(listingEmbeddings)).toHaveLength(1);
    expect(log).toHaveBeenCalledWith('embedding stopped: Embedding service answered 429');
  });

  it('embeds at most maxListings per run, newest first', async () => {
    const { add } = await setup();
    await add('old', 'python', { posted_at: new Date('2026-01-01') });
    const fresh = await add('new', 'python', { posted_at: new Date('2026-11-01') });

    const summary = await runEmbeddingStep(fakeEmbedder(), vi.fn(), { maxListings: 1 });

    expect(summary.listingsEmbedded).toBe(1);
    expect((await db.select().from(listingEmbeddings))[0]!.listing_id).toBe(fresh.id);
  });

  it('removes a resume\'s numbers when the resume is deleted', async () => {
    const { add, resume } = await setup();
    await add('1', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());

    await db.delete(resumes).where(eq(resumes.id, resume.id));

    expect(await db.select().from(resumeEmbeddings)).toHaveLength(0);
    expect(await db.select().from(listingSimilarities)).toHaveLength(0);
  });

  it('re-embeds a listing whose text was edited and drops its old similarity numbers', async () => {
    const { add, resume } = await setup();
    const job = await add('1', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());
    const before = (await similarityOf(resume.id)).get(job.id)!;

    await db.update(listings).set({ description_text: 'design design' }).where(eq(listings.id, job.id));
    const summary = await runEmbeddingStep(fakeEmbedder(), vi.fn());

    expect(summary.listingsEmbedded).toBe(1);
    expect((await similarityOf(resume.id)).get(job.id)!).toBeLessThan(before);
  });

  it('drops the embedding and similarity numbers of a resume that was cleared', async () => {
    const { add, resume } = await setup();
    await add('1', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());

    await db.update(resumes).set({ resume_text: '   ' }).where(eq(resumes.id, resume.id));
    await runEmbeddingStep(fakeEmbedder(), vi.fn());

    expect(await db.select().from(resumeEmbeddings)).toHaveLength(0);
    expect(await db.select().from(listingSimilarities)).toHaveLength(0);
  });

  it('gives no similarity number to a listing that became a duplicate after it was embedded', async () => {
    const { add, resume } = await setup();
    const original = await add('1', 'python');
    const copy = await add('2', 'python');
    await runEmbeddingStep(fakeEmbedder(), vi.fn());
    await db.delete(listingSimilarities);
    await db.update(listings).set({ duplicate_of: original.id }).where(eq(listings.id, copy.id));

    await runEmbeddingStep(fakeEmbedder(), vi.fn());

    expect([...(await similarityOf(resume.id)).keys()]).toEqual([original.id]);
  });

  it('stops and saves nothing when the embedder returns the wrong number of vectors', async () => {
    const { add } = await setup();
    await add('1', 'python');
    await add('2', 'design');
    const short: Embedder = { model: 'fake-1', embed: async () => [[1, 0, 0]] };
    const log = vi.fn();

    const summary = await runEmbeddingStep(short, log);

    expect(summary.stoppedEarly).toBe(true);
    expect(await db.select().from(listingEmbeddings)).toHaveLength(0);
  });

  // A database error's own message contains the values of the query (resume text, vectors); only its code may be logged.
  it('logs only the database error code, never query values, when saving fails', async () => {
    const { resume } = await setup();
    const log = vi.fn();
    const deletesResumeMidRun: Embedder = {
      model: 'fake-1',
      embed: async (texts) => {
        await db.delete(resumes).where(eq(resumes.id, resume.id));
        return texts.map(() => [0.123456, 0.654321, 0]);
      },
    };

    const summary = await runEmbeddingStep(deletesResumeMidRun, log);

    expect(summary.stoppedEarly).toBe(true);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('23503');
    expect(logged).not.toContain('0.123456');
    expect(logged).not.toContain('python python developer');
    expect(logged).not.toContain('insert into');
  });
});
