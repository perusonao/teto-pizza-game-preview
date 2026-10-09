# teto-pizza-game preview

Deployment target for physical-device (primarily iPhone Safari)
verification of a branch/PR on
[perusonao/teto-pizza-game](https://github.com/perusonao/teto-pizza-game),
published at https://perusonao.github.io/teto-pizza-game-preview/

- **Source ref:** `82044341826d9bc3724ea3371cd08c2d722a2b66`
- **Source commit:** `82044341826d9bc3724ea3371cd08c2d722a2b66`
- **Source PR:** #422
- **Built:** 2026-10-09T10:18:26Z

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
