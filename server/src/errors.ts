import type { Response } from 'express';

type ErrorLike = { code?: string; message?: string; stack?: string; cause?: unknown };

//Drizzle wraps the database's own error in a DrizzleQueryError and keeps the original in `cause`.
//The wrapper's message contains the query's values (a user's whole resume, notes...), the original does not.
function rootError(err: unknown): ErrorLike {
  const e = err as ErrorLike | null | undefined;
  return (e?.cause as ErrorLike | undefined) ?? e ?? {};
}

//The Postgres error code (e.g. '23503'), whether or not Drizzle wrapped the error.
export function errorCode(err: unknown): string | undefined {
  return rootError(err).code;
}

//Used in every route's catch block.
//The real error goes to the server log (only you can read it); the browser only gets a safe, generic message.
export function sendServerError(res: Response, err: unknown) {
  const code = errorCode(err);
  //23514 = a CHECK rule in the database was broken (e.g. an invalid status). That is the caller's mistake, not ours.
  if (code === '23514') {
    return res.status(400).json({ error: 'Invalid value' });
  }
  //23505 = a unique rule was broken (e.g. a company with the same name already exists)
  if (code === '23505') {
    return res.status(409).json({ error: 'That already exists' });
  }
  //Log only the original error, never the wrapper: its message includes the values the user sent.
  const root = rootError(err);
  console.error('Request failed:', root.stack ?? root.message ?? 'unknown error');
  res.status(500).json({ error: 'Something went wrong on the server.' });
}

//true for undefined, null, non-strings and strings that are empty or only spaces
export function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}
