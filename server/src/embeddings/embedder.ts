import { z } from 'zod';

// The daily job only knows this shape, so tests use a fake and the paid provider can be swapped or capped
// in one place.
// The only error whose message is safe to log: its text is written here, never taken from a reply or a request.
// Anything else thrown near an embedding (a Drizzle error, say) can contain resume text or vectors.
export class EmbeddingError extends Error {}

export type Embedder = {
  // Stored next to every embedding: numbers from different models cannot be compared.
  readonly model: string;
  embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]>;
};

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Embeddings have different lengths');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! ** 2;
    normB += b[i]! ** 2;
  }
  // An all-zero vector has no direction; 0 ("unrelated") is safer than NaN reaching the database.
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
// Same model v1 used (main:server/src/getEmbedding.ts).
const VOYAGE_MODEL = 'voyage-4-lite';

const voyageReply = z.object({ data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })) });

// Not exercised against the real service in this repo (no live calls from tests); its request and reply handling
// is tested with a fake fetch. The key is only ever put in the Authorization header. Errors are EmbeddingErrors with
// fixed text, because Voyage's reply and our request both contain resume or posting text.
export function voyageEmbedder(apiKey: string, fetchFn: typeof fetch = fetch): Embedder {
  return {
    model: VOYAGE_MODEL,
    async embed(texts, kind) {
      if (texts.length === 0) return [];
      const res = await fetchFn(VOYAGE_URL, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: kind }),
      });
      if (!res.ok) throw new EmbeddingError(`Embedding service answered ${res.status}`);

      const parsed = voyageReply.safeParse(await res.json().catch(() => null));
      // Exactly one vector per input, with the indexes 0..n-1 each used once; otherwise a vector could be saved against the wrong text.
      const vectors: (number[] | undefined)[] = new Array<number[] | undefined>(texts.length).fill(undefined);
      if (parsed.success && parsed.data.data.length === texts.length) {
        for (const item of parsed.data.data) {
          if (Number.isInteger(item.index) && item.index >= 0 && item.index < texts.length && vectors[item.index] === undefined) vectors[item.index] = item.embedding;
        }
      }
      if (!vectors.every((v): v is number[] => v !== undefined)) throw new EmbeddingError('Embedding service reply was not understood');
      return vectors;
    },
  };
}
