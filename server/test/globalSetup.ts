import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Runs once before the suite: make sure jobtracker_test exists, then rebuild it from the real migration files,
// the same files production uses, so a broken migration fails the tests.
export default async function setup() {
  const exists = execFileSync('psql', ['postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'jobtracker_test'"]).toString().trim();
  if (exists !== '1') {
    execFileSync('psql', ['postgres', '-c', 'CREATE DATABASE jobtracker_test']);
  }

  const pool = new Pool({ connectionString: 'postgresql://localhost:5432/jobtracker_test' });
  try {
    // Safety net: this wipes everything, so refuse to run against anything but a test database
    const { rows } = await pool.query('SELECT current_database() AS db');
    if (!rows[0].db.endsWith('_test')) throw new Error(`Refusing to wipe database "${rows[0].db}"`);

    // "drizzle" is the schema where Drizzle remembers which migrations have run
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
    await migrate(drizzle(pool), { migrationsFolder: path.join(import.meta.dirname, '..', 'drizzle') });
  } finally {
    await pool.end();
  }
}
