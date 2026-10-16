# PR-scoped preview pages

Publish **one** build of a `perusonao/teto-pizza-game` PR at its own path, e.g.

    https://perusonao.github.io/teto-pizza-game-preview/pr/pr-494-a3d1872/

for iPhone Safari verification, **without** touching the shared Preview at
`https://perusonao.github.io/teto-pizza-game-preview/` and without any connection to production
(`perusonao/teto-pizza-game`'s own GitHub Pages and workflows are not involved).

## Use

Actions -> **Publish / remove a PR-scoped preview page** -> Run workflow (branch `main`):

| input | value |
|---|---|
| action | `deploy` or `remove` |
| pr_number | e.g. `494` |
| sha | the **full 40-hex** head SHA of that PR |
| confirm | the slug, typed by hand: `pr-<number>-<first 7 of sha>` |

`deploy` builds the pinned commit, re-validates the PR head, publishes `pr/<slug>/`, re-deploys Pages, then polls the
live page until its `preview-meta.json` carries **this run's id** (so a page left over from an earlier deploy of
the same slug cannot pass) and checks that the shared Preview root is byte-identical to `site/index.html`. `remove` deletes `pr/<slug>/`
and waits for the URL to return 404. Open the page in a normal Safari tab (not "Add to Home Screen").
The PREVIEW badge must read `PR#<number> · <sha7>`.

## Layout and coexistence

```
site/   shared Preview. Rewritten wholesale by deploy-from-source.yml (unchanged).
pr/     PR pages, one directory per slug. Written only by pr-page.yml.
```

`pages.yml` now publishes `site/` plus (when present) `pr/` mounted at `/pr/`. `deploy-from-source.yml`
replaces `site/` with `rm -rf` but never touches `pr/`, so a shared-Preview update **cannot delete a PR
page**. With no `pr/` directory the Pages artifact is identical to the old `path: site` (the step
`diff -r`s it). `site/pr` is reserved; if it ever exists the Pages step fails.

## Trust model (read this before dispatching)

A PR page is **PR code running on `https://perusonao.github.io`**, the same origin as production
(`/teto-pizza-game/`) and the shared Preview. URL paths do not isolate an origin, so this is **not a sandbox**:
code on a PR page could read or overwrite the production save (`teto-pizza-save-v1`), the shared Preview save and
anything else in that origin's localStorage / IndexedDB. (The existing `deploy-from-source.yml` pipeline has the
same property for any ref; this workflow does not make it worse, but does not remove it either.)
What this design does about it:

- only an **open, same-repo PR opened by an allow-listed author** (`ALLOWED_PR_AUTHORS`, default `perusonao`) can
  be published, at the **exact head SHA** the dispatcher typed (re-checked right before the write-capable step);
  `workflow_dispatch` itself needs write access to this repo — review the diff before you dispatch;
- the key rewrite and the `--slug` suffix prevent **accidental** sharing (a normal game build never touches the
  other saves or opt-ins); they are not a defence against hostile code;
- a **CSP `<meta>`** (`connect-src 'self'`, no inline/eval script, `object-src 'none'`, `form-action 'self'`) makes
  the **browser** block fetch / XHR / WebSocket / EventSource to any other origin (Firestore, production
  endpoints, ...). It is a layer, not a wall: `navigator.sendBeacon` and top-level navigations are not covered
  (the runtime test reports the former as a known gap), and it cannot stop same-origin storage access;
- the page ships with no Firebase config (build job has no secrets), so the app never initialises Firebase.

A truly isolated origin (a separate account/org Pages site or a custom domain) is the only complete answer. That
needs a decision and setup outside this repo; it is **not** implemented here. If PRs from other authors will ever
be previewed, do not use this workflow for them.

## Tests

- `bash tests/pr-pages.test.sh` — offline unit tests (inputs, guard, push/rebase, rollback, patching, live checks
  against a local server, `pages.yml` assembly).
- `tests/pr-page-runtime.mjs` — real browser, one origin: seeds a real save with `?hv=normal`, proves the page
  writes only its own keys, survives a reload, leaves the shared Preview/production keys untouched and makes no
  external request (usage in the file header).

## Safety checks

- **Inputs**: PR author must be allow-listed (see Trust model); `sha` must be 40 lowercase hex (no branch names / short SHAs); for `deploy` the PR must be
  open, same-repo (no fork), and `sha` must be its **current head**; `confirm` must equal the slug.
- **Only `pr/<slug>/` may change**: checked on the staged index, as a before/after hash of every other
  tracked file, again after any rebase onto a concurrent push, and again for a rollback revert. Symlinks and
  non-regular files are refused; one page <= 60 MB; at most 5 pages at a time.
- **Least privilege**: workflow default `permissions: {}`. The *build* job (runs the PR's `npm ci`/build)
  has `contents: read` only, no secrets, no credentials persisted and no npm cache (it must not write caches
  that `main`-scoped workflows restore). The *publish* job (`contents: write`,
  `actions: write`) never runs PR code; it only copies the uploaded build. Publishing is refused unless the
  workflow runs from `main`. No `${{ inputs.* }}` is interpolated into shell source.
- **Own localStorage**: github.io is one origin shared by production, the shared Preview and every PR page.
  The build renames **every** `teto-` / `teto.` storage-key literal to `<key>--<slug>` (save, the cheese-canvas
  render opt-in, the hint5 opt-in and the `teto.dev.*` flags). It **fails closed**: a `teto-`/`teto.` literal that is
  not in the known list (`patch-storage-keys.py`) stops the build, as does a missing save key, so a key the
  app adds later cannot be silently shared. The build also fails if the production base `/teto-pizza-game/`
  or the shared Preview root is referenced, if a Firebase-style API key or a dotfile is present.
  (Note `teto-pizza-cheese-canvas` exists in **production** builds too; without the rename a PR page's
  `?cheeseCanvas=0` removed the shared Preview's opt-in. `tests/pr-page-runtime.mjs` catches exactly that.)
- **No Firebase / production writes**: the build job has no secrets; it asserts no `VITE_FIREBASE_*` in the
  environment and no loadable `.env*` file in the source, so the app's Firebase config stays `null` (the SDK is
  never initialised). The runtime check records every request and requires none to leave localhost.
- **Shared Preview already published**: before anything is pushed, `check-root-synced.sh` requires the **live**
  root to equal `site/index.html` on `main`. `pages.yml` deploys all of `main`, so without this a dispatch could
  also publish a pending shared-Preview update. It runs again after the publish.
- **Concurrency**: same group as `deploy-from-source.yml` (`cancel-in-progress: false`): never concurrently
  with a shared-Preview deploy or another PR-page job. GitHub keeps one queued run per group; a third
  dispatch replaces the queued one, so wait for a run to finish before dispatching again.
- **Rollback**: pushes use a bounded rebase-and-retry; if no push succeeds nothing is published. If a
  deploy was pushed but the live check fails, the commit is reverted automatically **only if it is still
  the tip of `main`** (otherwise a warning says to run `remove`). A failed `remove` is never rolled back.
- `GITHUB_TOKEN` pushes do not trigger `pages.yml`, so the workflow dispatches it explicitly.

## Cleanup

Run the same workflow with `action=remove`. The files stay in git history of this public repo (no secrets:
the build gets no Firebase variables). Running `deploy-from-source.yml` replaces only the shared Preview and
leaves PR pages in place; remove them when the verification is finished.
