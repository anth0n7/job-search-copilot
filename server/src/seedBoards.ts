import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { pool } from './db';
import { addBoards } from './repositories/listings';
import { BOARD_PROVIDERS } from './schema';

// `npm run seed:boards`: loads server/data/boards.json into company_boards. Safe to run again.
// Like migrate.ts it uses DATABASE_URL from the env file, so check the database name it prints.
const entry = z.object({ provider: z.enum(BOARD_PROVIDERS), board_token: z.string(), company_name: z.string() });
const file = path.join(import.meta.dirname, '..', 'data', 'boards.json');
const boards = z.array(entry).parse(JSON.parse(readFileSync(file, 'utf8')));

const { rows } = await pool.query('SELECT current_database() AS name');
console.log(`Loading ${boards.length} boards into database "${rows[0].name}"...`);
await addBoards(boards);
console.log('Done.');
await pool.end();
