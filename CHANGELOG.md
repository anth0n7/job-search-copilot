# Changelog

One entry per ticket from [docs/v2-spec.md](docs/v2-spec.md) section 11, newest first, added in the same commit as the work.

<!-- Template:
## Ticket N: short title (YYYY-MM-DD)
- **What changed:**
- **Why:**
- **Decisions and assumptions:** (choices made without asking, and what they rest on)
- **Commit:** the commit message names this ticket
-->

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
