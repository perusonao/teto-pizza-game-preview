#!/usr/bin/env bash
# Offline tests for .github/scripts/pr-pages/ and the pages.yml assemble step.
# Run:  bash tests/pr-pages.test.sh        (needs git, jq, python3; no network, no GitHub)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/.github/scripts/pr-pages"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  ok   - $1"; }
bad()  { fail=$((fail+1)); echo "  FAIL - $1"; }
expect_ok()   { local n="$1"; shift; if "$@" >"$T/out" 2>&1; then ok "$n"; else bad "$n"; sed 's/^/        /' "$T/out"; fi; }
expect_fail() { local n="$1"; shift; if "$@" >"$T/out" 2>&1; then bad "$n (unexpectedly succeeded)"; else ok "$n"; fi; }

SHA=a3d1872fad787f53d4e4bd833fa7134cca1f379f
SLUG=pr-494-a3d1872
pull() { jq -n --arg sha "${2:-$SHA}" --arg st "${3:-open}" --arg hr "${4:-perusonao/teto-pizza-game}" \
  '{state:$st,head:{sha:$sha,repo:{full_name:$hr}},base:{repo:{full_name:"perusonao/teto-pizza-game"}}}' > "$1"; }
v() { ( export ACTION="$1" PR_NUMBER="${2:-494}" SHA="${3:-$SHA}" CONFIRM="${4:-$SLUG}" SOURCE_REPO="${5:-perusonao/teto-pizza-game}" PULL_JSON_FILE="$T/pull.json"; bash "$S/validate-inputs.sh" ); }

echo "validate-inputs"
pull "$T/pull.json"
expect_ok   "deploy: open same-repo PR, head == sha" v deploy
expect_fail "deploy: short sha refused"            v deploy 494 a3d1872 pr-494-a3d1872
expect_fail "deploy: branch name refused"          v deploy 494 claude/teto-pizza-gauge-phase2-31dws7
expect_fail "deploy: uppercase sha refused"        v deploy 494 "${SHA^^}"
expect_fail "deploy: confirm typo refused"         v deploy 494 "$SHA" pr-494-a3d187
expect_fail "deploy: wrong PR number vs confirm"   v deploy 495 "$SHA" "$SLUG"
expect_fail "deploy: non-numeric PR refused"       v deploy "494;rm" "$SHA" "$SLUG"
expect_fail "deploy: foreign source repo refused"  v deploy 494 "$SHA" "$SLUG" someone/else
pull "$T/pull.json" "$SHA" closed;                 expect_fail "deploy: closed PR refused" v deploy
pull "$T/pull.json" "$SHA" open fork/teto;         expect_fail "deploy: fork head refused" v deploy
pull "$T/pull.json" bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; expect_fail "deploy: SHA is not the PR head (stale)" v deploy
expect_ok   "remove: needs no API / open PR"       v remove
expect_fail "remove: confirm still required"       v remove 494 "$SHA" nope

echo "apply / guard / push (temp repo with a bare remote)"
git init -q --bare -b main "$T/remote.git"
git init -q -b main "$T/w" && cd "$T/w"
git config user.email t@t; git config user.name t
mkdir -p site/assets .github/workflows pr/pr-1-aaaaaaa; echo ROOT > site/index.html; echo a > site/assets/a.js
echo wf > .github/workflows/x.yml; echo OLD > pr/pr-1-aaaaaaa/index.html; echo r > README.md
git add -A; git commit -qm init; git remote add origin "$T/remote.git"; git push -q origin main
mkdir -p "$T/dist/assets"; echo '<html>page</html>' > "$T/dist/index.html"; echo x > "$T/dist/assets/x.js"
tree_outside() { git ls-files -s | awk -F'\t' -v p="pr/$1/" 'index($2,p)!=1' | sha256sum; }
B="$(tree_outside $SLUG)"

