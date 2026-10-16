#!/usr/bin/env bash
# Validates the dispatch inputs and (for deploy) that PR number and SHA belong together.
# Inputs only arrive through the environment (never interpolated into shell source).
#   ACTION PR_NUMBER SHA CONFIRM SOURCE_REPO [GITHUB_TOKEN] [ALLOWED_PR_AUTHORS, default "perusonao"]
#   [PULL_JSON_FILE: test hook, skips the API]
# Run for deploy in the validate job AND again right before the write-capable publish step (the PR may have
# been force-pushed or closed while the build ran).
# Writes slug=... to $GITHUB_OUTPUT (when set).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

[[ "${ACTION:-}" == "deploy" || "${ACTION:-}" == "remove" ]] || die "action must be 'deploy' or 'remove'"
[[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]{0,5}$ ]] || die "pr_number must be a positive integer"
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || die "sha must be the full 40-character lowercase commit SHA (branch names and short SHAs are refused)"
[[ "${SOURCE_REPO:-}" == "perusonao/teto-pizza-game" ]] || die "source repo is fixed to perusonao/teto-pizza-game"

slug="$(make_slug "$PR_NUMBER" "$SHA")"
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

echo "OK: ${ACTION} ${slug}"
[[ -z "${GITHUB_OUTPUT:-}" ]] || echo "slug=${slug}" >> "$GITHUB_OUTPUT"
