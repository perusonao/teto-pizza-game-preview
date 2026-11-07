#!/usr/bin/env bash
# The LIVE shared Preview must be byte-for-byte what `site/` on this checkout holds -- EVERY file, not just index.html --
# otherwise dispatching pages.yml would also publish a pending shared-Preview change (e.g. only manifest.webmanifest, an icon or
# an unreferenced asset changed, which leaves index.html identical). usage: check-root-synced.sh   env: LIVE_ORIGIN
# Residual (documented): a pending file DELETION is not visible from outside; deploy-from-source.yml always replaces the hashed
# assets and index.html together, so a real shared update changes index.html or a referenced asset and is caught here.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
origin="${LIVE_ORIGIN:-https://perusonao.github.io}"
[[ -f site/index.html ]] || die "site/index.html missing in the checkout"
n=0
while IFS= read -r -d '' f; do
  rel="${f#site/}"
  want="$(sha256sum "$f" | cut -d' ' -f1)"
  # percent-encode only characters outside the safe URL set
  enc="$(python3 -I -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$rel")"
  got="$(curl -fsS --retry 3 --max-time 30 "${origin}${PAGES_BASE}/${enc}" | sha256sum | cut -d' ' -f1)" \
    || die "live shared Preview file ${PAGES_BASE}/${rel} is not reachable"
  [[ "$want" == "$got" ]] || die "live ${PAGES_BASE}/${rel} (${got}) differs from site/${rel} on this checkout (${want}): a shared-Preview update is pending or the live site changed. Refusing: deploy/verify that first."
  n=$((n + 1))
done < <(find site -type f -print0 | sort -z)
((n > 0)) || die "site/ holds no files"
echo "shared Preview is live and identical to site/ on this checkout (${n} files)"
