#!/usr/bin/env bash
# Validates the dispatch inputs and (for deploy) that PR number and SHA belong together.
# Inputs only arrive through the environment (never interpolated into shell source).
#   ACTION PR_NUMBER SHA CONFIRM SOURCE_REPO [GITHUB_TOKEN] [ALLOWED_PR_AUTHORS, default "perusonao"]
#   [SOURCE_SHA: optional full SHA of a descendant of the PR head to publish instead of the head itself (see below)]
#   [PULL_JSON_FILE, COMPARE_JSON_FILE: test hooks, skip the API]
#
# SOURCE_SHA (optional): the PR head stays the PR's own, unchanged commit (it is still checked to be the CURRENT head of an open
# same-repo PR by an allow-listed author). SOURCE_SHA may name a LATER commit of the same repo, for a verification-only add-on that is
# not part of the PR (e.g. the Batch 19 HV seed, which must not change the PR head). It is accepted only if the compare API says it is
# strictly AHEAD of the PR head (so the PR head is its ancestor), by at most 20 commits, and every file it changes relative to the PR
# head is under src/preview/ or docs/ (no package.json / workflow / game-logic change can ride along). The slug and the confirm
# string use the first 7 characters of SOURCE_SHA, so the page of the add-on never shares a slug with a page of the PR head.
# Run for deploy in the validate job AND again right before the write-capable publish step (the PR may have
# been force-pushed or closed while the build ran).
# Writes slug=... to $GITHUB_OUTPUT (when set).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

[[ "${ACTION:-}" == "deploy" || "${ACTION:-}" == "remove" ]] || die "action must be 'deploy' or 'remove'"
[[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]{0,5}$ ]] || die "pr_number must be a positive integer"
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || die "sha must be the full 40-character lowercase commit SHA (branch names and short SHAs are refused)"
[[ "${SOURCE_REPO:-}" == "perusonao/teto-pizza-game" ]] || die "source repo is fixed to perusonao/teto-pizza-game"

if [[ -n "${SOURCE_SHA:-}" ]]; then
  [[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "source_sha must be the full 40-character lowercase commit SHA"
  [[ "$SOURCE_SHA" != "$SHA" ]] || die "source_sha equals sha: leave source_sha empty to publish the PR head itself"
fi
SLUG_SHA="${SOURCE_SHA:-$SHA}"
slug="$(make_slug "$PR_NUMBER" "$SLUG_SHA")"
valid_slug "$slug" || die "internal: bad slug '$slug'"
[[ "${CONFIRM:-}" == "$slug" ]] || die "confirm must be exactly '$slug' (typed by hand, to guard against a mis-click)"

if [[ "$ACTION" == "deploy" ]]; then
  if [[ -n "${PULL_JSON_FILE:-}" ]]; then
    json="$(cat "$PULL_JSON_FILE")"
  else
    json="$(curl -fsS --retry 3 \
      -H "Accept: application/vnd.github+json" \
      ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
      "https://api.github.com/repos/${SOURCE_REPO}/pulls/${PR_NUMBER}")" \
      || die "could not read PR #${PR_NUMBER} of ${SOURCE_REPO}"
  fi
  # Same-repo PR only (never a fork), still open, and the pinned SHA is its CURRENT head.
  echo "$json" | jq -e --arg sha "$SHA" --arg repo "$SOURCE_REPO" \
    '.state == "open" and .head.sha == $sha and .head.repo.full_name == $repo and .base.repo.full_name == $repo' \
    >/dev/null \
    || die "PR #${PR_NUMBER} is not an open same-repo PR whose head is exactly ${SHA} (stale SHA, closed PR, fork or wrong number)"
  # The page runs on the shared github.io origin (see docs/PR-PAGES.md "Trust model"): only PRs opened by an
  # allow-listed author may be published.
  echo "$json" | jq -e --arg allowed "${ALLOWED_PR_AUTHORS:-perusonao}" \
    '.user.login as $u | ($allowed | split(",") | index($u)) != null' >/dev/null \
    || die "PR #${PR_NUMBER} was not opened by an allow-listed author (${ALLOWED_PR_AUTHORS:-perusonao})"
fi

if [[ "$ACTION" == "deploy" && -n "${SOURCE_SHA:-}" ]]; then
  if [[ -n "${COMPARE_JSON_FILE:-}" ]]; then
    cmp_json="$(cat "$COMPARE_JSON_FILE")"
  else
    cmp_json="$(curl -fsS --retry 3 \
      -H "Accept: application/vnd.github+json" \
      ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} \
      "https://api.github.com/repos/${SOURCE_REPO}/compare/${SHA}...${SOURCE_SHA}?per_page=100")" \
      || die "could not compare ${SHA:0:7}...${SOURCE_SHA:0:7} of ${SOURCE_REPO}"
  fi
  echo "$cmp_json" | jq -e '.status == "ahead" and .behind_by == 0 and .ahead_by >= 1 and .ahead_by <= 20' >/dev/null \
    || die "source_sha ${SOURCE_SHA:0:7} is not strictly ahead of the PR head ${SHA:0:7} by 1-20 commits (not a descendant, or diverged)"
  # The compare API lists at most 300 files: if it may be truncated, refuse rather than guess.
  echo "$cmp_json" | jq -e '(.files | length) < 300' >/dev/null || die "the change set is too large to verify (300+ files)"
  bad="$(echo "$cmp_json" | jq -r '[.files[] | (.filename, (.previous_filename // empty)) | select(test("^(src/preview/|docs/)") | not)] | .[]')"
  [[ -z "$bad" ]] || die "source_sha changes files outside src/preview/ and docs/ relative to the PR head: $(echo "$bad" | head -5 | tr '\n' ' ')"
fi

echo "OK: ${ACTION} ${slug}"
[[ -z "${GITHUB_OUTPUT:-}" ]] || echo "slug=${slug}" >> "$GITHUB_OUTPUT"
