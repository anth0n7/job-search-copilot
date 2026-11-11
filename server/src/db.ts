import { Pool } from 'pg';
import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';

//secrets are loaded from a file outside the project folder so they never sit in the repo
//set ENV_FILE to point somewhere else; with no file present (e.g. a host that sets real env vars) this does nothing
dotenv.config({ path: process.env.ENV_FILE || path.join(os.homedir(), '.config', 'job-search-copilot', 'server.env') });

export const pool = new Pool ({
    connectionString:
process.env.DATABASE_URL,
});