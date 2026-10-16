#!/usr/bin/env bash
# Applies a deploy/remove to the working tree and stages ONLY pr/<slug>/ .
# usage: apply.sh deploy <slug> <dist-dir>   |   apply.sh remove <slug>
# env (deploy): PR_NUMBER SHA RUN_ID  (written to pr/<slug>/preview-meta.json for audit)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
action="${1:?}"; slug="${2:?}"; valid_slug "$slug" || die "bad slug"
target="${PR_PAGES_DIR}/${slug}"

git diff --cached --quiet || die "index is not clean before apply"

case "$action" in
  deploy)
    dist="${3:?dist dir}"
    [[ -f "$dist/index.html" ]] || die "dist has no index.html"
    others=0
    if [[ -d "$PR_PAGES_DIR" ]]; then
      others="$(find "$PR_PAGES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "$slug" | wc -l)"
    fi
    ((others < PR_PAGES_MAX)) || die "already ${others} other PR pages published (max ${PR_PAGES_MAX}); remove one first"
    if find "$dist" ! -type f ! -type d -print -quit | grep -q .; then die "dist contains non-regular files"; fi
    if find "$dist" -name '.*' -print -quit | grep -q .; then die "dist contains dotfiles/dot-directories"; fi
    rm -rf -- "$target"
    mkdir -p -- "$target"
    cp -R "$dist"/. "$target"/
    jq -n --arg pr "${PR_NUMBER:-}" --arg sha "${SHA:-}" --arg run "${RUN_ID:-}" --arg t "$(date -u +%FT%TZ)" \
      '{source:"perusonao/teto-pizza-game",pr:$pr,sha:$sha,workflowRun:$run,builtAt:$t}' > "$target/preview-meta.json"
    ;;
  remove)
    [[ -d "$target" ]] || die "no such PR page: ${target}"
    git rm -r -q -- "$target"
    rm -rf -- "$target"
    ;;
  *) die "unknown action" ;;
esac

git add -A -- "$PR_PAGES_DIR"
bash "$(dirname "$0")/guard-paths.sh" "$slug"
