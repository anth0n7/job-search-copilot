# Job Search Copilot v2: Spec

Status: DRAFT for owner review (2026-11-17). Nothing here is built yet. Every change needs the owner's approval before it is attempted.

## 1. Purpose and approach

- **Goal:** an AI-native job-discovery app. It finds jobs, scores how well each fits the user's resume, and tailors the resume and a cover letter to a chosen job.
- **Audience, in order:** recruiters reviewing a portfolio, then friends and family, then maybe the public.
- **"Agentic engineering"** describes how the project is built, not a feature.
- **Evolve, don't rewrite.** v1's tracker (companies, applications, contacts, interview stages) stays. Discovery, scoring and tailoring are added.
- **Process:** phase 0 bug fixes, then this spec, then tickets (GitHub issues, each linking here), then test-first implementation. The owner approves each change before it is attempted.
- **Branches:** `main` is never touched directly. `claude-work` holds phase 0. `v2` is created from `claude-work` after phase 0 and holds all v2 work.

## 2. Hosting and data

- **Database:** Neon Postgres (free tier). v2 starts with an empty database and a new schema. The old Railway data was sample data.
- **App:** Vercel hosts the client, the Express server (as one function) and a once-a-day cron. Fallback if limits bite: Northflank.
- **Daily job limits:** Vercel Hobby crons run once a day (timing can drift by up to an hour) and a function may run up to 5 minutes.
- **Secrets** stay outside the repo (`~/.config/job-search-copilot/server.env` locally, host env vars in production).

## 3. Discover (the home page)

### 3.1 Job sources
- **Curated company boards:** 30-50 US tech companies on Greenhouse, Lever or Ashby. The list is a file in the repo. The assistant drafts it and checks every board responds; the owner approves it.
- **Remotive:** fetched by the daily job, at most 4 requests a day, remote jobs.
- **Adzuna:** called live when a user searches. It returns short snippets only, so its scores are labelled "estimated".
- **Attribution:** Adzuna and Remotive require credit links, shown on every listing from them.
- **Coverage:** US jobs plus remote jobs.

