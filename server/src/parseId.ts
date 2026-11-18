// Route ids arrive as strings. Accept only a positive whole number that fits in a Postgres integer.
// Anything else ("abc", "-1", "1e9") can't be a real row, so the route answers 404 instead of sending it to the database.
export function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= 2147483647 ? id : null;
}

// For ids sent in a request body (e.g. company_id): a positive whole number that fits in a Postgres integer.
export function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483647;
}
