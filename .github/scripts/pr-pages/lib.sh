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

# Browser-enforced network lockdown for a PR page (a <meta> CSP in index.html): the page may talk to its own
# origin only, so even PR code that had a Firebase config could not write to Firebase / production endpoints.
# It does NOT isolate same-origin storage (see docs/PR-PAGES.md "Trust model").
# worker-src / frame-src / child-src are 'none' on purpose: a Worker or a framed same-origin document is NOT governed by this <meta> policy (a worker
# has its own, a framed document needs its own), so either could read the shared origin's storage and send it out; the page may create neither.
# (A Service Worker is a worker too: registration needs worker-src, so it is blocked as well. patch-build.sh also refuses any bundle that registers one.)
PR_PAGE_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'none'; frame-src 'none'; child-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
