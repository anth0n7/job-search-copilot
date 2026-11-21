import { createHash } from 'node:crypto';
import { and, desc, eq, isNull, notExists, sql } from 'drizzle-orm';
import { db } from '../db';
import { listingEmbeddings, listings, listingSimilarities, resumeEmbeddings, resumes } from '../schema';

// JOB-ONLY, like repositories/listings: the daily job compares every user's resume with every listing, so these
// functions take no userId and a route must never import them (.oxlintrc.json enforces that). Reading a user's
// own numbers for a page is a different, user-scoped function that belongs to the Discover and scoring tickets.

export const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

// Open listings that have no embedding for this model yet, newest first so a capped run covers what users see first.
// Remotive duplicates are skipped: they are hidden, so embedding them would only cost money.
export async function listingsNeedingEmbedding(model: string, limit: number) {
  return db
    .select({ id: listings.id, title: listings.title, description_text: listings.description_text })
    .from(listings)
    .where(
      and(
        isNull(listings.closed_at),
        isNull(listings.duplicate_of),
        notExists(
          db
            .select({ one: sql`1` })
            .from(listingEmbeddings)
            .where(and(eq(listingEmbeddings.listing_id, listings.id), eq(listingEmbeddings.model, model))),
        ),
      ),
    )
    .orderBy(sql`${listings.posted_at} desc nulls last`, desc(listings.id))
    .limit(limit);
}

export async function saveListingEmbeddings(model: string, items: { listing_id: number; embedding: number[] }[]) {
  if (items.length === 0) return;
  await db
    .insert(listingEmbeddings)
    .values(items.map((item) => ({ ...item, model })))
    .onConflictDoUpdate({
      target: listingEmbeddings.listing_id,
      set: { model: sql`excluded.model`, embedding: sql`excluded.embedding`, created_at: sql`now()` },
    });
}

// Resumes with text whose embedding is missing, was made by another model, or was made from older text.
export async function resumesNeedingEmbedding(model: string) {
  const rows = await db
    .select({ id: resumes.id, resume_text: resumes.resume_text, hash: resumeEmbeddings.text_hash, model: resumeEmbeddings.model })
    .from(resumes)
    .leftJoin(resumeEmbeddings, eq(resumeEmbeddings.resume_id, resumes.id));
  return rows
    .filter((row) => row.resume_text !== null && row.resume_text.trim() !== '')
    .map((row) => ({ id: row.id, resume_text: row.resume_text!, hash: hashText(row.resume_text!), stale: row.model !== model || row.hash !== hashText(row.resume_text!) }))
    .filter((row) => row.stale);
}

// Replaces the resume's embedding and throws away its similarity numbers in one transaction: they were computed from
// the old text, and the next step recomputes them.
export async function saveResumeEmbedding(resumeId: number, model: string, textHash: string, embedding: number[]) {
  await db.transaction(async (tx) => {
    await tx
      .insert(resumeEmbeddings)
      .values({ resume_id: resumeId, model, text_hash: textHash, embedding })
      .onConflictDoUpdate({
        target: resumeEmbeddings.resume_id,
        set: { model: sql`excluded.model`, text_hash: sql`excluded.text_hash`, embedding: sql`excluded.embedding`, created_at: sql`now()` },
      });
    await tx.delete(listingSimilarities).where(eq(listingSimilarities.resume_id, resumeId));
  });
}

export async function embeddedResumes(model: string) {
  return db
    .select({ resume_id: resumeEmbeddings.resume_id, embedding: resumeEmbeddings.embedding })
    .from(resumeEmbeddings)
    .where(eq(resumeEmbeddings.model, model));
}

// Open listings that have an embedding from this model but no similarity number for this resume yet.
export async function listingsMissingSimilarity(resumeId: number, model: string, limit: number) {
  return db
    .select({ listing_id: listingEmbeddings.listing_id, embedding: listingEmbeddings.embedding })
    .from(listingEmbeddings)
    .innerJoin(listings, eq(listings.id, listingEmbeddings.listing_id))
    .where(
      and(
        eq(listingEmbeddings.model, model),
        isNull(listings.closed_at),
        notExists(
          db
            .select({ one: sql`1` })
            .from(listingSimilarities)
            .where(and(eq(listingSimilarities.listing_id, listingEmbeddings.listing_id), eq(listingSimilarities.resume_id, resumeId))),
        ),
      ),
    )
    .limit(limit);
}

export async function saveSimilarities(resumeId: number, items: { listing_id: number; cosine: number }[]) {
  if (items.length === 0) return;
  await db
    .insert(listingSimilarities)
    .values(items.map((item) => ({ ...item, resume_id: resumeId })))
    .onConflictDoUpdate({ target: [listingSimilarities.resume_id, listingSimilarities.listing_id], set: { cosine: sql`excluded.cosine` } });
}
