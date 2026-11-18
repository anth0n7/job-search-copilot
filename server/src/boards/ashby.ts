import { z } from 'zod';
import { boardUrl, fetchBoardJson } from './http';
import { collectListings, normalizeListing, toDate, type ParseResult } from './listing';
import { htmlToPlainText } from './text';

const board = z.object({ jobs: z.array(z.unknown()) });
const job = z.object({
  id: z.string(),
  title: z.string(),
  jobUrl: z.string(),
  location: z.string().nullish(),
  publishedAt: z.string().nullish(),
  isListed: z.boolean().nullish(),
  descriptionPlain: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
});

export function parseAshby(raw: unknown): ParseResult {
  const parsedBoard = board.safeParse(raw);
  if (!parsedBoard.success) throw new Error('Ashby reply was not a job board');

  return collectListings(parsedBoard.data.jobs, (item) => {
    const parsed = job.safeParse(item);
    if (!parsed.success) return null;
    const j = parsed.data;
    // Unlisted jobs are hidden on the company's own page, so they stay hidden here.
    if (j.isListed === false) return 'omit';
    return normalizeListing({
      external_id: j.id,
      title: j.title,
      location: j.location,
      url: j.jobUrl,
      description_text: j.descriptionPlain ?? htmlToPlainText(j.descriptionHtml ?? ''),
      posted_at: toDate(j.publishedAt),
    });
  });
}

export async function fetchAshby(token: string): Promise<ParseResult> {
  return parseAshby(await fetchBoardJson(boardUrl('ashby', token)));
}