### 3.2 Search and filters
- Keyword, location + remote, seniority (rules first, Claude only when rules can't tell), date posted.
- Results are newest first. A **Sort by match** button turns on once the page's scores have arrived.

### 3.3 Daily job
- Fetches every curated and user-added board, plus Remotive.
- Stores new listings with their full text and similarity numbers (cheap).
- Marks listings that disappeared from their board as **closed**. Closed listings leave Discover but stay visible, with their saved text, on any saved job or application that refers to them, labelled "no longer listed".
- Claude reads a posting's skills and level **only the first time anyone sees it** in results. The result is stored and shared by all users.

### 3.4 Duplicates
Listings with the same company, title and location (after normalising spacing and capitals) are one job. The company board's version wins because it has full text.

### 3.5 Profile bar
- Sits at the top of Discover, with a clear **Edit profile** button.
- Fields: preferred locations, work arrangement (remote / hybrid / on-site), US work authorization, security clearance, target level, years of experience.
- Saves automatically and updates results immediately. No separate settings page.
- First resume upload: the bar opens expanded, with level and years read from the resume marked "check these". Afterwards it collapses to a one-line summary.

### 3.6 Hidden jobs
Jobs failing a hard filter (3.7) are removed before scoring. A line at the bottom of results ("8 jobs hidden: 5 location, 2 clearance, 1 level") links to them. A filter removes a job only when the posting **clearly states** the requirement.

### 3.7 Hard filters (applied before scoring, cost nothing)
1. Location: on-site, not remote, outside the user's preferred locations.
2. Requirements the user can't meet: clearance, licence, citizenship / work authorization.
3. Level gap of two or more steps.

### 3.8 Adding companies
- **By careers link:** accepted only if the host name **exactly** matches the approved Greenhouse, Lever or Ashby hosts. Redirects are rechecked before being followed. Anything else gets: "this site isn't supported yet; its jobs may still appear through Adzuna". (Security: prevents SSRF, see section 9.)
- **By name:** the app tries likely board names on all three systems and shows sample job titles so the user can confirm the company. If nothing matches, it asks for the careers link.
- **Sharing:** an added board joins the shared pool (the daily job refreshes it, its jobs appear for everyone). Adding also **follows** the company for that user. Limit: 10 adds per user per day.
- **Later ticket:** suggest companies found through Adzuna listings. It starts by testing, with a real Adzuna key, whether Adzuna's redirect reveals the real board; it is dropped if not.

## 4. Scoring

### 4.1 Hybrid score (0-100)

| Part | Weight |
|---|---|
| Required-skill coverage | 50% |
| Preferred-skill coverage | 20% |
| Semantic similarity (rescaled) | 20% |
| Level / experience fit | 10% |

- **Experience-gap deduction:** 3-4 years short = -5 points; 5+ years short = -10. Shown as its own line.
- **Similarity rescaling:** raw cosine similarity of about 0.3 counts as 0 and about 0.8 as 100. Exact end points come from the tuning set (4.5).
- **Bands:** Strong 80+, Good 65-79, Fair 50-64, Weak under 50. Starting values, tuned in 4.5.

### 4.2 How it is computed
- **Posting:** Claude extracts required skills, preferred skills, level and years once per listing. Shared by all users.
- **Resume:** extracted once, and again only when the resume changes.
- **Coverage:** Claude compares resume skills with a posting's skills, counting synonyms and equivalent experience ("JS" = "JavaScript"). One call compares one resume with up to 10 jobs; a page's calls run concurrently. Each result is cached until the resume changes.
- **Similarity and level fit:** computed in plain code.

### 4.3 Speed
- The list appears immediately; each card shows "scoring..." until its score arrives (target: a few seconds for a page).
- Every shown job gets the full hybrid score. The next page is scored in the background while the user reads the current one.

### 4.4 Adzuna listings
Snippets don't list skills, so these get similarity + level fit only, labelled "estimated (from summary)". The full hybrid is computed once the user pastes the full posting (counts toward the pasted-posting limit).

### 4.5 Tuning and regression set
1. The owner rates 25 resume-job pairs (Strong / Good / Fair / Weak) **before** seeing the app's score.
2. 17 pairs tune the cutoffs and similarity end points.
3. 8 pairs are held back. If the bands agree with the ratings there, the cutoffs are accepted; if not, the weights are revisited rather than nudging cutoffs.
4. The same 25 pairs judge tailoring quality (Haiku vs Sonnet, 5.2).
5. Ratings are stored in the repo and rerun whenever prompts or weights change.

### 4.6 Display
- Results list: the band only.
- Job page: a short **"why this score"** breakdown (the four parts, plus the deduction line if any).

## 5. Applying and tracking

- **Apply** opens the job in a new tab. **Save** and **I applied** buttons create the company, application and posting text automatically. A "Did you apply?" prompt appears when the user returns.
- Contacts and interview stages stay manual, as in v1.
- **Add application manually** stays as a secondary feature for jobs found elsewhere. Pasting the posting text unlocks scoring and tailoring.

## 6. Resume and tailoring

- **One resume per user**, stored as text. PDF upload is read on the server with a free open-source library. If a PDF has no usable text (a scan), the app shows the paste-text box instead.
- **Tailoring** produces a copy **for that job**, stored with the application. The main resume is never changed.
- **Suggestions** appear inline next to the lines they change. Nothing is applied without the user's approval.
- **Exact-quote rule:** every suggestion must quote the resume line it changes. Code checks the quote exists. Suggestions that don't match go in a "couldn't place" list, so none are lost and none attach to the wrong line.
- **Output:** the full revised text with a Copy button, plus a change list (old line -> new line) for copying into a formatted resume. The app does not rebuild PDFs.
- **Cover letter:** a separate "Write cover letter" button. Each click counts as one tailoring run.
- **Removed from v1:** the matched/missing-skills display and its database columns.

## 7. AI model, limits and cost

- **Model:** Claude Haiku 5.5 for everything to start. Tailoring moves to Sonnet 5.5 only if the 25-pair test shows Haiku falls short. (Approx. cost: a posting read about $0.0003, a tailoring run about $0.001 on Haiku vs about $0.02 on Sonnet; prices were checked 2026-11-03 and must be rechecked.)
- **Validation:** every Claude reply is checked against a defined shape, and the stop reason is checked (so truncated replies are caught).
- **Per-user daily limits:** 10 tailoring runs (cover letters included), 5 pasted postings, 10 company adds. Scoring does not count against a user's limits.
- **Global cap:** about **$4 per month**. When reached, the app degrades instead of failing: new jobs show estimated scores only, tailoring pauses with a banner ("AI features are paused until <date>"), and saved scores and tailored resumes keep working.
- **Owner exemption:** the owner's Clerk user ID is exempt from per-user limits.
- **Guest allowance:** a shared 20 tailoring runs per day across all guests, counted toward the global cap.

## 8. Accounts, guests and privacy

- **Sign-up:** open to anyone (recruiters need to try it). Protected by the limits in section 7, not by an invite list.
- **Guests (no sign-in):** can use Discover with a made-up sample resume (mid-level full-stack engineer, about 4 years; drafted by the assistant, approved by the owner). Scores against it are cached and shared by all guests. Guests can try tailoring from the shared allowance. They cannot save, apply or upload a resume.
- **Delete my data:** removes the user's resume, profile, scores, tailored copies and applications. Shared job listings stay. The guest view states the sample resume is made up.

## 9. Security-sensitive areas (verify by eye)

These are the places where a mistake exposes data, money or the server. Each should be read by the owner, not just trusted to tests.

1. **Ownership checks:** applications, contacts, interview stages, postings, tailored copies and scores are scoped to the user in SQL (join to the owner). "Exists but not yours" returns 404. Any route accepting `company_id` or `application_id` must verify the **new** parent belongs to the user.
2. **Authentication and guest paths:** every route requires sign-in except the explicit guest routes, which must never read or write a signed-in user's data.
3. **Company-add URL handling (SSRF):** exact host allow-list, no fetching arbitrary addresses, redirects rechecked.
4. **Spending controls:** per-user limits, guest allowance and the $4 cap must be enforced on the server, before the Claude call.
5. **Error responses and logs:** browsers get generic messages; resume text must not end up in logs or error replies.
6. **CORS:** only the frontend origin (`CLIENT_ORIGIN`).
7. **Secrets:** stay outside the repo; the client holds only public keys.
8. **Delete my data:** must remove everything user-specific, in every table.
9. **Uploaded PDFs:** size and type limits; text extraction only, no code execution.

## 10. Phase 0 (done, uncommitted on `claude-work`)

Seven fix tickets for code v2 keeps: error handling, server reliability and CORS, dates and times, database rules and indexes, form behaviour and required fields, small UI bugs, and signed-out requests. Code v2 replaces was deliberately skipped (parse and match buttons, suggestions-from-stale-match).

## 11. Proposed tickets (draft, in rough order)

1. Create the `v2` branch; extract the repeated ownership-check SQL into one helper.
2. Dependency vulnerabilities: `npm audit` (checked 2026-11-17) reports 8 findings in the server (production: `body-parser` high, `proxy-addr` critical, `qs` moderate) and 6 in the client (production: `picomatch` / `vite` high). Read each advisory, decide whether it is exploitable here, then update the package or document why not. Re-run the audit in CI.
3. New schema for listings, profiles, scores and tailored copies; Neon and Vercel deployment.
4. Board fetchers (Greenhouse, Lever, Ashby) and the curated company file.
5. Daily job: refresh, store, similarity numbers, mark closed; Remotive fetch.
6. Adzuna live search with attribution.
7. Discover page: search, filters, newest-first list, hidden-jobs line.
8. Profile bar.
9. PDF upload and resume reading (with paste fallback).
10. Posting extraction (shared cache), AI-reply validation, usage metering, limits and the $4 cap.
11. Hybrid scoring, batching, "why this score" and Sort by match.
12. Tuning set: 25 rated pairs, calibration, regression check.
13. Save / Apply / "I applied" flow.
14. Tailoring: exact-quote checking, inline suggestions, tailored copy, change list; separate cover letter.
15. Guest mode and sample resume.
16. Add company by name or careers link (SSRF-safe).
17. Delete my data.
18. Add application manually (kept small).
19. Remove v1 matches and skills code. **Done first on `v2`** (before the Drizzle baseline), so the baseline contains only the 5 tables v2 keeps.
20. Later: suggest companies from Adzuna listings (after testing the redirect).

## 12. Unverified assumptions (test before relying on them)

- Adzuna's `us` country code and whether its redirect reveals the destination board.
- Claude pricing figures (checked 2026-11-03).
- Vercel Hobby limits at the time of deployment, and whether its terms allow this use (the plan is non-commercial).
- That 25 pairs are enough to tune the cutoffs.
- Remotive's terms (the plan stays within 4 requests a day with attribution).
