import { fetchAllBoards } from './boards/fetchAll';
import { pool } from './db';

// `npm run fetch:boards`: fetches every board in company_boards and saves its listings.
// Like migrate.ts it uses DATABASE_URL from the env file, so check the database name it prints.
const { rows } = await pool.query('SELECT current_database() AS name');
console.log(`Fetching boards into database "${rows[0].name}"...`);

const summary = await fetchAllBoards();
console.log(
  `Boards: ${summary.boardsFetched} fetched, ${summary.boardsFailed} failed. ` +
    `Listings: ${summary.listingsSaved} saved, ${summary.postingsSkipped} postings skipped as unusable.`,
);
await pool.end();
// A non-zero exit lets a scheduler (and you) notice that some board failed.
process.exitCode = summary.boardsFailed > 0 ? 1 : 0;
