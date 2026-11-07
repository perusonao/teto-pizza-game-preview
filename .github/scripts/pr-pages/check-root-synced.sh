#!/usr/bin/env bash
# Proves the LIVE shared Preview is byte-identical to the whole of site/ of the checkout (every tracked file: index.html, manifest.webmanifest,
# icons, assets/), not just the root HTML.
#   * before a publish: pages.yml deploys the whole of `main`, so if site/ on main is ahead of what is live
#     (a shared-Preview update that was pushed but never deployed -- even one that changes only the manifest, an icon or an unreferenced
#     asset), dispatching it would ALSO publish that pending shared change. In that case this fails and nothing is published.
#   * after a publish/remove: proves the shared Preview was served unchanged.
# env: LIVE_ORIGIN (default https://perusonao.github.io)   run from the repo root
# Files that exist only on the live side cannot be listed over HTTP; they can only come from a deployed `main`, which this check does not change.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
origin="${LIVE_ORIGIN:-https://perusonao.github.io}"
[[ -f site/index.html ]] || die "site/index.html missing in the checkout"
mapfile -t files < <(git ls-files -- site | LC_ALL=C sort)
((${#files[@]} > 0)) || die "no tracked files under site/"
bad=()
for f in "${files[@]}"; do
  rel="${f#site/}"
  want="$(sha256sum "$f" | cut -d' ' -f1)"
  if got="$(curl -fsS --retry 3 --max-time 30 "${origin}${PAGES_BASE}/${rel}" | sha256sum | cut -d' ' -f1)" && [[ -n "$got" ]]; then
    [[ "$want" == "$got" ]] || bad+=("${rel} (live ${got:0:12} != site ${want:0:12})")
  else
    bad+=("${rel} (not reachable live)")
  fi
done
# the root URL itself must serve index.html
want="$(sha256sum site/index.html | cut -d' ' -f1)"
got="$(curl -fsS --retry 3 --max-time 30 "${origin}${PAGES_BASE}/" | sha256sum | cut -d' ' -f1)" || got="unreachable"
[[ "$want" == "$got" ]] || bad+=("/ (root URL: live ${got:0:12} != index.html ${want:0:12})")
((${#bad[@]} == 0)) || die "the live shared Preview differs from site/ on main in ${#bad[@]} file(s): ${bad[*]:0:5}. A shared-Preview update is pending or the live site changed. Refusing: deploy/verify that first."
echo "shared Preview is live and identical to site/ (${#files[@]} files + root URL)"
