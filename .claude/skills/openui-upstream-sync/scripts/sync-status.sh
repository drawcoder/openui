#!/usr/bin/env bash
# sync-status.sh — Phase 1 helper for openui-upstream-sync skill.
#
# Prints:
#   - Baseline SHA (parsed from the most recent `Synced-From:` trailer for the given package)
#   - Candidate commits in scope (upstream baseline..upstream/main, path-filtered)
#
# Usage:
#   .claude/skills/openui-upstream-sync/scripts/sync-status.sh lang-core
#   .claude/skills/openui-upstream-sync/scripts/sync-status.sh react-headless
#
# Environment: requires bash (Git Bash on Windows is fine). Run from repo root.

set -euo pipefail

PKG="${1:-}"
if [[ -z "$PKG" ]]; then
  echo "usage: sync-status.sh <lang-core|react-headless>" >&2
  exit 2
fi

case "$PKG" in
  lang-core|react-headless) ;;
  *)
    echo "error: $PKG is not in sync scope. Allowed: lang-core, react-headless." >&2
    exit 2
    ;;
esac

PATHSPEC="packages/$PKG"

# Fetch latest upstream silently.
git fetch upstream --quiet 2>/dev/null || {
  echo "error: 'git fetch upstream' failed. Is the upstream remote configured?" >&2
  exit 1
}

# Parse most recent `Synced-From:` trailer for this package.
BASELINE=$(
  git log --grep="Synced-From:.*$PKG" -n 1 --pretty=%B 2>/dev/null \
    | git interpret-trailers --parse --if-missing=doNothing 2>/dev/null \
    | grep '^Synced-From:' \
    | grep "$PKG" \
    | tail -1 \
    | sed -E 's/Synced-From: [^@]+@([a-f0-9]+).*/\1/' \
    || true
)

if [[ -z "$BASELINE" ]]; then
  BASELINE=$(git rev-list --max-parents=0 upstream/main | head -1)
  echo "ℹ️  No prior Synced-From trailer for $PKG."
  echo "    Using upstream/main root as initial baseline: $BASELINE"
else
  echo "📌 Baseline (from trailer): $BASELINE"
fi

echo ""
echo "📋 Candidate commits in $PATHSPEC since $BASELINE:"
echo ""

COUNT=$(git rev-list --count "$BASELINE..upstream/main" -- "$PATHSPEC" 2>/dev/null || echo 0)

if [[ "$COUNT" == "0" ]]; then
  echo "  (none — $PKG is up to date with upstream)"
  exit 0
fi

git --no-pager log --oneline "$BASELINE..upstream/main" -- "$PATHSPEC"

echo ""
echo "Total: $COUNT commit(s) in scope."
echo ""
echo "Next: classify into themes and write .sync/reports/$(date +%Y-%m-%d)-$PKG.md"
echo "Then wait for human checkbox decisions before Phase 3 (apply)."
