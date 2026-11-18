import { defineConfig } from 'drizzle-kit';

// Only used by `npm run db:generate`, which compares schema.ts with the existing migrations and writes
// the SQL for the difference. It never connects to a database, so no credentials are needed here.
// Migrations are applied by src/migrate.ts, which uses the same DATABASE_URL as the app.
// Never use `drizzle-kit push`: it changes a database directly, skipping the reviewed SQL files.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
});
