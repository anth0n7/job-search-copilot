import type { Response } from 'express';

//Used in every route's catch block.
//The real error goes to the server log (only you can read it); the browser only gets a safe, generic message.
export function sendServerError(res: Response, err: unknown) {
  //23514 = a CHECK rule in the database was broken (e.g. an invalid status). That is the caller's mistake, not ours.
  if ((err as { code?: string })?.code === '23514') {
    return res.status(400).json({ error: 'Invalid value' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}

//true for undefined, null, non-strings and strings that are empty or only spaces
export function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}
