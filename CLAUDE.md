# Job Search Copilot

Full-stack job-application tracker. **This is the `v2` branch**: v1's AI features (Claude job-posting parsing, Voyage embeddings + cosine similarity scoring, resume suggestions and cover letter) were removed on purpose and are being replaced by job discovery, hybrid scoring and tailoring. The plan is in [docs/v2-spec.md](docs/v2-spec.md). [README.md](README.md) still describes v1 (the `main` branch) until v2 ships.

## Layout

Two independent npm projects (there is no root `package.json`):

- `client/` – React 19 + TypeScript + Vite + Tailwind 4 + React Router + Clerk. Flat `src/` (one component per file, no subfolders).
- `server/` – Express 5 + TypeScript (run with `tsx`, no build step) + `pg` + Clerk. The Anthropic SDK is installed but unused until the v2 Claude wrapper is built.
- `server/src/schema.ts` – the whole schema, written with Drizzle (tables, constraints, indexes). `server/drizzle/` holds the numbered SQL migrations generated from it (plus hand-written ones, e.g. the `updated_at` trigger). Workflow: edit `schema.ts`, run `npm run db:generate`, **read the generated SQL** (it must not contain `DROP` unless intended), commit both, then apply with `npm run db:migrate`. Never edit a migration that has already been applied, and never use `drizzle-kit push` (it changes a database without reviewed SQL). CI fails if `schema.ts` and the migrations disagree.

## Commands

