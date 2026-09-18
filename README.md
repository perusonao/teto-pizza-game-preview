# teto-pizza-game preview

Deployment target for physical-device (primarily iPhone Safari)
verification of a branch/PR on
[perusonao/teto-pizza-game](https://github.com/perusonao/teto-pizza-game),
published at https://perusonao.github.io/teto-pizza-game-preview/

- **Source ref:** `9cdd57de4e8441fb0403e2f7cb384f51b102ec11`
- **Source commit:** `9cdd57de4e8441fb0403e2f7cb384f51b102ec11`
- **Source PR:** #66
- **Built:** 2026-09-18T12:24:43Z

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
