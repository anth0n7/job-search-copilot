# Plan: where we stand and what comes next

Last updated 2026-11-21. The full design is in [docs/v2-spec.md](docs/v2-spec.md); this file is the short version of progress. Ticket numbers below are the ones in section 11 of the spec.

## Where we stand

Branch `v2`, at `e1713e6` (merge of PR #4: the job-listings ticket 3 + 4 is merged). Ticket 2 (dependency audit) is on branch `ticket-2-dependency-audit`. CI green on `v2`. Server: 117 tests passing; client: 30. Lint and typecheck clean in both.

### Done

| Ticket | What | Where |
|---|---|---|
| Phase 0 | Bug fixes for the kept v1 code, tests, lint, CI, pre-commit hook | merged earlier |
| 1 | `v2` branch; ownership rules in one place (`repositories/owned.ts`) | merged earlier |
| 19 | v1 AI code and its tables removed | merged earlier |
| 3 (part) | `company_boards` and `listings` tables + migration `0002` | PR #2 |
| 4 (part) | Safe HTTP helper and Greenhouse / Lever / Ashby fetchers with fixture tests | PR #2 |
| 3 + 4 (rest) | Listings repository, `npm run fetch:boards`, `npm run seed:boards`, 57 curated boards (48 US tech + 9 with Houston jobs), first real run: 11,426 listings, 148 in Houston | PR #4 |
| 2 | Dependency audit: lockfiles updated, CI audit step (high/critical in production deps); 4 dev-only moderate findings in drizzle-kit's esbuild accepted | branch `ticket-2-dependency-audit` |
| Workflow | `./check.sh`, Stop hook, workflow rules in CLAUDE.md, CHANGELOG.md, client build in CI; branch protection on `main` and `v2` | PR #3 |

### Local setup

- `jobtracker_v2` has all migrations applied, including `0002`. The server's env file points at it.
- `jobtracker` (v1 sample data): do not touch.
- The pre-commit hook is on (`core.hooksPath .githooks`). It runs lint + typecheck, not tests.
- Server (`cd server && npm run dev`) and client (`cd client && npm run dev`) both run; the page renders.

## Earlier: the job-listings ticket (3 + 4)

Boards are in `server/data/boards.json`; `npm run seed:boards` loads them into `company_boards` and `npm run fetch:boards` fetches them all. The first real run against `jobtracker_v2` fetched all 57 boards (0 failed) in about 22 seconds.

**Not in this ticket (on purpose):** marking listings closed (ticket 5, with a safety rule against closing everything after a failed fetch; it also decides whether saving a closed posting again reopens it), duplicates across sources (once Remotive exists), and per-user following of boards (ticket 16).

## After that

In the order agreed so far. The order after deployment is still open.

1. **Deployment (rest of ticket 3):** Neon database + Vercel. Revisit a confirmation guard in `migrate.ts` before any non-local migration.
2. **Daily job (ticket 5):** refresh boards, store similarity numbers, mark closed listings; Remotive.
3. **Discover page (ticket 7)** and **profile bar (ticket 8).**
4. **AI tickets (9-12, 14):** PDF resume reading, posting extraction, spending limits and the $4 cap, hybrid scoring, tuning set, tailoring. Prices to be rechecked first.
5. **The rest:** Adzuna search (6), Save / Apply flow (13), guest mode (15), add company by link or name (16), delete my data (17), manual application (18), Adzuna company suggestions (20).

## Open questions and known gaps

- **Constraint tests never seen failing for the right reason.** `schema.listings.test.ts` was written after the migration. You chose to keep it as is.
- **Lever EU boards** (`api.eu.lever.co`) are not on the allow-list, so EU-hosted companies would be refused. None are on the curated list.
- **Board names with a dot** (e.g. Persona AI's `persona.ai`) are refused by our lowercase-letters, digits, `_` and `-` rule, so that company is not on the list.
- **Unescaping:** Greenhouse descriptions are unescaped for the five common HTML codes only; numeric codes (`&#8217;`) have not been seen in real data yet.
- **Ashby secondary locations are dropped:** only a posting's main location is stored, so a role listed as "Remote" with Houston as a second location is not found by a Houston search (Directive: 64 listings, 0 matched; Pariveda 3 of 4). Decide in the Discover ticket (7).
- **Rare text quirks in real data:** 2 Twilio postings contain literal `<...>` text (not HTML), 1 Okta posting has a stray `&amp;`, and 1 Zoox posting has no description at all.
- **README.md** still describes v1; rewrite when v2 ships.
- **`claude-work` branch** holds vendored third-party skill files: never push it.
