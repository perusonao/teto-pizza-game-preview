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

# 2b) Browser-enforced network lockdown (CSP meta, first in <head> so it precedes every script).
if grep -q 'Content-Security-Policy' "$dist/index.html"; then die "index.html already carries a CSP; review patch-build.sh"; fi
python3 -I - "$dist/index.html" "$PR_PAGE_CSP" <<'PY'
import sys
path, csp = sys.argv[1], sys.argv[2]
html = open(path, encoding="utf-8").read()
anchor = '<meta charset="UTF-8" />'
assert html.count(anchor) == 1, "charset anchor"
html = html.replace(anchor, anchor + f'\n    <meta http-equiv="Content-Security-Policy" content="{csp}" />')
open(path, "w", encoding="utf-8").write(html)
PY
grep -q 'http-equiv="Content-Security-Policy"' "$dist/index.html" || die "CSP not added"

# 2c) Only inert file types, and exactly ONE HTML document (the CSP above lives in index.html only). Any other same-origin HTML / SVG / XML
#     document would be framed or navigated to WITHOUT that policy, and a Worker / Service Worker is not governed by it either: so the bundle may not
#     contain another document type, nor code that creates or registers a worker. Fail-closed: an unknown file type stops the build (add it here after review).
python3 -I - "$dist" <<'PY' || die "dist contains a file type or a worker that the page policy cannot cover (see above)"
import pathlib, re, sys
dist = pathlib.Path(sys.argv[1])
ALLOWED = {".js", ".mjs", ".css", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".json", ".woff", ".woff2", ".ttf", ".webmanifest"}
WORKER = re.compile(r"new\s+(?:Shared)?Worker\s*\(|serviceWorker\s*\.\s*register\s*\(|importScripts\s*\(")
bad = []
for f in sorted(p for p in dist.rglob("*") if p.is_file()):
    rel = f.relative_to(dist).as_posix()
    if rel == "index.html":
        continue
    if f.suffix.lower() not in ALLOWED:
        bad.append(f"{rel}: file type {f.suffix or '(none)'} is not allowed (another HTML/SVG/XML document would run without the CSP)")
        continue
    if f.suffix.lower() in {".js", ".mjs"}:
        m = WORKER.search(f.read_text(encoding="utf-8", errors="replace"))
        if m:
            bad.append(f"{rel}: creates or registers a worker ({m.group(0).strip()})")
if bad:
    print("\n".join("::error::" + b for b in bad[:10]), file=sys.stderr)
    sys.exit(1)
PY

# 2d) index.html itself may not embed another context or rebase its URLs: no frame / object / embed / base / form element (belt and braces next to the CSP).
if grep -qiE '<(iframe|frame|frameset|object|embed|base|form)[ >/]' "$dist/index.html"; then die "index.html embeds a frame / object / embed / base / form element"; fi

# 3) Separate localStorage. All of github.io shares ONE origin, so the shared Preview, production and this
#    page would otherwise share every key. Each storage key is a string literal in the bundle; the script
#    renames EVERY teto-/teto. literal to "<key>--<slug>" and FAILS on a literal it does not know, so a key
#    the app adds later can never be silently shared (see patch-storage-keys.py for the known set).
python3 -I "$(dirname "$0")/patch-storage-keys.py" "$dist" "$slug"

# 4) Path hygiene: nothing may point at the production base or the shared Preview root.
if grep -rqF '/teto-pizza-game/' "$dist"; then die "build still references the production base '/teto-pizza-game/'"; fi
stray="$(grep -rhoE "${PAGES_BASE}/[A-Za-z0-9._/-]*" "$dist" | grep -v "^${base}" | grep -vxF "${base%/}" || true)"
[[ -z "$stray" ]] || die "build references paths outside ${base}: $(echo "$stray" | sort -u | head -5 | tr '\n' ' ')"

# 5) No Firebase web config may be baked in (the build job gets no secrets; this proves it).
if grep -rqE 'AIza[0-9A-Za-z_-]{35}' "$dist"; then die "a Firebase-style API key is present in the bundle"; fi
# 6) Nothing hidden (dotfiles / dot-directories) may ship in a page.
if find "$dist" -name '.*' -print -quit | grep -q .; then die "dist contains dotfiles"; fi

echo "patched ${dist}: base=${base} storage keys suffixed with --${slug}"
