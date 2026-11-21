import { voyageEmbedder } from './embeddings/embedder';
import { pool } from './db';
import { needsAttention, runDailyJob } from './runDailyJob';

// `npm run daily`: the once-a-day job (spec 3.3). Like fetchBoards.ts it uses DATABASE_URL from the env file, so check
// the database name it prints. Without VOYAGE_API_KEY the similarity step is skipped and everything else still runs.
const { rows } = await pool.query('SELECT current_database() AS name');
console.log(`Running the daily job on database "${rows[0].name}"...`);

const key = process.env.VOYAGE_API_KEY;
if (!key) console.log('VOYAGE_API_KEY is not set: similarity numbers will be skipped.');

const summary = await runDailyJob({ embedder: key ? voyageEmbedder(key) : null });
await pool.end();

if (summary.status === 'already-running') {
  console.log('Another daily job is already running; this run did nothing.');
  process.exitCode = 0;
} else {
  console.log(JSON.stringify(summary, null, 2));
  const reasons = needsAttention(summary);
  for (const reason of reasons) console.log(`ATTENTION: ${reason}`);
  // One board being down is routine and does not fail the run; a crashed step or an incomplete-looking reply does.
  process.exitCode = reasons.length > 0 ? 1 : 0;
}