```bash
# server (http://localhost:3001, port is hardcoded in src/index.ts)
cd server && npm install && npm run dev      # tsx watch
cd server && npm run typecheck               # tsc --noEmit
cd server && npm run lint                    # oxlint, type-aware
cd server && npm run db:generate             # write a migration from schema.ts changes (never connects)
cd server && npm run db:migrate              # apply pending migrations to DATABASE_URL (prints the database name first)

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

Local DB is Postgres, database `jobtracker`. Server tests: `cd server && npm test` (Vitest + Supertest against a separate `jobtracker_test` database rebuilt from the migrations in `server/drizzle/` before every run, Clerk/AI mocked; they currently cover applications and job postings plus the phase 0 fixes: errors, dates, database rules, required fields, CORS). Client tests: `cd client && npm test` (Vitest + Testing Library, with `useApi`/`useError`/Clerk mocked). CI (`.github/workflows/ci.yml`) runs on every push; its first run on `v2` passed.

## Server architecture

- `src/app.ts` builds the Express app (exported so tests can import it) and `src/index.ts` only calls `listen`. `app.ts` mounts routers: `/companies`, `/applications`, `/contacts`, `/interview_stages`, `/resumes`. `dotenv.config()` happens in `src/db.ts`, and `app.ts` imports `./db` first (as a side-effect import) so the secrets are loaded before any module that reads `process.env` at import time (the future AI modules will).
- Every route uses `requireAuth` ([middleware.ts](server/src/middleware.ts)) and reads the user with `getAuth(req).userId`. Routes only handle HTTP (read the request, check the input, call a repository, send the answer); all SQL lives in `src/repositories/` (Drizzle).
- `src/routes/applications.ts`: CRUD plus `/:id/interview_stages`. The v1 job-posting, match and suggestion routes and the AI helper files were deleted (spec ticket 19); their database tables were removed from the schema.

### Conventions that matter

- **Ownership is built into the repositories.** Only `companies` and `resumes` have a `user_id` column. Applications, contacts and interview stages belong to a user through a company (stages: application -> company). That chain is defined once in [repositories/owned.ts](server/src/repositories/owned.ts) (`ownedCompanyIds`, `ownedApplicationIds`, `ownsCompany`, `ownsApplication`), and every repository function takes the `userId` and puts it in the query itself, including `update` and `delete`. Never query a table from a route, and never add a repository function without the `userId` parameter. Return `null` (the route answers 404, not 403) for "not found" and "not yours" alike.
- **Reassignment must be re-authorized.** Repository create/update functions that take a `company_id` or `application_id` call `ownsCompany` / `ownsApplication` on the NEW parent first (past security bug). Tests cover this for each route.
- **Ids:** route ids go through `parseId` (a non-numeric id is a 404, never a database error); ids in a request body are checked with `isId`.
- Schema property names are snake_case (`company_id`, `created_at`) so a database row is the API payload and the client's types mirror it; no mapping layer.
- Queries go through Drizzle (parameterized); never build SQL by string concatenation. In a route's catch block call `sendServerError(res, err)` ([errors.ts](server/src/errors.ts)): it logs the real error and sends a generic 500 message (never `String(err)`; database error text must not reach the browser). FK violations (`errorCode(err) === '23503'`) map to 400 in the route, CHECK violations (`23514`) to 400 and unique violations (`23505`) to 409 inside `sendServerError`. Drizzle wraps database errors and puts the query values in its message, so read codes with `errorCode` and never log the wrapper (`sendServerError` already logs only the original error). Blank required fields are rejected with 400 using `isBlank` from the same file. Errors thrown by `express.json()` (too large, bad JSON) are turned into JSON replies by the error handler at the end of `app.ts`.
- Server uses extensionless relative imports (`'../db'`) via `moduleResolution: bundler`; `tsconfig` is strict with `noUncheckedIndexedAccess`.

## Client architecture

- `main.tsx` wraps `ClerkProvider > BrowserRouter > ErrorProvider > App`.
- `App.tsx` owns the `companies` and `applications` lists (lifted state) and the routes: `/companies`, `/applications`, `/applications/:id` (`ApplicationDetail`), `/resumes`; `/` redirects to `/applications`.
- `ApplicationDetail` composes section components: `ApplicationContacts` and `InterviewStages`. Each section fetches its own data.
- All API calls go through `useApi()` ([useApi.ts](client/src/useApi.ts)), which attaches the Clerk bearer token and throws an `Error` with a readable message on non-2xx (the server's `error` field, or "Request too large" / "Request failed (status)" / "Can't reach the server" when the reply isn't JSON). It returns one stable function (`useCallback`), so effects can list `apiFetch` and `setErrorMessage` as dependencies. Callers `.catch` and call `setErrorMessage(err.message)` from `useError()`, which feeds the global `ErrorBanner`.
- Types for API payloads live in [types.ts](client/src/types.ts) and mirror the DB columns (snake_case).
- Styling: Tailwind utility classes plus shared component classes defined in `index.css` (`card`, `divider`, `input-field`, `form-label`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `skeleton`). Reuse these rather than re-spelling the utilities. Dark slate/sky theme. Icons from `lucide-react`.
- Dates: `DATE` columns come back as plain `YYYY-MM-DD` strings (type parser in `db.ts`), and `interview_stages.scheduled_date` is `TIMESTAMPTZ` (sent as a UTC ISO string; convert for `datetime-local` inputs with `dateUtils.ts`). Never `new Date()` a plain date string (it is read as UTC and can show the previous day); use `formatDate`.
- Lint is clean in both projects; keep it that way (`useEffect` dependency lists must be complete).

## Known issues (not yet fixed)

Phase 0 fixed the signed-out `Bearer null` requests, the raw database errors sent to the browser, the form/date/time bugs and the lint warnings. Still open:

- The v1 AI features are gone, so the AI-related problems found earlier (unvalidated Claude replies, no spending limits, no loading state on the paid buttons, no prompt-injection defenses) are now **requirements for the v2 AI tickets** in `docs/v2-spec.md`, not bugs in this code.
- Input validation is limited to blank-name checks; there is no schema-based validation of request bodies.
- Route input checks are hand-written per route (`readXInput` functions); there is no schema-based validation library yet (Zod is planned).
- Routes use `getAuth(req).userId!` (trusting `requireAuth` ran first). A `currentUserId(req)` helper that throws when there is no user is proposed but not yet approved.
- `npm audit` reports vulnerable dependencies (see the dependency ticket in the spec).

## Working style for this repo

- Match the surrounding code. The existing code is hand-written with explanatory comments aimed at a learner; for new comments follow the Comments section below (explain why, not what, and keep them concise).
- Do not run `npm run db:migrate` against any database other than a local development one without asking, and always check the database name it prints. Migrations that drop or rewrite data need explicit approval.
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