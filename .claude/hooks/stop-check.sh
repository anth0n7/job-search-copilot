#!/bin/sh
# Claude Code Stop hook: runs ./check.sh when Claude finishes a turn, but only if code under client/
# or server/ has uncommitted changes that have not already passed. Exit 2 sends Claude back to fix
# the failure (stderr is shown to it); exit 0 lets it stop.
cd "$(git rev-parse --show-toplevel)" || exit 0

# Claude Code sets stop_hook_active when Claude is already continuing because of this hook. Letting it
# stop then caps the retries at one per turn, so it reports the failure instead of looping.
if grep -q '"stop_hook_active": *true'; then
  exit 0
fi

# fingerprint = the uncommitted diff plus the contents of new, untracked files
changes=$( { git diff HEAD -- client server; git ls-files --others --exclude-standard -z -- client server | xargs -0 cat 2>/dev/null; } )
[ -z "$changes" ] && exit 0
fingerprint=$(printf '%s' "$changes" | shasum | cut -d' ' -f1)

# kept inside .git/ so it is never committed
last_green="$(git rev-parse --git-dir)/claude-last-green"
[ -f "$last_green" ] && [ "$(cat "$last_green")" = "$fingerprint" ] && exit 0

log=$(mktemp)
if ./check.sh >"$log" 2>&1; then
  echo "$fingerprint" >"$last_green"
  rm -f "$log"
  exit 0
fi

{
  echo "./check.sh failed. Fix it, or report the failure if this is the second attempt. Last lines:"
  tail -n 40 "$log"
} >&2
rm -f "$log"
exit 2
