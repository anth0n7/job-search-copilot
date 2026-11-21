import { cosine, type Embedder } from './embedder';
import {
  embeddedResumes,
  listingsMissingSimilarity,
  listingsNeedingEmbedding,
  resumesNeedingEmbedding,
  saveListingEmbeddings,
  saveResumeEmbedding,
  saveSimilarities,
} from '../repositories/similarity';

export type EmbedSummary = { listingsEmbedded: number; resumesEmbedded: number; similaritiesSaved: number; stoppedEarly: boolean };

export type EmbedOptions = {
  // Spending control: the most listings embedded in one run. The rest wait for tomorrow (newest first).
  // A stand-in until the global monthly cap of ticket 10 exists.
  maxListings?: number;
  batchSize?: number;
};

// Embedding models read a limited amount of text, and cost is per token, so long postings are cut.
const MAX_CHARS = 6000;
const ROWS_PER_SIMILARITY_CHUNK = 500;

// Cheap numbers for the daily job (spec 3.3): one embedding per listing (shared), one per resume, and the cosine of each
// pair. No Claude call. Nothing here logs text, only counts.
export async function runEmbeddingStep(embedder: Embedder, log: (message: string) => void = console.error, options: EmbedOptions = {}): Promise<EmbedSummary> {
  const { maxListings = 3000, batchSize = 32 } = options;
  const summary: EmbedSummary = { listingsEmbedded: 0, resumesEmbedded: 0, similaritiesSaved: 0, stoppedEarly: false };

  // After one failed call the run stops: retrying a failing or rate-limited paid service in a loop costs money for nothing.
  // Whatever was saved before the failure stays, and tomorrow's run continues from there.
  try {
    for (const resume of await resumesNeedingEmbedding(embedder.model)) {
      const [vector] = await embedder.embed([resume.resume_text.slice(0, MAX_CHARS)], 'query');
      await saveResumeEmbedding(resume.id, embedder.model, resume.hash, vector!);
      summary.resumesEmbedded++;
    }

    const pending = await listingsNeedingEmbedding(embedder.model, maxListings);
    for (let start = 0; start < pending.length; start += batchSize) {
      const batch = pending.slice(start, start + batchSize);
      const vectors = await embedder.embed(batch.map((l) => `${l.title}\n\n${l.description_text}`.slice(0, MAX_CHARS)), 'document');
      await saveListingEmbeddings(embedder.model, batch.map((l, i) => ({ listing_id: l.id, embedding: vectors[i]! })));
      summary.listingsEmbedded += batch.length;
    }
  } catch (err) {
    log(`embedding stopped: ${err instanceof Error ? err.message : 'unknown error'}`);
    summary.stoppedEarly = true;
  }

  // Needs no paid call, so it runs even after a failure, for whatever is already embedded.
  for (const resume of await embeddedResumes(embedder.model)) {
    for (;;) {
      const missing = await listingsMissingSimilarity(resume.resume_id, embedder.model, ROWS_PER_SIMILARITY_CHUNK);
      if (missing.length === 0) break;
      await saveSimilarities(resume.resume_id, missing.map((l) => ({ listing_id: l.listing_id, cosine: cosine(resume.embedding, l.embedding) })));
      summary.similaritiesSaved += missing.length;
    }
  }
  return summary;
}
