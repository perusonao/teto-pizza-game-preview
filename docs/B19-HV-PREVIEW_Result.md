# B19 iPhone Safari HV page — Result Report (perusonao/teto-pizza-game#783 / #774)

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
| Offline tests `bash tests/pr-pages.test.sh` | 104 passed / 0 failed (19 new for `source_sha`) |
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
- **PR #2's own review is not clean.** 4 threads are unresolved at `02c06e2`: Codex P1 (an extra HTML entry is not given the CSP), P1 (a same-origin Worker is not governed by the document CSP), P2 (`check-root-synced.sh` compares only `index.html`), and the same-origin trust note. They are PR #2's, not changed here. For THIS build they do not apply in practice (the built page has only `index.html`, no Worker, no extra HTML — checked in the dist), but the workflow itself should not be treated as hardened until they are decided.
- **First real run is untested end to end.** The scripts and the browser checks ran locally; the GitHub Actions workflow itself has never run for `source_sha`. The first dispatch is the real test; use `remove` if anything looks wrong.
- Pushing to `main` with `GITHUB_TOKEN` does not trigger `pages.yml`; the workflow dispatches it explicitly (existing PR #2 design). The Pages deploy of `main` also publishes any pending shared-Preview change; the preflight refuses when the live root differs from `site/index.html`, but (Codex P2) a pending change to another file would pass it.
- The HV verdict (iPhone Safari, physical device) is the Owner's. No PASS is claimed here.
