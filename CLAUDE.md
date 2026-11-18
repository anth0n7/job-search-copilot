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
cd server && npx tsc --noEmit                # typecheck (no script for it)

# client (http://localhost:5173)
cd client && npm install && npm run dev
cd client && npm run build                   # tsc -b && vite build (this is the client typecheck)
cd client && npm run lint                    # oxlint
```

Environment files:
- Server secrets live **outside the repo** in `~/.config/job-search-copilot/server.env` (override the path with `ENV_FILE`; loaded in `src/db.ts`): `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`. Do not read it or put keys back in the project folder; `.claude/settings.json` denies reads of `.env*` files and that directory.
- `client/.env` (gitignored; public values only): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL` (defaults to `http://localhost:3001`)

Local DB is Postgres, database `jobtracker`. Server tests: `cd server && npm test` (Vitest + Supertest against a separate `jobtracker_test` database, Clerk/AI mocked; currently covers applications and job postings only). There is no client test setup and no CI.

## Server architecture

- `src/app.ts` builds the Express app (exported so tests can import it) and `src/index.ts` only calls `listen`. `app.ts` mounts routers: `/companies`, `/applications`, `/contacts`, `/interview_stages`, `/resumes`. `dotenv.config()` happens in `src/db.ts`, and the Anthropic clients read `process.env` at import time, so `db` must be imported before the AI modules.
- Every route uses `requireAuth` ([middleware.ts](server/src/middleware.ts)) and reads the user with `getAuth(req).userId`.
- `src/routes/applications.ts` is the big one: CRUD plus `/:id/job_postings` (PUT upsert, `/parse` POST, GET), `/:id/matches` (GET, POST), `/:id/suggestions` (GET, `/generate` POST).
- AI helpers: `parseJobPosting.ts`, `compareSkills.ts`, `generateSuggestions.ts` (Claude Haiku; each strips markdown fences then `JSON.parse`s), `getEmbedding.ts` (Voyage `voyage-4-lite` via `fetch`), `similarity.ts` (hand-written cosine similarity; no pgvector on purpose).

### Conventions that matter

- **Ownership is checked in SQL, per route.** Only `companies` and `resumes` have a `user_id` column. Applications, contacts, interview stages, job postings, matches and suggestions are scoped by joining back to `companies.user_id` (e.g. `applications JOIN companies ON applications.company_id = companies.id WHERE ... companies.user_id = $N`). When writing a route that touches child data, always include that join. Return 404 (not 403) for "exists but not yours".
- **Reassignment must be re-authorized.** On PUT/POST that accept `company_id` or `application_id`, verify the *new* parent also belongs to the user (past security bug).
- Queries are parameterized (`$1, $2`); keep it that way. Error responses are `res.status(500).json({error: String(err)})` inside try/catch; FK violations (`err.code === '23503'`) map to 400.
- `job_postings.parsed_data` is derived from `raw_text`. The PUT upsert clears it (`NULL`) when the text changes, and `POST /matches` returns 400 if it is missing. Keep these two in sync if you touch either.
- `parsed_data` and `suggested_changes` are JSONB: write them with `JSON.stringify(...)`. Skill lists are `TEXT[]` and are passed as plain arrays.
- Matches are append-only history (each stores `resume_text_snapshot`); suggestions and job postings are one row per application (`UNIQUE application_id`, upsert).
- Server uses extensionless relative imports (`'../db'`) via `moduleResolution: bundler`; `tsconfig` is strict with `noUncheckedIndexedAccess`.

## Client architecture

- `main.tsx` wraps `ClerkProvider > BrowserRouter > ErrorProvider > App`.
- `App.tsx` owns the `companies` and `applications` lists (lifted state) and the routes: `/companies`, `/applications`, `/applications/:id` (`ApplicationDetail`), `/resumes`; `/` redirects to `/applications`.
- `ApplicationDetail` composes section components: `ApplicationContacts`, `InterviewStages`, `JobPostings`, `Matches`, `Suggestions`. Each section fetches its own data from `/applications/:id/...`.
- All API calls go through `useApi()` ([useApi.ts](client/src/useApi.ts)), which attaches the Clerk bearer token and throws `new Error(body.error)` on non-2xx. Callers `.catch` and call `setErrorMessage(err.message)` from `useError()`, which feeds the global `ErrorBanner`.
- Types for API payloads live in [types.ts](client/src/types.ts) and mirror the DB columns (snake_case).
- Styling: Tailwind utility classes plus shared component classes defined in `index.css` (`card`, `divider`, `input-field`, `form-label`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `skeleton`). Reuse these rather than re-spelling the utilities. Dark slate/sky theme. Icons from `lucide-react`.
- Lint currently reports `react-hooks/exhaustive-deps` warnings on most `useEffect(..., [id])` calls because `apiFetch` is recreated every render; this is known and not a regression.

## Known issues (not yet fixed)

- `App.tsx` fetches companies/applications once on mount, so it sends `Bearer null` when signed out and does not refetch after sign-in or clear data on sign-out.
- AI responses are parsed with fence-stripping + `JSON.parse` with no shape validation or `stop_reason` check; the prompt example in `parseJobPosting.ts` has a malformed key.
- The "Run Match" button has no loading/disabled state (double-click = two paid calls and two rows).
- Raw `String(err)` is returned to the browser on 500s; no server-side input validation.
- The ownership-check SQL is duplicated ~15 times across route files.

## Working style for this repo

- Match the surrounding code: the existing code is hand-written with explanatory comments aimed at a learner; keep new comments in that spirit but concise.
- Do not run `server/schema.sql` against the local DB without asking; it deletes existing data.
- Do not commit `.env` files (they are gitignored).
- **After every change, justify it and list what to review by eye.** When you finish a change, explain your reasoning (what you changed, why, and what you considered and rejected). Then list the specific code the owner should read for themselves, with file and line links: anything touching authentication, ownership checks, secrets, CORS, error messages and logs, spending limits, user data or deletion, URL fetching, or the schema. For each item say what to look for and what could go wrong. "Check by hand" means sensitive or correctness-critical code, not just features worth clicking through. Also state anything you could not verify or that tests don't cover.
