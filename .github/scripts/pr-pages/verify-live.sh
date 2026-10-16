#!/usr/bin/env bash
# Polls the published site until the expected state shows up, then proves the shared Preview root
# is still served byte-for-byte as committed in site/index.html.
# usage: verify-live.sh deploy|remove <slug>      env: LIVE_ORIGIN (default https://perusonao.github.io)
#        TRIES (default 40) INTERVAL (default 15s)
#        deploy: EXPECT_RUN_ID (required) -- the page's preview-meta.json must carry THIS run's id, so a page left
#        over from an earlier deploy of the same slug can never satisfy the check
set -euo pipefail
source "$(dirname "$0")/lib.sh"
action="${1:?}"; slug="${2:?}"; valid_slug "$slug" || die "bad slug"
origin="${LIVE_ORIGIN:-https://perusonao.github.io}"
page="${origin}${PAGES_BASE}/${PR_PAGES_DIR}/${slug}/"
root="${origin}${PAGES_BASE}/"
tries="${TRIES:-40}"; interval="${INTERVAL:-15}"
if [[ "$action" == "deploy" ]]; then : "${EXPECT_RUN_ID:?deploy verification needs EXPECT_RUN_ID}"; fi

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" || true; }

ok=0
for ((i = 1; i <= tries; i++)); do
  c="$(code "$page")"
  if [[ "$action" == "deploy" && "$c" == "200" ]]; then
    # capture first: `curl | grep -q` can lose to SIGPIPE under pipefail and report a false miss
    body="$(curl -fsS --max-time 20 "$page" || true)"
    meta="$(curl -fsS --max-time 20 "${page}preview-meta.json" || true)"
    if grep -qF "${PAGES_BASE}/${PR_PAGES_DIR}/${slug}/assets/" <<<"$body" \
       && jq -e --arg r "${EXPECT_RUN_ID}" '.workflowRun == $r' >/dev/null 2>&1 <<<"$meta"; then ok=1; break; fi
  elif [[ "$action" == "remove" && "$c" == "404" ]]; then ok=1; break; fi
  echo "waiting (${i}/${tries}): ${page} -> ${c}"; sleep "$interval"
done
((ok == 1)) || die "expected state for '${action}' never appeared at ${page}"

bash "$(dirname "$0")/check-root-synced.sh"
echo "verified: ${action} ${slug}"
