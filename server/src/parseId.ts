// Route ids arrive as strings. Accept only a positive whole number that fits in a Postgres integer.
// Anything else ("abc", "-1", "1e9") can't be a real row, so the route answers 404 instead of sending it to the database.
export function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= 2147483647 ? id : null;
}