( export PR_NUMBER=494 SHA=$SHA RUN_ID=1; expect_ok "deploy stages pr/<slug> only" bash "$S/apply.sh" deploy $SLUG "$T/dist" )
[[ "$(tree_outside $SLUG)" == "$B" ]] && ok "deploy leaves site/, README, workflows, other pr/ untouched" || bad "deploy touched files outside target"
git diff --cached --name-only | grep -qv "^pr/$SLUG/" && bad "staged path outside target" || ok "every staged path is under pr/$SLUG/"
expect_ok "push.sh commits + pushes" bash "$S/push.sh" $SLUG "PR page deploy: $SLUG"
[[ "$(git rev-parse HEAD)" == "$(git --git-dir="$T/remote.git" rev-parse main)" ]] && ok "remote main == pushed commit" || bad "remote not updated"
jq -e --arg sha "$SHA" '.sha==$sha and .pr=="494"' pr/$SLUG/preview-meta.json >/dev/null && ok "preview-meta.json records PR + sha" || bad "meta"

echo "  -- concurrent push: another job pushed first (non-overlapping path)"
git clone -q "$T/remote.git" "$T/other" && ( cd "$T/other" && git config user.email o@o && git config user.name o && echo n > site/new.txt && git add -A && git commit -qm other && git push -q origin main )
echo changed >> "$T/dist/index.html"; ( export PR_NUMBER=494 SHA=$SHA RUN_ID=2; bash "$S/apply.sh" deploy $SLUG "$T/dist" >/dev/null )
expect_ok "push.sh rebases onto the concurrent push and re-guards" bash "$S/push.sh" $SLUG "redeploy"
git --git-dir="$T/remote.git" show main:site/new.txt >/dev/null 2>&1 && ok "concurrent change preserved" || bad "concurrent change lost"

echo "  -- guard"
echo hack > site/index.html; git add site/index.html
expect_fail "guard refuses a staged change to the shared root" bash "$S/guard-paths.sh" $SLUG
git reset -q --hard HEAD
ln -s /etc/passwd pr/$SLUG/link; git add pr/$SLUG/link
expect_fail "guard refuses a symlink" bash "$S/guard-paths.sh" $SLUG
git reset -q --hard HEAD; git clean -fdq
echo z > pr/pr-1-aaaaaaa/index.html; git add -A
expect_fail "guard refuses a change to ANOTHER PR page" bash "$S/guard-paths.sh" $SLUG
git reset -q --hard HEAD
ln -s /etc/passwd "$T/dist/evil"; expect_fail "apply refuses a non-regular file in dist" env PR_NUMBER=494 SHA=$SHA bash "$S/apply.sh" deploy $SLUG "$T/dist"; rm "$T/dist/evil"; git reset -q --hard HEAD; git clean -fdq
expect_fail "guard refuses a bad slug (path traversal)" bash "$S/guard-paths.sh" "pr-1-../../x"

echo "  -- cap on published pages"
for i in 2 3 4 5; do mkdir -p pr/pr-$i-bbbbbbb; echo x > pr/pr-$i-bbbbbbb/index.html; done; git add -A; git commit -qm fill
expect_fail "apply refuses a 6th PR page" env PR_NUMBER=494 SHA=$SHA bash "$S/apply.sh" deploy pr-494-cccccc1 "$T/dist"
git reset -q --hard HEAD; git clean -fdq; git reset -q --hard origin/main

echo "  -- remove"
git pull -q origin main
B2="$(tree_outside $SLUG)"
expect_ok "remove stages only the target" bash "$S/apply.sh" remove $SLUG
[[ "$(tree_outside $SLUG)" == "$B2" ]] && ok "remove leaves everything else untouched" || bad "remove touched other files"
[[ ! -e pr/$SLUG ]] && ok "page directory is gone" || bad "page still present"
expect_ok "push.sh commits removal" bash "$S/push.sh" $SLUG "PR page remove: $SLUG"
expect_fail "remove of a missing page fails loudly" bash "$S/apply.sh" remove $SLUG
[[ -d pr/pr-1-aaaaaaa ]] && ok "other PR page survives" || bad "other PR page lost"

echo "  -- rollback"
( export PR_NUMBER=494 SHA=$SHA RUN_ID=3; bash "$S/apply.sh" deploy $SLUG "$T/dist" >/dev/null ); bash "$S/push.sh" $SLUG "PR page deploy" >"$T/p.out"; P="$(grep '^sha=' "$T/p.out" | cut -d= -f2)"
expect_ok "rollback reverts our commit when it is the tip" bash "$S/rollback.sh" $SLUG "$P"
git --git-dir="$T/remote.git" ls-tree -r --name-only main | grep -q "^pr/$SLUG/" && bad "page still on main after rollback" || ok "page gone from main after rollback"
git fetch -q origin; git checkout -q main; git reset -q --hard origin/main
( export PR_NUMBER=494 SHA=$SHA RUN_ID=4; bash "$S/apply.sh" deploy $SLUG "$T/dist" >/dev/null ); bash "$S/push.sh" $SLUG "PR page deploy" >"$T/p.out"; P="$(grep '^sha=' "$T/p.out" | cut -d= -f2)"
( cd "$T/other" && git pull -q origin main && echo m > site/moved.txt && git add -A && git commit -qm moved && git push -q origin main )
bash "$S/rollback.sh" $SLUG "$P" 2>&1 | grep -q 'reverted=false' && ok "rollback refuses when main moved on" || bad "rollback should have refused"

