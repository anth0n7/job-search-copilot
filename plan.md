# Plan: where we stand and what comes next

Last updated 2026-11-19. The full design is in [docs/v2-spec.md](docs/v2-spec.md); this file is the short version of progress. Ticket numbers below are the ones in section 11 of the spec.

## Where we stand

Branch `v2`, at `030f6c0` (merge of PR #3). CI green. Server: 106 tests passing; client: 30. Lint and typecheck clean in both.

### Done

| Ticket | What | Where |
|---|---|---|
| Phase 0 | Bug fixes for the kept v1 code, tests, lint, CI, pre-commit hook | merged earlier |
| 1 | `v2` branch; ownership rules in one place (`repositories/owned.ts`) | merged earlier |
| 19 | v1 AI code and its tables removed | merged earlier |
| 3 (part) | `company_boards` and `listings` tables + migration `0002` | PR #2 |
| 4 (part) | Safe HTTP helper and Greenhouse / Lever / Ashby fetchers with fixture tests | PR #2 |
| Workflow | `./check.sh`, Stop hook, workflow rules in CLAUDE.md, CHANGELOG.md, client build in CI; branch protection on `main` and `v2` | PR #3 |

### Local setup

- `jobtracker_v2` has all migrations applied, including `0002`. The server's env file points at it.
- `jobtracker` (v1 sample data): do not touch.
- The pre-commit hook is on (`core.hooksPath .githooks`). It runs lint + typecheck, not tests.
- Server (`cd server && npm run dev`) and client (`cd client && npm run dev`) both run; the page renders.

## Next: finish the job-listings ticket (3 + 4)

Each step: propose first, write the test first and show it failing, then make it pass.

1. **Listings repository** (`server/src/repositories/listings.ts`)
   - Save a board's listings in one transaction. A posting already stored (same board + posting id) is updated, not duplicated; `last_seen_at` moves forward.
   - Record each fetch on the board: `last_fetched_at`, or a short fixed error message (never the raw error).
   - These tables are shared, so this is the one repository without a `userId`. It must never be called from a user-facing route.
2. **Manual fetch command** (`npm run fetch:boards`)
   - Reads every board from `company_boards`, picks the right fetcher, saves the results, prints counts (fetched / skipped / failed).
   - One failing board must not stop the others.
3. **Curated company list** (about 30-50 US tech companies)
   - I research and check that every board answers; you approve the list before it is committed.
   - Check board names with capitals (Ashby) still work in lowercase, since our board-name rule is lowercase only.
   - A way to load the list into `company_boards`.
4. **First real run** against `jobtracker_v2`, and a look at a few real descriptions to check the plain-text output.

**Not in this ticket (on purpose):** marking listings closed (ticket 5, with a safety rule against closing everything after a failed fetch), duplicates across sources (once Remotive exists), and per-user following of boards (ticket 16).

## After that

In the order agreed so far. The order after deployment is still open.

1. **Deployment (rest of ticket 3):** Neon database + Vercel. Revisit a confirmation guard in `migrate.ts` before any non-local migration.
2. **Dependency vulnerabilities (ticket 2):** read each `npm audit` finding (server: body-parser, proxy-addr, qs; client: picomatch, vite) and update or document.
3. **Daily job (ticket 5):** refresh boards, store similarity numbers, mark closed listings; Remotive.
4. **Discover page (ticket 7)** and **profile bar (ticket 8).**
5. **AI tickets (9-12, 14):** PDF resume reading, posting extraction, spending limits and the $4 cap, hybrid scoring, tuning set, tailoring. Prices to be rechecked first.
6. **The rest:** Adzuna search (6), Save / Apply flow (13), guest mode (15), add company by link or name (16), delete my data (17), manual application (18), Adzuna company suggestions (20).

## Open questions and known gaps

- **Constraint tests never seen failing for the right reason.** `schema.listings.test.ts` was written after the migration. You chose to keep it as is.
- **Lever EU boards** (`api.eu.lever.co`) are not on the allow-list, so EU-hosted companies would be refused. Decide when building the curated list.
- **Unescaping:** Greenhouse descriptions are unescaped for the five common HTML codes only; numeric codes (`&#8217;`) have not been seen in real data yet.
- **No live run yet:** the fetchers have only run against saved fixtures.
- **README.md** still describes v1; rewrite when v2 ships.
- **`claude-work` branch** holds vendored third-party skill files: never push it.
