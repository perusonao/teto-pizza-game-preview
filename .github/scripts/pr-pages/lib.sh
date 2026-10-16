#!/usr/bin/env bash
# Shared constants/helpers for the PR-scoped preview pages. Sourced, never executed directly.
# Everything here is plain bash so it can be unit-tested locally (tests/pr-pages.test.sh).

PAGES_BASE="/teto-pizza-game-preview"      # the shared Preview's own base (never changed by PR pages)
PR_PAGES_DIR="pr"                          # top-level dir in this repo; published at ${PAGES_BASE}/pr/<slug>/
PR_PAGES_MAX=5                             # hard cap on simultaneously published PR pages
PR_PAGES_MAX_BYTES=$((60 * 1024 * 1024))   # hard cap on one page's size

die() { echo "::error::$*" >&2; exit 1; }

# slug = pr-<number>-<first 7 chars of the full SHA>; callers validate the inputs first.
make_slug() { printf 'pr-%s-%s' "$1" "${2:0:7}"; }
valid_slug() { [[ "$1" =~ ^pr-[1-9][0-9]{0,5}-[0-9a-f]{7}$ ]]; }
