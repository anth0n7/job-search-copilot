import { z } from 'zod';
import { fetchBoardJson, REMOTIVE_URL } from './http';
import { collectListings, normalizeListing, toDate, type ParseResult } from './listing';
import { htmlToPlainText } from './text';

const feed = z.object({ jobs: z.array(z.unknown()) });
const job = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.string(),
  title: z.string(),
  company_name: z.string(),
  publication_date: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  description: z.string().nullish(),
});

// Remotive only lists remote jobs; the location field says who may apply, so it is kept after "Remote".
const toLocation = (restriction: string | null | undefined) => (restriction?.trim() ? `Remote - ${restriction.trim()}` : 'Remote');

// Fixed error text, like the board parsers: Zod's message can quote the reply and these errors get logged.
export function parseRemotive(raw: unknown): ParseResult {
  const parsedFeed = feed.safeParse(raw);
  if (!parsedFeed.success) throw new Error('Remotive reply was not a job feed');

  return collectListings(parsedFeed.data.jobs, (item) => {
    const parsed = job.safeParse(item);
    if (!parsed.success || parsed.data.company_name.trim() === '') return null;
    const listing = normalizeListing({
      external_id: String(parsed.data.id),
      title: parsed.data.title,
      location: toLocation(parsed.data.candidate_required_location),
      url: parsed.data.url,
      description_text: htmlToPlainText(parsed.data.description ?? ''),
      posted_at: toDate(parsed.data.publication_date),
    });
    return listing && { ...listing, company_name: parsed.data.company_name.trim().slice(0, 200) };
  });
}

// One request and no retries: Remotive allows 4 requests a day in total, and a retry is a request too.
export async function fetchRemotive(): Promise<ParseResult> {
  return parseRemotive(await fetchBoardJson(REMOTIVE_URL, { retries: 0 }));
}
