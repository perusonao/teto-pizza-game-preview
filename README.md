# teto-pizza-game preview

Deployment target for physical-device (primarily iPhone Safari)
verification of a branch/PR on
[perusonao/teto-pizza-game](https://github.com/perusonao/teto-pizza-game),
published at https://perusonao.github.io/teto-pizza-game-preview/

- **Source ref:** `e5d5452a6af05e3f8329a65226a0592df2df5def`
- **Source commit:** `e5d5452a6af05e3f8329a65226a0592df2df5def`
- **Source PR:** #75
- **Built:** 2026-09-18T15:55:24Z

`site/` is a production (`vite build --base=/teto-pizza-game-preview/`)
build of that exact commit, with `VITE_PREVIEW_MODE=1` set so the app
shows a small on-screen PREVIEW badge (source PR + short SHA) and saves
progress under its own localStorage key -- separate from
`perusonao.github.io/teto-pizza-game/`'s production save, since both
share the same `perusonao.github.io` origin.

Re-run via **Actions -> Build & deploy a source PR/branch -> Run workflow**
with a different `ref`/`pr_number` to preview another branch or PR.
This repo is not connected to teto-pizza-game's production GitHub Pages,
`main` branch, or Actions in any way.

## W1 Ingredient Visual Gate (additional, independent)

`site/w1-visual-gate/` is a separate preview-only bundle for the W1 Ingredient Visual Gate
(iPhone Human Verification of the 7 W1 candidate ingredients), published at
https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/

- **Source repo/branch:** `perusonao/teto-pizza-game` @ `claude/w1-ingredient-visual-preview-mt4uxw`
- **Source commit:** `ea8ae74b898698b7550bc8cf6ddd7f9382bc044b` (also shown on every page)
- **Built with:** `W1_GATE_SHA=<sha> W1_GATE_BASE=/teto-pizza-game-preview/w1-visual-gate/ npx vite build --config visual-gate/w1/vite.config.ts` (manifest removed)
- Saves under its own localStorage key `teto-pizza-w1-visual-gate-save-v1` (never the production or PR-preview save).
- Not the production game; not connected to teto-pizza-game's production Pages. The top-level
  preview above is unchanged by this addition. A later `deploy-from-source.yml` run replaces all
  of `site/` and would remove this subdirectory.
