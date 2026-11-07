# B19 iPhone Safari HV page — Result Report (perusonao/teto-pizza-game#783 / #774)

> Updated for the PR #2 review findings (§7): the fixes are in THIS stacked PR (#6), because this session may push only to its own branch, not to PR #2's.

Status: **prepared, NOT published.** Nothing was merged, no workflow was run, the shared Preview (`site/`), Production and PR #2 are untouched.

## 1. What this PR is
A **stacked** PR (base = PR #2's branch `claude/pr-scoped-preview-pages`, not `main`). It adds one optional input, `source_sha`, to the PR-scoped page workflow
so that a *verification-only add-on commit* (the Batch 19 HV save seed `8137dc3ba61d636d777b05596b8866f5a74a9d03`, which is NOT part of #783) can be published at its own URL
without changing #783's head. 6 files: `validate-inputs.sh`, `apply.sh`, `pr-page.yml`, `docs/PR-PAGES.md`, `tests/pr-pages.test.sh`, `tests/pr-page-runtime.mjs` (+ this report). **`site/` is not touched.**

Why stacked, not folded into PR #2 and not a standalone PR on `main`: PR #2 is another open PR with its own review state (§5), and this session may push only to its designated branch;
a PR on `main` would repeat PR #2's 15 files. Stacked, the diff is only the add-on. When PR #2 is merged, retarget this PR to `main` (the 6 files do not overlap anything else).

## 2. State re-checked (2026-11-07)
- preview `main` = `4a66b3c` (shared Preview built from source `78de12a`, PR #738). PR #2 head = `02c06e2` (open, mergeable `clean`, last updated 2026-10-16). #783 head = `abb3da5a` (unchanged).
- PR #2 + `main` merge cleanly (checked with `git merge-tree`, and with a real merge commit earlier); `pages.yml`: main's `site/**` path filter and PR #2's `site/ + pr/` assembly coexist.

## 3. Final Gate results (local; no CI exists for this repo's PRs)
| Gate | Result |
|---|---|
| Offline tests `bash tests/pr-pages.test.sh` | 131 passed / 0 failed (19 for `source_sha`, 3 for remove, 27 for the PR #2 findings: other documents / workers / whole-tree sync / CSP) |
| `source_sha` against real data (read-only GitHub API) | `abb3da5a...8137dc3b`: ahead 5, behind 0, 9 files, all under `docs/` or `src/preview/` → `OK: deploy pr-783-8137dc3`; a wrong `confirm` is refused |
| Build of `8137dc3b` at the PR base path + `patch-build.sh` | passes: 4 storage keys renamed `--pr-783-8137dc3`, no production/shared-root reference, no Firebase, CSP added, manifest `start_url`/`scope` = the page path |
| Real browser (Chromium 390×844), shared Preview root and the page on ONE origin, `tests/pr-page-runtime.mjs` with `HV=b19-pesto-burrata`, `HV=b19-crudaiola`, `HV=normal` | all checks pass in all three: production key and shared Preview save/opt-ins unchanged, the page writes only its own keys, no re-seed on reload, cross-origin fetch/XHR blocked by CSP, no external request, shared-root badge unchanged, page badge `PREVIEW · PR#783 · 8137dc3`, Shop shows `burrata` as NEW |
| `site/` | unchanged: `git diff x/pr-scoped HEAD -- site` and `git diff origin/main...HEAD -- site` are both empty |
| Review | PR #2 carries 4 unresolved Codex findings (§5). This stacked PR: see its own comments |

## 4. Publish / remove procedure (Owner; NOT performed)
Prerequisite: PR #2's workflow (with this change) must be on `main` — a workflow change that needs Owner approval and a merge. The shared Preview must already be published (`check-root-synced.sh` enforces it).
1. Actions → **Publish / remove a PR-scoped preview page** → Run workflow (branch `main`):
   `action=deploy`, `pr_number=783`, `sha=abb3da5a1021b160b2ee75acbe5a00866a8a0eaf`, `source_sha=8137dc3ba61d636d777b05596b8866f5a74a9d03`, `confirm=pr-783-8137dc3`.
   The run validates (PR #783 open, same repo, allow-listed author, head still `abb3da5a`; `source_sha` strictly ahead and limited to `src/preview/` + `docs/`), builds without secrets, publishes only `pr/pr-783-8137dc3/`, redeploys Pages, then polls the live page until its `preview-meta.json` carries this run's id and the shared root is byte-identical.
2. iPhone Safari, a normal tab (not "Add to Home Screen"): `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-pesto-burrata` and `…/?hv=b19-crudaiola`. The badge must read `PREVIEW · PR#783 · 8137dc3`. Checklist: perusonao/teto-pizza-game `docs/reports/TETO_EXPANSION-BATCH-19_Result.md` §9.
3. Remove after the check: same workflow, `action=remove`, `pr_number=783`, `sha=abb3da5a1021b160b2ee75acbe5a00866a8a0eaf`, **`source_sha=8137dc3ba61d636d777b05596b8866f5a74a9d03` (required for remove too: the slug is derived from it; without it the slug would be `pr-783-abb3da5` and `confirm=pr-783-8137dc3` is refused)**, `confirm=pr-783-8137dc3`. A shared-Preview update (`deploy-from-source.yml`) never touches `pr/`, so it cannot delete the page, and the page does not survive in `site/`.
4. Rollback of a failed deploy is automatic only if the deploy commit is still the tip of `main`; otherwise run `remove`.
Not run by this session: any of the above, `deploy-from-source.yml`, `pages.yml`.

## 5. Risks (honest)
- **Same origin.** The page runs on `perusonao.github.io`, shared with Production and the shared Preview. Key renaming prevents *accidental* sharing; it is not a defence against hostile code (PR #2 "Trust model"). Mitigations: allow-listed author, exact-SHA pin, add-on limited to `src/preview/` + `docs/`, CSP `connect-src 'self'`, no Firebase config, build job without secrets.
- **PR #2's own review is not clean.** 4 threads are unresolved on #2 at `02c06e2`. Three (CSP only on `index.html`, workers outside the CSP, `index.html`-only sync check) are fixed in THIS PR — see §7 — but stay open on #2 until its branch contains these commits; the fourth (same origin) is an accepted risk. The earlier note that this build has no extra HTML / Worker is now enforced by the build, not just observed.
- **First real run is untested end to end.** The scripts and the browser checks ran locally; the GitHub Actions workflow itself has never run for `source_sha`. The first dispatch is the real test; use `remove` if anything looks wrong.
- Pushing to `main` with `GITHUB_TOKEN` does not trigger `pages.yml`; the workflow dispatches it explicitly (existing PR #2 design). The Pages deploy of `main` also publishes any pending shared-Preview change; the preflight refuses when the live root differs from `site/index.html`, but (Codex P2) a pending change to another file would pass it.
- The HV verdict (iPhone Safari, physical device) is the Owner's. No PASS is claimed here.

## 7. PR #2 review findings (4 unresolved threads) — status in this PR

| # | Codex / thread on PR #2 | Reproduced on the latest code? | Importance | Handled here |
|---|---|---|---|---|
| 1 | `patch-build.sh:29` **P1**: only `index.html` gets the CSP; another HTML entry (e.g. `escape.html`) is framed/loaded without it and can read the shared origin's storage | **Yes**, by construction: the publish path accepted any dist file | High (same-origin storage) | **Fixed**: `patch-build.sh` fails on any file type outside an allow-list (no second HTML, nested `index.html`, SVG, XML, `.wasm`, extension-less); CSP adds `frame-src 'none'; child-src 'none'`. 10 offline cases |
| 2 | `lib.sh:19` **P1**: `worker-src 'self' blob:` — a Worker is not governed by the document CSP and can send data out | **Yes**: with the old policy the real-browser probe created a blob Worker (negative check done) | High | **Fixed**: `worker-src 'none'`; the build also refuses `new Worker(` / `SharedWorker` / `serviceWorker.register(` / `importScripts(` (the game's source has none, and the real `8137dc3b` bundle passes: no false positive). Real-browser proof (probe fixed after Codex P2 on #6): REAL same-origin fixture scripts (a 404 can never pass for "blocked"), a control on the CSP-less shared root shows the same scripts DO start there, and the probe FAILS when the policy is loosened to `worker-src 'self'`, to the old `'self' blob:`, or `frame-src 'self'` (all three checked). `SERVE_ROOT` is now required by `tests/pr-page-runtime.mjs` |
| 3 | `check-root-synced.sh:15` **P2**: compares only `index.html`, so a pending manifest / icon / unreferenced-asset change would be published along with a PR page | **Yes** (a manifest-only drift passed the old check) | Medium (an unintended shared-Preview update) | **Fixed**: every tracked file of `site/` + the root URL must be byte-identical live; also used by `verify-live.sh`. 5 offline cases (manifest-only, icon-only, asset-only, missing live file, restored) |
| 4 | `pages.yml:39`: same-origin trust (a PR page is code on `perusonao.github.io`) | Not fixable in this repo | Accepted risk | **Not changed.** The thread stays open on purpose; mitigations are in `docs/PR-PAGES.md` (allow-listed author, exact-SHA pin, CSP, no Firebase config, key namespacing). Only a separate origin removes it |

Service Workers specifically: a page cannot register one (`worker-src 'none'`, proven), and a bundle that registers one cannot be published. A Service Worker that some other deployment registered under a broader scope of the same origin is outside this repo and not addressed.

Residual risk after these fixes: `navigator.sendBeacon` and top-level navigation still work (CSP `connect-src` does not cover them); same-origin storage cannot be protected by CSP at all. These fixes narrow the surface for an allow-listed author's PR; they do not make the origin a sandbox.

## 8. Dependencies and merge order
- **#2** (base, perusonao's PR; 4 unresolved Codex threads: #1–#3 above are fixed only in #6, #4 is an accepted risk) → **#6** (stacked on #2: `source_sha` + the fixes above) → retarget #6 to `main`.
- Order for the Owner: (1) decide on #4 (accept, or move to a separate origin); (2) merge #2, then #6 — or fold #6's commits into #2's branch and merge once; (3) only then run the publish workflow. The PR #2 threads #1–#3 will still show as unresolved on #2 until its branch contains these commits; they cannot be resolved from #6.
- #6 touches only workflow/scripts/tests/docs (no `site/`); merging it before #2 is impossible (its base is #2's branch); merge-tree of #6 with `main` is clean.
