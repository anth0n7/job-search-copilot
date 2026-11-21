import { describe, expect, it, vi } from 'vitest';
import { cosine, voyageEmbedder } from './embedder';

describe('cosine', () => {
  it('is 1 for the same direction at any length, 0 for unrelated, and 0 (not NaN) for an empty vector', () => {
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it('refuses vectors of different lengths (numbers from different models)', () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow();
  });
});

// Only the network is faked; the request building and reply checking run for real.
describe('voyageEmbedder', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('sends the key as a header only, and returns vectors in input order', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      reply({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      }),
    );

    const vectors = await voyageEmbedder('secret-key', fetchFn).embed(['a', 'b'], 'document');

    expect(vectors).toEqual([[1, 0], [0, 1]]);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(init.headers.authorization).toBe('Bearer secret-key');
    expect(init.redirect).toBe('manual');
    expect(init.body).not.toContain('secret-key');
    expect(JSON.parse(init.body)).toMatchObject({ input: ['a', 'b'], input_type: 'document' });
  });

  it('throws fixed messages that never contain the reply body or the key', async () => {
    const failing = voyageEmbedder('secret-key', vi.fn().mockResolvedValue(reply({ detail: 'echoed resume text secret-key' }, 429)));
    await expect(failing.embed(['x'], 'query')).rejects.toThrow(/^Embedding service answered 429$/);

    const wrongCount = voyageEmbedder('k', vi.fn().mockResolvedValue(reply({ data: [] })));
    await expect(wrongCount.embed(['x'], 'query')).rejects.toThrow('Embedding service reply was not understood');
  });
});
