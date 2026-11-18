# Job Search Copilot

Full-stack job-application tracker with AI features: Claude parses job postings, Voyage AI embeddings + cosine similarity score resume/posting fit, and Claude suggests resume rewrites and a cover letter. See [README.md](README.md) for the product description and design rationale.

## Layout

Two independent npm projects (there is no root `package.json`):

- `client/` – React 19 + TypeScript + Vite + Tailwind 4 + React Router + Clerk. Flat `src/` (one component per file, no subfolders).
- `server/` – Express 5 + TypeScript (run with `tsx`, no build step) + `pg` + Clerk + Anthropic SDK.
- `server/schema.sql` – the whole schema. Starts with `DROP TABLE ... CASCADE`, so **never run it against a database that has data you want to keep**. There are no migrations; schema changes are hand-written `ALTER`s plus an update to `schema.sql`.

## Commands

```bash
# server (http://localhost:3001, port is hardcoded in src/index.ts)
cd server && npm install && npm run dev      # tsx watch
cd server && npm run typecheck               # tsc --noEmit
cd server && npm run lint                    # oxlint, type-aware

# client (http://localhost:5173)
cd client && npm install && npm run dev
cd client && npm run build                   # tsc -b && vite build
cd client && npm run typecheck               # tsc -b
cd client && npm run lint                    # oxlint
```

Checks (same three scripts in both projects): `npm run lint`, `npm run typecheck`, `npm test`. The server linter is oxlint with the type-aware add-on (`oxlint-tsgolint`), because typescript-eslint does not support TypeScript 7. A pre-commit hook in `.githooks/` runs lint + typecheck for whichever project you changed; enable it once per clone with `git config core.hooksPath .githooks`. GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and tests for both projects on every push and pull request, with a throwaway Postgres 17 for the server tests.

Environment files:
- Server secrets live **outside the repo** in `~/.config/job-search-copilot/server.env` (override the path with `ENV_FILE`; loaded in `src/db.ts`): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`. Do not read it or put keys back in the project folder; `.claude/settings.json` denies reads of `.env*` files and that directory.
- `client/.env` (gitignored; public values only): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (defaults to `http://localhost:3001`)

Local DB is Postgres, database `jobtracker`. Server tests: `cd server && npm test` (Vitest + Supertest against a separate `jobtracker_test` database built from `schema.sql`, Clerk/AI mocked; they currently cover applications and job postings plus the phase 0 fixes: errors, dates, database rules, required fields, CORS). Client tests: `cd client && npm test` (Vitest + Testing Library, with `useApi`/`useError`/Clerk mocked). CI is configured in `.github/workflows/ci.yml` but has not run yet (the repo has not been pushed since it was added).

## Server architecture

- `src/app.ts` builds the Express app (exported so tests can import it) and `src/index.ts` only calls `listen`. `app.ts` mounts routers: `/companies`, `/applications`, `/contacts`, `/interview_stages`, `/resumes`. `dotenv.config()` happens in `src/db.ts`, and the Anthropic clients read `process.env` at import time, so `db` must be imported before the AI modules.
- Every route uses `requireAuth` ([middleware.ts](server/src/middleware.ts)) and reads the user with `getAuth(req).userId`.
- `src/routes/applications.ts` is the big one: CRUD plus `/:id/job_postings` (PUT upsert, `/parse` POST, GET), `/:id/matches` (GET, POST), `/:id/suggestions` (GET, `/generate` POST).
- AI helpers: `parseJobPosting.ts`, `compareSkills.ts`, `generateSuggestions.ts` (Claude Haiku; each strips markdown fences then `JSON.parse`s), `getEmbedding.ts` (Voyage `voyage-4-lite` via `fetch`), `similarity.ts` (hand-written cosine similarity; no pgvector on purpose).

### Conventions that matter

- **Ownership is checked in SQL, per route.** Only `companies` and `resumes` have a `user_id` column. Applications, contacts, interview stages, job postings, matches and suggestions are scoped by joining back to `companies.user_id` (e.g. `applications JOIN companies ON applications.company_id = companies.id WHERE ... companies.user_id = $N`). When writing a route that touches child data, always include that join. Return 404 (not 403) for "exists but not yours".
- **Reassignment must be re-authorized.** On PUT/POST that accept `company_id` or `application_id`, verify the *new* parent also belongs to the user (past security bug).
- Queries are parameterized (`$1, $2`); keep it that way. In a route's catch block call `sendServerError(res, err)` ([errors.ts](server/src/errors.ts)): it logs the real error and sends a generic 500 message (never `String(err)`; database error text must not reach the browser). FK violations (`err.code === '23503'`) map to 400 in the route, and CHECK violations (`23514`) map to 400 inside `sendServerError`. Blank required fields are rejected with 400 using `isBlank` from the same file. Errors thrown by `express.json()` (too large, bad JSON) are turned into JSON replies by the error handler at the end of `app.ts`.
- `job_postings.parsed_data` is derived from `raw_text`. The PUT upsert clears it (`NULL`) when the text changes, and `POST /matches` returns 400 if it is missing. Keep these two in sync if you touch either.
- `parsed_data` and `suggested_changes` are JSONB: write them with `JSON.stringify(...)`. Skill lists are `TEXT[]` and are passed as plain arrays.
- Matches are append-only history (each stores `resume_text_snapshot`); suggestions and job postings are one row per application (`UNIQUE application_id`, upsert).
- Server uses extensionless relative imports (`'../db'`) via `moduleResolution: bundler`; `tsconfig` is strict with `noUncheckedIndexedAccess`.

