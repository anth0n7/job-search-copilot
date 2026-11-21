# Changelog

One entry per ticket from [docs/v2-spec.md](docs/v2-spec.md) section 11, newest first, added in the same commit as the work.

<!-- Template:
## Ticket N: short title (YYYY-MM-DD)
- **What changed:**
- **Why:**
- **Decisions and assumptions:** (choices made without asking, and what they rest on)
- **Commit:** the commit message names this ticket
-->

## Ticket 2: dependency vulnerabilities (2026-11-21)
- **What changed:** `npm audit fix` in both projects (lockfiles only, no `package.json` change, no major upgrades). CI now runs `npm audit --omit=dev --audit-level=high` as the last step of both the server and client jobs.
- **Why:** the audit reported 7 findings in the server and 2 in the client (the spec's list of 8 and 6 was from 2026-11-17 and has moved on). `picomatch` 4.0.7 is no longer flagged by the audit and needed no change.
- **Findings and decisions:**
  - `body-parser` (high, DoS from trailing bytes after a compressed body): reachable. `express.json()` is mounted (`server/src/app.ts:27`) and decompresses gzip. Updated.
  - `qs` (moderate, parsing/stringify DoS): not reachable today. Express 5 uses Node's built-in query parser, and only `express.json()` is mounted. Updated anyway.
  - `proxy-addr` (critical, IP spoofing through an IPv4-mapped IPv6 trust subnet): not exploitable today. It is only consulted when `trust proxy` is set, and nothing reads `req.ip`. It would matter if `trust proxy` is later set with an IPv4 subnet (for example behind Vercel). Updated anyway.
  - Client `vite` (high, dev-server and `launch-editor` issues) and `source-map-js` (high, DoS through a crafted source map): only reachable while `npm run dev` runs on a developer machine. Updated anyway. `vite` went 8.2.0 -> 8.3.8, a minor bump within the `^8.1.1` range, not a patch. What moved with it: rolldown and its native bindings 1.2.1 -> 1.2.19, `postcss` 8.5.25 -> 8.5.33, `@oxc-project/types` 0.142 -> 0.156, and an optional wasm binding that pulls the pre-release `@emnapi/*` 2.0.0-beta.2 (installed only on that platform).
  - Server `drizzle-kit` -> `@esbuild-kit/*` -> `esbuild@0.18.20` (moderate, any website can query the esbuild dev server): **not fixed, accepted.** It is dev-only and we never run esbuild's serve mode. The only fix npm offers (`--force`) installs drizzle-kit 0.18.1, a downgrade. drizzle-kit 1.0.0-rc.5 no longer depends on `@esbuild-kit`, so revisit when drizzle-kit 1.0 is stable. Considered and rejected: an npm `overrides` entry forcing a newer esbuild, because it forces an unreviewed transitive version into a tool that generates our migrations. The server audit still reports these 4 moderate findings; the production audit is clean.
- **Decisions and assumptions:**
  - CI threshold: fail on high or critical in production dependencies (`--omit=dev`). Moderate findings and dev-only findings do not fail CI: they do not ship, and a new advisory in a build tool should not block unrelated PRs. They are read by hand at each ticket.
  - For npm's purposes `vite`, `postcss` and `source-map-js` ARE production dependencies in the client: `client/package.json` lists `@tailwindcss/vite` under `dependencies`, which peers on `vite`, and `node_modules/vite` has no `"dev": true`. So a future high advisory in `vite` WILL fail CI even though it is a build tool. Chosen: document it and leave `package.json` alone. Moving `@tailwindcss/vite` and `tailwindcss` to `devDependencies` is a possible later change that needs owner approval.
  - The audit is the last step of each job, so an advisory or an `npm audit` outage does not stop lint and tests from running.
  - A new advisory can make CI red with no code change; the answer is to run `npm audit fix` or document an exception here.
  - Verified with `./check.sh` (green). The audit is CI-only (it needs network).
- **Commit:** the commit message names ticket 2

## Ticket 3 + 4 (rest): curated boards and first real run (2026-11-19)
- **What changed:** `server/data/boards.json` with 57 boards: 34 Greenhouse, 3 Lever, 20 Ashby (48 well-known US tech companies, approved by the owner, plus 9 found because they hire in Houston: Fervo Energy, Venus Aerospace, Bot Auto, ON.energy, Rugged Robotics, Sunnova, Pariveda, Directive, Base Power). Loaded into `jobtracker_v2` and fetched for real.
- **Why:** steps 3 and 4 of the plan. Result: 57 of 57 boards fetched, 0 failed, 11,426 listings, 1 posting skipped as unusable, 148 listings with Houston in the location.
- **Decisions and assumptions:**
  - Every board was checked against the live provider API (answers, has open jobs) before it was added; boards that 404 or had no jobs were left out. Ashby names in lowercase all work.
  - The Houston additions were found with a web search for employers on these three providers, then checked against the live API for current Houston postings. Employers with only a few Houston roles outside tech/engineering (construction, therapy, property management) were left out.
  - Descriptions in the database were checked for leftover HTML: none. The few oddities are in the plan's open questions.
  - Only Houston in a posting's main location is counted; Ashby secondary locations are not stored (plan.md, open questions).
  - Run only against the local development database `jobtracker_v2` (the commands print the name first).
- **Commit:** "Add curated board list and first real run (ticket 3 + 4, rest)"

## Ticket 3 + 4 (part): board loader (2026-11-19)
- **What changed:** `npm run seed:boards` (`server/src/seedBoards.ts`) loads `server/data/boards.json` into `company_boards`; `addBoards` in the listings repository does the insert. The list itself comes in a separate commit after the owner approves it.
- **Why:** step 3 of the plan: a way to get the curated list into the database.
- **Decisions and assumptions:**
  - Safe to run again: a board already there only gets its company name refreshed.
  - The file is checked for shape with Zod (already a dependency); the database rules still reject an uppercase or unsafe board name, and a bad entry rejects the whole load rather than loading part of it.
  - Prints the database name first, like `db:migrate`.
- **Commit:** "Add seed:boards loader (ticket 3 + 4, part)"

## Ticket 3 + 4 (part): fetch command (2026-11-19)
- **What changed:** `npm run fetch:boards` (`server/src/fetchBoards.ts`) visits every row of `company_boards` through `fetchAllBoards` (`server/src/boards/fetchAll.ts`), saves the listings, and prints board and listing counts. `listBoards` added to the listings repository.
- **Why:** step 2 of the plan: something has to call the fetchers and the repository.
- **Decisions and assumptions:**
  - Boards run one after another (kind to the providers; the list is small). One failing board is recorded and skipped.
  - An unreachable board (network or HTTP error) and an unreadable reply (valid JSON, wrong shape) store different fixed messages. A database error while saving is logged by code only and leaves the board's message alone, since it is not the board's fault.
  - "Skipped" in the output means postings the fetchers rejected as unusable, counted separately from failed boards.
  - Exit code is 1 if any board failed, so a scheduler can notice later. It prints the database name first, like `db:migrate`.
  - Tests fake only the network call; boards, parsers and saving run for real against the test database.
- **Commit:** "Add fetch:boards command (ticket 3 + 4, part)"

## Ticket 3 + 4 (part): listings repository (2026-11-19)
- **What changed:** `server/src/repositories/listings.ts` with `saveBoardListings` (upsert a board's listings and mark the board fetched, in one transaction) and `recordFetchFailure` (fixed messages only). A lint rule in `server/.oxlintrc.json` makes any import of it from `src/routes/` fail.
- **Why:** the fetchers return listings but nothing stored them. This is step 1 of the plan; the fetch command, the company list and the first real run are the next steps.
- **Decisions and assumptions:**
  - Saving and marking the board fetched share one transaction, so a failed save never leaves a board looking fresh.
  - Rows are inserted 200 at a time (Postgres caps the values in one statement); a repeated id inside one reply keeps the last copy.
  - An update refreshes title, location, link, description, posted date and `last_seen_at`. `first_seen_at` and `closed_at` are untouched; whether saving a closed posting again reopens it is left to ticket 5.
  - `recordFetchFailure` takes a key into `fetchErrors`, not text, so raw error text cannot reach the column.
  - No schema change, migration, dependency or route.
- **Commit:** "Add listings repository (ticket 3 + 4, part)"

## Workflow setup (2026-11-18)
- **What changed:** added `./check.sh` (lint, typecheck, tests for both projects plus the client build), a Claude Code Stop hook that runs it when code under `client/` or `server/` changed, a `Workflow rules` section in `CLAUDE.md`, this changelog, and the client build step in CI.
- **Why:** one command that decides "green", run automatically, with the same steps in CI, so a change is never called done on red.
- **Decisions and assumptions:**
  - `check.sh` leaves out the schema-vs-migrations check because `db:generate` writes a file when they differ; CI keeps it.
  - No example env file: the variable names are listed in `CLAUDE.md`, and the server's real env file lives outside the repo.
  - Secrets scanning uses GitHub's built-in secret scanning and push protection (already on); no CI scanner.
  - The pre-commit hook is unchanged (lint + typecheck).
  - Branch protection on `main` and `v2` is set by hand on GitHub: PR required, CI required, 0 approvals (GitHub does not let an author approve their own PR); the owner merges.
- **Commit:** "Workflow setup: check script, Stop hook, workflow rules, changelog"
