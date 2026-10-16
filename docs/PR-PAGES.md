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

`deploy` builds the pinned commit, publishes `pr/<slug>/`, re-deploys Pages, then polls the live URL and
checks that the shared Preview root is byte-identical to `site/index.html`. `remove` deletes `pr/<slug>/`
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

## Safety checks (offline-tested: `bash tests/pr-pages.test.sh`)

- **Inputs**: `sha` must be 40 lowercase hex (no branch names / short SHAs); for `deploy` the PR must be
  open, same-repo (no fork), and `sha` must be its **current head**; `confirm` must equal the slug.
- **Only `pr/<slug>/` may change**: checked on the staged index, as a before/after hash of every other
  tracked file, again after any rebase onto a concurrent push, and again for a rollback revert. Symlinks and
  non-regular files are refused; one page <= 60 MB; at most 5 pages at a time.
- **Least privilege**: workflow default `permissions: {}`. The *build* job (runs the PR's `npm ci`/build)
  has `contents: read` only, no secrets, no credentials persisted. The *publish* job (`contents: write`,
  `actions: write`) never runs PR code; it only copies the uploaded build. Publishing is refused unless the
  workflow runs from `main`. No `${{ inputs.* }}` is interpolated into shell source.
- **Own localStorage**: github.io is one origin, so the build's save key is rewritten to
  `teto-pizza-preview-<slug>-save-v1` (the shared Preview keeps `teto-pizza-preview-save-v1`, production
  `teto-pizza-save-v1`). The build **fails** if the old key literal is not found (the source changed it),
  if the production base `/teto-pizza-game/` is referenced anywhere, or if anything points at the shared
  Preview root instead of the page's own path. `teto.dev.*` dev flags are not namespaced (set manually only).
  A cleaner long-term fix is a build-time variable in the app's `persistence.ts`; that is a source-repo change
  and is deliberately not part of this PR.
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
