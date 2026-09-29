# LC-R5-b Real-Device Discovery harness (THROWAWAY)

Not part of the game. Not production. Not a route. This branch is an **orphan** branch: it shares no
history and no files with `main`, contains no `package.json`, no `src/`, no `.github/`, so no build,
CI or deploy can pick it up. Do not merge it; do not open a PR.

Single self-contained page (`index.html`, no external requests) + `manifest.webmanifest`.
It reproduces, with the production CSS values copied verbatim: the viewport lock
(`html/body/#root { overflow:hidden; height:100svh/100dvh }`), a fixed bottom sheet
(`min(70dvh, 100dvh - safe-top - 20px)`, header / 閉じる / subtitle / search / chips slot /
optional selected-strip slot / the only scrolling list), a fake stage / dock / bake bar, safe-area,
`viewport-fit=cover`, and the `apple-mobile-web-app-*` metas.
Search field: `type=search`, 16px, 44px, never auto-focused, never removed on 0 results.
Owner-approved aliases (たまねぎ→玉ねぎ, たまご→卵, モッツァレラ→モッツァレラチーズ) exist **only here**.
Mode C (`visualViewport` fit) is an EXPERIMENT for data collection, not a chosen design.

Local: `python3 -m http.server` in the repo root, open `/discovery/lc-r5b/`.