echo "patch-build (fake dist)"
cd "$ROOT"
mk() { rm -rf "$T/d"; mkdir -p "$T/d/assets"
  printf '{ "start_url": "/teto-pizza-game/", "scope": "/teto-pizza-game/" }' > "$T/d/manifest.webmanifest"
  printf '<!doctype html><html><head><meta charset="UTF-8" /><script src="/teto-pizza-game-preview/pr/%s/assets/i.js"></script></head></html>' $SLUG > "$T/d/index.html"
  printf 'const k="teto-pizza-preview-save-v1";const b="/teto-pizza-game-preview/pr/%s/";' $SLUG > "$T/d/assets/i.js"; }
mk; expect_ok "patch: all assertions pass on a good dist" bash "$S/patch-build.sh" "$T/d" $SLUG
grep -q "teto-pizza-preview-$SLUG-save-v1" "$T/d/assets/i.js" && ! grep -q 'preview-save-v1' "$T/d/assets/i.js" && ok "save key namespaced, old key gone" || bad "save key"
grep -q "\"scope\": \"/teto-pizza-game-preview/pr/$SLUG/\"" "$T/d/manifest.webmanifest" && ok "manifest scope/start_url point at the PR path" || bad "manifest"
grep -q noindex "$T/d/index.html" && ok "noindex added" || bad "noindex"
mk; sed -i 's/preview-save-v1/other-key/' "$T/d/assets/i.js"; expect_fail "patch: fails if the save key literal disappears (no silent sharing)" bash "$S/patch-build.sh" "$T/d" $SLUG
mk; echo 'fetch("/teto-pizza-game/x")' >> "$T/d/assets/i.js"; expect_fail "patch: fails on a reference to the production base" bash "$S/patch-build.sh" "$T/d" $SLUG
mk; echo 'fetch("/teto-pizza-game-preview/assets/x.js")' >> "$T/d/assets/i.js"; expect_fail "patch: fails on a reference to the shared Preview root" bash "$S/patch-build.sh" "$T/d" $SLUG

echo "pages.yml assemble step"
python3 - "$ROOT/.github/workflows/pages.yml" "$T/assemble.sh" <<'PY'
import sys,yaml
w=yaml.safe_load(open(sys.argv[1]))
for st in w['jobs']['deploy']['steps']:
    if st.get('name','').startswith('Assemble'):
        open(sys.argv[2],'w').write(st['run'])
PY
asm() { ( cd "$1" && bash "$T/assemble.sh" ); }
mkdir -p "$T/a/site/assets"; echo R > "$T/a/site/index.html"; echo a > "$T/a/site/assets/a.js"
expect_ok "no pr/: artifact root == site/ exactly" asm "$T/a"
diff -r "$T/a/site" "$T/a/_pages" >/dev/null && ok "byte-identical to the old 'path: site'" || bad "differs from site/"
mkdir -p "$T/a/pr/$SLUG"; echo P > "$T/a/pr/$SLUG/index.html"; rm -rf "$T/a/_pages"
expect_ok "with pr/: published under /pr/" asm "$T/a"
[[ -f "$T/a/_pages/pr/$SLUG/index.html" && "$(cat "$T/a/_pages/index.html")" == R ]] && ok "root unchanged, PR page added" || bad "layout"
mkdir -p "$T/a/site/pr"; expect_fail "site/pr collision is refused" asm "$T/a"; rmdir "$T/a/site/pr"
ln -s /etc/passwd "$T/a/pr/$SLUG/l"; expect_fail "symlink in pr/ is refused" asm "$T/a"

echo; echo "passed: $pass  failed: $fail"; [[ $fail -eq 0 ]]
