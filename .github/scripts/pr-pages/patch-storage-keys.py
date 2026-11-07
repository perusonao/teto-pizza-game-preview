"""Rename every localStorage key literal in a PR page to "<key>--<slug>".

usage: patch-storage-keys.py <dist-dir> <slug>

The game's keys are string literals ("teto-..." / "teto.dev.*"). github.io is a single origin shared by
production (/teto-pizza-game/), the shared Preview and every PR page, so without this a PR page would read
and write the others' saves, opt-ins (e.g. the cheese-canvas render mode) and dev flags.

Scans EVERY file of the page (js, mjs, html incl. inline scripts, json, css, ...), not just *.js. Binary files
are not rewritten, but must not contain a known key.

Fail-closed: a teto-/teto. literal that is not in KNOWN is an error (the app added a key: review it, add it
here), and a missing SAVE key is an error (the source changed it). Re-running on a patched dist is an error
by design (the REQUIRED literal is gone).
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


def read_text(path: pathlib.Path):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def main() -> int:
    dist, slug = pathlib.Path(sys.argv[1]), sys.argv[2]
    if not re.fullmatch(r"pr-[1-9][0-9]{0,5}-[0-9a-f]{7}", slug):
        print(f"::error::bad slug {slug!r}")
        return 1
    files = [f for f in dist.rglob("*") if f.is_file()]
    texts: dict[pathlib.Path, str] = {}
    for f in files:
        t = read_text(f)
        if t is None:  # binary: must not embed any known key
            raw = f.read_bytes()
            hit = [k for k in KNOWN if k.encode() in raw]
            if hit:
                print(f"::error::binary file {f} contains storage key(s) {hit}")
                return 1
        else:
            texts[f] = t
    seen: set[str] = set()
    for t in texts.values():
        seen.update(m.group("k") for m in LITERAL.finditer(t))
    unknown = sorted(seen - KNOWN)
    if unknown:
        print(f"::error::unknown storage-like literal(s) {unknown}: add them to KNOWN in patch-storage-keys.py after review")
        return 1
    missing = sorted(REQUIRED - seen)
    if missing:
        print(f"::error::required key literal(s) {missing} not found (source changed them?); refusing to publish a page that could share the Preview save")
        return 1
    for f, t in texts.items():
        patched = LITERAL.sub(lambda m: f"{m.group('q')}{m.group('k')}--{slug}{m.group('q')}", t)
        if patched != t:
            f.write_text(patched, encoding="utf-8")
    # verify over EVERYTHING again: no bare known key anywhere (quoted or not), every teto literal suffixed
    left: set[str] = set()
    for f in files:
        t = read_text(f)
        if t is None:
            continue
        left.update(m.group("k") for m in LITERAL.finditer(t))
        for k in KNOWN:
            # a key that is not followed by "--<slug>" (nor continues as a longer name) is still bare
            if re.search(rf"(?<![A-Za-z0-9._-]){re.escape(k)}(?!--{re.escape(slug)})(?![A-Za-z0-9._-])", t):
                print(f"::error::bare key {k!r} still present in {f}")
                return 1
    bad = sorted(k for k in left if not k.endswith(f"--{slug}"))
    if bad or {k.removesuffix(f"--{slug}") for k in left} != seen:
        print(f"::error::storage key patch incomplete: {bad}")
        return 1
    print("storage keys namespaced: " + ", ".join(sorted(seen)))
    return 0


sys.exit(main())