## Client architecture

- `main.tsx` wraps `ClerkProvider > BrowserRouter > ErrorProvider > App`.
- `App.tsx` owns the `companies` and `applications` lists (lifted state) and the routes: `/companies`, `/applications`, `/applications/:id` (`ApplicationDetail`), `/resumes`; `/` redirects to `/applications`.
- `ApplicationDetail` composes section components: `ApplicationContacts`, `InterviewStages`, `JobPostings`, `Matches`, `Suggestions`. Each section fetches its own data from `/applications/:id/...`.
- All API calls go through `useApi()` ([useApi.ts](client/src/useApi.ts)), which attaches the Clerk bearer token and throws an `Error` with a readable message on non-2xx (the server's `error` field, or "Request too large" / "Request failed (status)" / "Can't reach the server" when the reply isn't JSON). It returns one stable function (`useCallback`), so effects can list `apiFetch` and `setErrorMessage` as dependencies. Callers `.catch` and call `setErrorMessage(err.message)` from `useError()`, which feeds the global `ErrorBanner`.
- Types for API payloads live in [types.ts](client/src/types.ts) and mirror the DB columns (snake_case).
- Styling: Tailwind utility classes plus shared component classes defined in `index.css` (`card`, `divider`, `input-field`, `form-label`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `skeleton`). Reuse these rather than re-spelling the utilities. Dark slate/sky theme. Icons from `lucide-react`.
- Dates: `DATE` columns come back as plain `YYYY-MM-DD` strings (type parser in `db.ts`), and `interview_stages.scheduled_date` is `TIMESTAMPTZ` (sent as a UTC ISO string; convert for `datetime-local` inputs with `dateUtils.ts`). Never `new Date()` a plain date string (it is read as UTC and can show the previous day); use `formatDate`.
- Lint is clean in both projects; keep it that way (`useEffect` dependency lists must be complete).

## Known issues (not yet fixed)

Phase 0 fixed the signed-out `Bearer null` requests, the raw database errors sent to the browser, the form/date/time bugs and the lint warnings. Still open:

- AI responses are parsed with fence-stripping + `JSON.parse` with no shape validation or `stop_reason` check, and `parseJobPosting.ts` has a malformed key in its prompt example. (Replaced by a validated Claude wrapper in v2.)
- Nothing limits how often or how much the paid AI routes can be called; the "Run Match" and "Parse" buttons have no loading state, so a double-click means two paid calls. (v2: per-user limits and a monthly spending cap.)
- Input validation is limited to blank-name checks; there is no schema-based validation of request bodies.
- The ownership-check SQL is duplicated ~15 times across route files, and some `UPDATE`/`DELETE` statements rely on a separate check just before them instead of checking ownership themselves.
- Job-posting text goes straight into Claude prompts with no prompt-injection defenses (v2 requirement, see `docs/v2-spec.md`).
- `npm audit` reports vulnerable dependencies (see the dependency ticket in the spec).

## Working style for this repo

- Match the surrounding code. The existing code is hand-written with explanatory comments aimed at a learner; for new comments follow the Comments section below (explain why, not what, and keep them concise).
- Do not run `server/schema.sql` against the local DB without asking; it deletes existing data.
- Do not commit `.env` files (they are gitignored).
- **After every change, justify it and list what to review by eye.** When you finish a change, explain your reasoning (what you changed, why, and what you considered and rejected). Then list the specific code the owner should read for themselves, with file and line links: anything touching authentication, ownership checks, secrets, CORS, error messages and logs, spending limits, user data or deletion, URL fetching, or the schema. For each item say what to look for and what could go wrong. "Check by hand" means sensitive or correctness-critical code, not just features worth clicking through. Also state anything you could not verify or that tests don't cover.


## Testing
- Favor a small number of meaningful tests over exhaustive coverage.
- Do not write tests that only restate what the type system or ORM already guarantees.
- Do test schema constraints our own code relies on (unique keys, foreign keys).
- Never mock the thing being tested.


## Comments
- Don't write comments that restate the code. Explain why, not what.
- When you change a function, update or delete any comment that no longer matches.