#!/bin/sh
# The one local check: lint, typecheck, tests and build for both projects, stopping at the first failure.
# CI (.github/workflows/ci.yml) runs the same steps. Two checks are CI-only: schema-vs-migrations (running
# `db:generate` locally would write a new migration file instead of just reporting the drift) and `npm audit` (needs network).
set -e
cd "$(dirname "$0")"

# the server tests need the local Postgres (database jobtracker_test); say so plainly instead of
# letting every test fail with a connection error
if ! pg_isready -q -h localhost -p 5432; then
  echo "check: Postgres is not running on localhost:5432. Start it and run ./check.sh again." >&2
  exit 1
fi

step() {
  echo "check: $1 → npm run $2"
  (cd "$1" && npm run --silent "$2")
}

# the server has no build step (it runs with tsx); typecheck covers what a build would catch
step server lint
step server typecheck
step server test

step client lint
step client typecheck
step client test
step client build

echo "check: all green"
