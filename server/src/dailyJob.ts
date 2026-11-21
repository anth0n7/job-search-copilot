import { voyageEmbedder } from './embeddings/embedder';
import { pool } from './db';
import { runDailyJob } from './runDailyJob';

// `npm run daily`: the once-a-day job (spec 3.3). Like fetchBoards.ts it uses DATABASE_URL from the env file, so check
// the database name it prints. Without VOYAGE_API_KEY the similarity step is skipped and everything else still runs.
const { rows } = await pool.query('SELECT current_database() AS name');
console.log(`Running the daily job on database "${rows[0].name}"...`);

const key = process.env.VOYAGE_API_KEY;
if (!key) console.log('VOYAGE_API_KEY is not set: similarity numbers will be skipped.');

const summary = await runDailyJob({ embedder: key ? voyageEmbedder(key) : null });
console.log(JSON.stringify(summary, null, 2));
await pool.end();
// Non-zero when something failed, so the scheduler can notice.
const failed = summary.boards.boardsFailed > 0 || summary.remotive.status === 'failed' || (summary.embeddings !== 'skipped' && summary.embeddings.stoppedEarly);
process.exitCode = failed ? 1 : 0;
