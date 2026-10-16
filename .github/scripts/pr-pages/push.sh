#!/usr/bin/env bash
# Commits the staged change and pushes it to main with a bounded retry.
# After every rebase the guard is re-run against origin/main..HEAD, so a concurrent push can never
# make this commit touch anything outside pr/<slug>/ . Prints the pushed commit as sha=... .
# usage: push.sh <slug> <message>
set -euo pipefail
source "$(dirname "$0")/lib.sh"
slug="${1:?}"; msg="${2:?}"
git diff --cached --quiet && { echo "No changes to publish."; echo "changed=false"; exit 0; }
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -q -m "$msg"
for attempt in 1 2 3; do
  git fetch -q origin main
  git rebase -q origin/main || { git rebase --abort || true; die "rebase onto origin/main failed (attempt ${attempt})"; }
  bash "$(dirname "$0")/guard-paths.sh" "$slug" --range origin/main
  if git push -q origin HEAD:main; then
    echo "changed=true"; echo "sha=$(git rev-parse HEAD)"; exit 0
  fi
  echo "push rejected (attempt ${attempt}); retrying"; sleep $((attempt * 3))
done
die "could not push after 3 attempts; nothing was published (local commit only)"
