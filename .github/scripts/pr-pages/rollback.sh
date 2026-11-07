#!/usr/bin/env bash
# Reverts OUR publish commit if (and only if) it is still the tip of main, then re-guards the revert.
# usage: rollback.sh <slug> <pushed_sha>      Prints reverted=true|false.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
slug="${1:?}"; pushed="${2:?}"; valid_slug "$slug" || die "bad slug"
[[ "$pushed" =~ ^[0-9a-f]{40}$ ]] || die "bad pushed sha"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch -q origin main
tip="$(git rev-parse origin/main)"
if [[ "$tip" != "$pushed" ]]; then
  echo "::warning::main moved on (tip ${tip}); NOT auto-reverting ${pushed}. Run this workflow with action=remove for ${slug}."
  echo "reverted=false"; exit 0
fi
git checkout -q -B rollback origin/main
git revert --no-edit "$pushed" >/dev/null
bash "$(dirname "$0")/guard-paths.sh" "$slug" --range "$pushed"
git push -q origin HEAD:main
echo "reverted=true"
