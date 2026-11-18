import { Pool, types } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';

//secrets are loaded from a file outside the project folder so they never sit in the repo
//set ENV_FILE to point somewhere else; with no file present (e.g. a host that sets real env vars) this does nothing
dotenv.config({ path: process.env.ENV_FILE || path.join(os.homedir(), '.config', 'job-search-copilot', 'server.env') });

//Postgres DATE columns (type id 1082) have no time or time zone.
//By default pg turns them into a JS Date at local midnight, which then shifts by your time-zone offset in JSON.
//Returning the plain 'YYYY-MM-DD' string keeps the date exactly as stored.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool ({
    connectionString:
process.env.DATABASE_URL,
});

//An idle connection can fail (e.g. the database restarts). With no listener, Node crashes the whole process.
//Logging it instead lets the pool quietly open a new connection next time.
pool.on('error', (err) => {
    console.error('Unexpected database pool error', err);
});

//Typed query builder over the same pool. The schema argument is what gives queries their types.
export const db = drizzle(pool, { schema });
