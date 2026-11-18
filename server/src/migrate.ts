import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './db';

// `npm run db:migrate`: applies the SQL files in server/drizzle/ that this database has not run yet.
// It uses the same DATABASE_URL as the app (from ~/.config/job-search-copilot/server.env), so check the
// database name it prints before trusting the result.
const { rows } = await pool.query('SELECT current_database() AS name');
console.log(`Migrating database "${rows[0].name}"...`);
await migrate(db, { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });
console.log('Done.');
await pool.end();
