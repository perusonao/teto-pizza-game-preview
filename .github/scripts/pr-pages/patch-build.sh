#!/usr/bin/env bash
# Post-processes a Vite build of the source repo so it is safe to host under
#   ${PAGES_BASE}/pr/<slug>/   on the SAME origin as the shared Preview and production.
# usage: patch-build.sh <dist-dir> <slug>
# Every edit is asserted; a source change that breaks an assumption fails the build instead
# of silently shipping a page that shares state with (or points at) another deployment.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dist="${1:?dist dir}"; slug="${2:?slug}"
valid_slug "$slug" || die "bad slug"
[[ -f "$dist/index.html" && -f "$dist/manifest.webmanifest" ]] || die "dist is missing index.html / manifest.webmanifest"
base="${PAGES_BASE}/${PR_PAGES_DIR}/${slug}/"

# 1) PWA manifest: start_url/scope are static public/ files that Vite's base does not rewrite.
for k in start_url scope; do
  grep -q "\"$k\": \"/teto-pizza-game/\"" "$dist/manifest.webmanifest" || die "manifest $k no longer '/teto-pizza-game/'; update patch-build.sh"
  sed -i "s#\"$k\": \"/teto-pizza-game/\"#\"$k\": \"$base\"#" "$dist/manifest.webmanifest"
  grep -qF "\"$k\": \"$base\"" "$dist/manifest.webmanifest" || die "manifest $k not patched"
done

# 2) Keep the page out of search engines.
grep -q '<meta charset="UTF-8" />' "$dist/index.html" || die "index.html charset meta not found"
sed -i 's#<meta charset="UTF-8" />#<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />#' "$dist/index.html"
grep -q 'name="robots" content="noindex, nofollow"' "$dist/index.html" || die "noindex not added"

# 3) Separate localStorage. All of github.io shares ONE origin, so the shared Preview and this page
#    would otherwise read/write the same save. The save key is a string literal in the bundle.
new_key="teto-pizza-preview-${slug}-save-v1"
mapfile -t hits < <(grep -rlF --include='*.js' "$SAVE_KEY_OLD" "$dist" || true)
((${#hits[@]} >= 1)) || die "save key '$SAVE_KEY_OLD' not found in the bundle (source changed it?); refusing to publish a page that could share the Preview save"
for f in "${hits[@]}"; do sed -i "s#${SAVE_KEY_OLD}#${new_key}#g" "$f"; done
if grep -rqF --include='*.js' "$SAVE_KEY_OLD" "$dist"; then die "old save key still present after patch"; fi
grep -rqF --include='*.js' "$new_key" "$dist" || die "new save key not present after patch"

# 4) Path hygiene: nothing may point at the production base or the shared Preview root.
if grep -rqF '/teto-pizza-game/' "$dist"; then die "build still references the production base '/teto-pizza-game/'"; fi
stray="$(grep -rhoE "${PAGES_BASE}/[A-Za-z0-9._/-]*" "$dist" | grep -v "^${base}" | grep -vxF "${base%/}" || true)"
[[ -z "$stray" ]] || die "build references paths outside ${base}: $(echo "$stray" | sort -u | head -5 | tr '\n' ' ')"

echo "patched ${dist}: base=${base} saveKey=${new_key}"
