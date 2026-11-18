// What every provider's fetcher produces, so the rest of the app never sees provider-specific shapes.
export type NormalizedListing = {
  external_id: string;
  title: string;
  location: string | null;
  url: string;
  description_text: string;
  posted_at: Date | null;
};

export type ParseResult = { listings: NormalizedListing[]; skipped: number };

// Mirrors the database rules on `listings` (title 1-500 characters, https link). A posting that would
// break one is skipped here, because a single violation would make the database reject the whole batch.
export function normalizeListing(input: {
  external_id: string;
  title: string;
  location: string | null | undefined;
  url: string;
  description_text: string;
  posted_at: Date | null;
}): NormalizedListing | null {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 500) return null;
  if (!input.url.startsWith('https://')) return null;
  return {
    external_id: input.external_id,
    title,
    location: input.location?.trim() || null,
    url: input.url,
    description_text: input.description_text,
    posted_at: input.posted_at,
  };
}

// Providers send dates as text or as milliseconds; an unreadable date becomes "unknown" instead of an error.
export function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Runs a provider's mapping over every posting. `null` means unusable (counted as skipped, so the problem is visible);
// 'omit' means the posting is deliberately left out (not a problem, not counted).
export function collectListings(items: unknown[], map: (item: unknown) => NormalizedListing | null | 'omit'): ParseResult {
  const listings: NormalizedListing[] = [];
  let skipped = 0;
  for (const item of items) {
    const result = map(item);
    if (result === 'omit') continue;
    if (result) listings.push(result);
    else skipped++;
  }
  return { listings, skipped };
}
