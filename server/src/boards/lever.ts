import { z } from 'zod';
import { boardUrl, fetchBoardJson } from './http';
import { collectListings, normalizeListing, toDate, type ParseResult } from './listing';
import { htmlToPlainText } from './text';

// Lever's reply is a bare list of postings.
const postings = z.array(z.unknown());
const posting = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  categories: z.object({ location: z.string().nullish() }).nullish(),
  createdAt: z.number().nullish(),
  descriptionPlain: z.string().nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  additionalPlain: z.string().nullish(),
});

export function parseLever(raw: unknown): ParseResult {
  const parsedBoard = postings.safeParse(raw);
  if (!parsedBoard.success) throw new Error('Lever reply was not a list of postings');

  return collectListings(parsedBoard.data, (item) => {
    const parsed = posting.safeParse(item);
    if (!parsed.success) return null;
    const p = parsed.data;
    // descriptionPlain is only the intro; the requirements are in `lists` and the closing text in `additionalPlain`.
    const description = [
      p.descriptionPlain,
      ...(p.lists ?? []).map((list) => `${list.text}\n${htmlToPlainText(list.content)}`),
      p.additionalPlain,
    ]
      .filter((part): part is string => Boolean(part?.trim()))
      .join('\n\n');
    return normalizeListing({
      external_id: p.id,
      title: p.text,
      location: p.categories?.location,
      url: p.hostedUrl,
      description_text: description,
      posted_at: toDate(p.createdAt),
    });
  });
}

export async function fetchLever(token: string): Promise<ParseResult> {
  return parseLever(await fetchBoardJson(boardUrl('lever', token)));
}
