# teto-pizza-game preview

Deployment target for physical-device (primarily iPhone Safari)
verification of a branch/PR on
[perusonao/teto-pizza-game](https://github.com/perusonao/teto-pizza-game),
published at https://perusonao.github.io/teto-pizza-game-preview/

- **Source ref:** `claude/phase-4a-1b-human-feel-preview-1byr1k`
- **Source commit:** `564fd52` (Phase 4A-1B Human Feel Fix 3 -- PREPARE
  1-screen layout, fixed Bake CTA, and a Sauce Visual rewrite (bilinear
  interpolation, no more grid/stamp pattern); built on PR #26's
  `e02425b3855625d225339fcae0eaead5699ceff3`)
- **Source PR:** #26
- **Content:** a production (`vite build --base=/teto-pizza-game-preview/`)
  build of that exact commit, with `VITE_PREVIEW_MODE=1` set so the app shows
  a small on-screen PREVIEW badge (source PR + short SHA) and saves progress
  under its own localStorage key -- separate from
  `perusonao.github.io/teto-pizza-game/`'s production save, since both share
  the same `perusonao.github.io` origin.

Confirm on iPhone Safari (390x844): HOME → ピザを作る → Margherita →
ソースを塗る → モッツァレラ3個をdrag → バジル2枚をdrag → 焼く → RESULT.

## Redeploying a different PR/branch

Run **Actions → Build & deploy a source PR/branch → Run workflow**, giving it
the branch/tag/SHA on `perusonao/teto-pizza-game` to build and (optionally)
the PR number it belongs to. That workflow (`.github/workflows/deploy-from-source.yml`)
checks out the source repo at that ref, builds it with the Preview base path
and env vars above, and pushes the result into `site/` here -- which the
`Deploy Preview to GitHub Pages` workflow then publishes automatically.

This repo is not connected to `teto-pizza-game`'s production GitHub Pages,
`main` branch, or Actions in any way -- it is a disposable, always-overwritable
deployment target with exactly one live preview at a time.
