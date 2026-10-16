#!/usr/bin/env bash
# Proves the LIVE shared Preview root is byte-identical to site/index.html of the checkout.
#   * before a publish: pages.yml deploys the whole of `main`, so if site/ on main is ahead of what is live
#     (a shared-Preview update that was pushed but never deployed), dispatching it would ALSO publish that
#     pending shared change. In that case this fails and nothing is published.
#   * after a publish/remove: proves the root was served unchanged.
# env: LIVE_ORIGIN (default https://perusonao.github.io)   run from the repo root
set -euo pipefail
source "$(dirname "$0")/lib.sh"
origin="${LIVE_ORIGIN:-https://perusonao.github.io}"
[[ -f site/index.html ]] || die "site/index.html missing in the checkout"
want="$(sha256sum site/index.html | cut -d' ' -f1)"
got="$(curl -fsS --retry 3 --max-time 30 "${origin}${PAGES_BASE}/" | sha256sum | cut -d' ' -f1)" \
  || die "shared Preview root ${origin}${PAGES_BASE}/ is not reachable"
[[ "$want" == "$got" ]] || die "live shared Preview root (${got}) differs from site/index.html on main (${want}): a shared-Preview update is pending or the root changed. Refusing: deploy/verify that first."
echo "shared Preview root is live and identical to site/index.html (${got})"
