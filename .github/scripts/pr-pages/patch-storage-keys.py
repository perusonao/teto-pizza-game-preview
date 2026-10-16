"""Rename every localStorage key literal in a PR page's bundle to "<key>--<slug>".

usage: patch-storage-keys.py <dist-dir> <slug>

The game's keys are string literals ("teto-..." / "teto.dev.*"). github.io is a single origin shared by
production (/teto-pizza-game/), the shared Preview and every PR page, so without this a PR page would read
and write the others' saves, opt-ins (e.g. the cheese-canvas render mode) and dev flags.

Fail-closed: a teto-/teto. literal that is not in KNOWN is an error (the app added a key: review it, add it
here), and a missing SAVE key is an error (the source changed it). Re-running on a patched dist is a no-op
error by design (the literals are gone).
"""
import pathlib
import re
import sys

KNOWN = {
    "teto-pizza-preview-save-v1",        # src/state/persistence.ts (Preview save)
    "teto-pizza-cheese-canvas",          # src/preview/cheeseRenderMode.ts (also exists in production builds)
    "teto-pizza-preview-hint5-optin",    # src/preview/hint5PreviewOptIn.ts
    "teto.dev.hint5Ladder",              # src/logic/discovery/hint5Flag.ts (hand-set dev flag)
    "teto.dev.researchIdentify",         # src/logic/discovery/researchIdentifyFlag.ts (hand-set dev flag)
}
REQUIRED = {"teto-pizza-preview-save-v1"}
LITERAL = re.compile(r"""(?P<q>["'`])(?P<k>teto[-.][A-Za-z0-9._-]*)(?P=q)""")


def main() -> int:
    dist, slug = pathlib.Path(sys.argv[1]), sys.argv[2]
    if not re.fullmatch(r"pr-[1-9][0-9]{0,5}-[0-9a-f]{7}", slug):
        print(f"::error::bad slug {slug!r}")
        return 1
    files = [f for f in dist.rglob("*.js") if f.is_file()]
    seen: set[str] = set()
    for f in files:
        seen.update(m.group("k") for m in LITERAL.finditer(f.read_text(encoding="utf-8")))
    unknown = sorted(seen - KNOWN)
    if unknown:
        print(f"::error::unknown storage-like literal(s) {unknown}: add them to KNOWN in patch-storage-keys.py after review")
        return 1
    missing = sorted(REQUIRED - seen)
    if missing:
        print(f"::error::required key literal(s) {missing} not found (source changed them?); refusing to publish a page that could share the Preview save")
        return 1
    for f in files:
        text = f.read_text(encoding="utf-8")
        patched = LITERAL.sub(lambda m: f"{m.group('q')}{m.group('k')}--{slug}{m.group('q')}", text)
        if patched != text:
            f.write_text(patched, encoding="utf-8")
    # verify: every remaining teto literal carries the suffix, and nothing bare is left
    left = set()
    for f in files:
        left.update(m.group("k") for m in LITERAL.finditer(f.read_text(encoding="utf-8")))
    bad = sorted(k for k in left if not k.endswith(f"--{slug}"))
    if bad or {k.removesuffix(f"--{slug}") for k in left} != seen:
        print(f"::error::storage key patch incomplete: {bad}")
        return 1
    print("storage keys namespaced: " + ", ".join(sorted(seen)))
    return 0


sys.exit(main())
