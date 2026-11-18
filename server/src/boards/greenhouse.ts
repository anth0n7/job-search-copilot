import { z } from 'zod';
import { fetchBoardJson, boardUrl } from './http';
import { collectListings, normalizeListing, toDate, type ParseResult } from './listing';
import { htmlToPlainText, unescapeHtml } from './text';

// Only the fields we use are listed. The reply comes from a server we don't control, so every field is checked.
const board = z.object({ jobs: z.array(z.unknown()) });
const job = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  absolute_url: z.string(),
  location: z.object({ name: z.string() }).nullish(),
  first_published: z.string().nullish(),
  content: z.string().nullish(),
});

// A reply that isn't a board at all throws; a single bad posting is skipped and counted instead.
// The thrown message is fixed text: Zod's own message can quote the reply, and these errors get logged.
export function parseGreenhouse(raw: unknown): ParseResult {
  const parsedBoard = board.safeParse(raw);
  if (!parsedBoard.success) throw new Error('Greenhouse reply was not a job board');

  return collectListings(parsedBoard.data.jobs, (item) => {
    const parsed = job.safeParse(item);
    if (!parsed.success) return null;
    return normalizeListing({
      external_id: String(parsed.data.id),
      title: parsed.data.title,
      location: parsed.data.location?.name,
      url: parsed.data.absolute_url,
      description_text: htmlToPlainText(unescapeHtml(parsed.data.content ?? '')),
      posted_at: toDate(parsed.data.first_published),
    });
  });
}

export async function fetchGreenhouse(token: string): Promise<ParseResult> {
  return parseGreenhouse(await fetchBoardJson(boardUrl('greenhouse', token)));
}
