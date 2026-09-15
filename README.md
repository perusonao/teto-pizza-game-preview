# teto-pizza-game PR #26 preview

Temporary preview for **Physical iPhone Human Feel verification** of
[perusonao/teto-pizza-game PR #26](https://github.com/perusonao/teto-pizza-game/pull/26)
(Phase 4A-1B: Cheese & Topping Physical Interaction).

- **Preview commit:** `e02425b3855625d225339fcae0eaead5699ceff3`
  (`codex/phase-4a-1b-physical-interaction` branch)
- **Content:** an unmodified production build (`vite build`) of that exact
  commit. No source changes — `site/app.js` is the built app bundle with
  its one image asset inlined as a data URI so the preview can ship as
  plain static files; `site/style.css` and `site/index.html` are the
  built CSS and a minimal HTML shell.
- **Not connected to** `perusonao/teto-pizza-game`'s production GitHub
  Pages, its `main` branch, or its Actions — this is a separate,
  disposable repository whose only purpose is hosting this one preview.
  Safe to delete once verification is done.

Confirm on iPhone Safari: HOME → ピザを作る → Margherita → ソースを塗る →
モッツァレラ3個をdrag → バジル2枚をdrag → 焼く → RESULT.
