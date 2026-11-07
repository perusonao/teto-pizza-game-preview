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
# Workers are denied outright ('none'): a worker script is NOT governed by the creating document's CSP, so allowing one would
# let PR code relay data around connect-src. Frames/child contexts are denied too (a same-origin child document would not inherit this meta CSP).
# It does NOT isolate same-origin storage (see docs/PR-PAGES.md "Trust model").
PR_PAGE_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'none'; child-src 'none'; frame-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"

# --- Batch 19 iPhone HV: the ONE fixed-SHA exception (Owner decision, Issue #774 / PR #783) -------------------------------
# PR #783's own head is B19_PR_HEAD. The Preview-only HV seed lives on a descendant commit that is not a PR head, so the
# normal "sha == current PR head" rule would refuse it. Exactly this (PR number, SHA) pair is accepted when, in addition,
# PR #783 is still open at B19_PR_HEAD, the SHA is strictly AHEAD of that head, and every file changed between them is in
# B19_ALLOWED_PATHS (the seed + its tests + docs; no package.json / lockfile / build config, so the build scripts that run
# are exactly PR #783's own).
B19_PR_NUMBER="783"
B19_PR_HEAD="abb3da5a1021b160b2ee75acbe5a00866a8a0eaf"
B19_HV_SHA="8137dc3ba61d636d777b05596b8866f5a74a9d03"
B19_ALLOWED_PATHS='^(src/preview/(b19HvSeeds\.ts|b19HvSeeds\.test\.ts|hvSeeds\.ts|previewIsolation\.gate\.test\.ts)|docs/.*)$'
