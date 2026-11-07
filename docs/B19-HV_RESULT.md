# Batch 19 iPhone HV 用 PR 専用ページ — Result Report（実装・検証、公開なし）

2026-11-07。Owner 承認: PR #2 の既存 PR 別ページ方式を再利用し、B19 の固定 SHA だけを許可する最小の入力検証を追加（Issue #774 / PR #783）。
**merge・Pages デプロイ・workflow 実行・Production ON・共有 Preview 更新はしていない。PR #783 の HEAD は `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf` のまま。** 実機 HV は 0 PASS。

## ブランチ
`claude/teto-pizza-parallel-tasks-ylyfe5`（このリポジトリの独立ブランチ）= PR #2 のブランチ `claude/pr-scoped-preview-pages`（`02c06e29`）＋ 最新 main（`4a66b3c`、共有 Preview は PR #738 / `78de12a`）の取り込み ＋ B19 追加。PR #2 自体は変更していない。

## 変更ファイル（PR #2 に対する追加分のみ）
| ファイル | 内容 |
|---|---|
| `.github/scripts/pr-pages/lib.sh` | B19 の定数（PR 783、PR head `abb3da5a`、固定 SHA `8137dc3b…`、許可パス） |
| `.github/scripts/pr-pages/validate-inputs.sh` | 「PR 783 ＋ 固定 SHA」の組だけ例外。他は従来どおり厳格 |
| `tests/pr-pages.test.sh` | B19 例外のテスト 26 件を追加 |
| `tests/fixtures/b19-compare-abb3da5a...8137dc3b.json` | GitHub の実 compare 出力（使用項目のみ） |
| `docs/PR-PAGES.md` | B19 例外の節 |
| `docs/B19-HV_RESULT.md` | 本書 |
main との差は、PR #2 由来の infra（`pr-page.yml`、`scripts/pr-pages/*`、`tests/*`、`docs/PR-PAGES.md`）と `pages.yml`（assemble 追加）のみ。`site/`・`README.md`・`deploy-from-source.yml` は main と同一（`git diff origin/main -- site README.md` が空）。

## 例外の条件（すべて満たす場合のみ許可）
1. PR #783 が open・同一リポジトリ・許可済み作者で、**head がまだ `abb3da5a`**。
2. GitHub compare `abb3da5a...8137dc3b` が `ahead`（`behind_by` 0、merge base = `abb3da5a`）で、コミット一覧が完全で固定 SHA を含む（**固定 SHA は PR #783 の HEAD の子孫**。実測: ahead 5 コミット）。
3. その間に変更されたファイルは許可リストのみ・added/modified のみ・`..` なし: `src/preview/{b19HvSeeds.ts, b19HvSeeds.test.ts, hvSeeds.ts, previewIsolation.gate.test.ts}` と `docs/**`。**`package.json`・lockfile・`vite.config`・他のソースが 1 つでも変わると拒否**（実測の変更 9 ファイルは全て許可内）。→ ビルドで実行されるスクリプトは PR #783 自身のものと同じ。
4. `confirm` に slug `pr-783-8137dc3` を手入力。保存キーは既存の `--pr-783-8137dc3` 方式（4 キーすべて付け替え）。

## テスト結果
- offline テストの内容を事前に読んだ（一時ディレクトリ・ローカル `127.0.0.1` のみ・bare リポジトリ。ネットワーク書き込みなし）。`bash tests/pr-pages.test.sh` → **113 passed / 0 failed**（従来 87 ＋ B19 26）。出力中の `expected 'acknowledgments'` は、サンドボックスの git プロキシがローカル bare への push で出す警告で、結果に影響しない。
- 変異テスト: 許可パス検査を無効化 → 4 件失敗、`ahead` 検査を除去 → 2 件失敗、PR head の固定を外す → 2 件失敗（すべて検出）。
- 実ビルド（`8137dc3b`、`--base=/teto-pizza-game-preview/pr/pr-783-8137dc3/`）に `patch-build.sh` を適用して成功。付け替えられたキー: `teto-pizza-preview-save-v1`、`teto-pizza-cheese-canvas`、`teto-pizza-preview-hint5-optin`、`teto.dev.researchIdentify`（未知キーなし）。
- Chromium 390×844（同一オリジンに本番・共有 Preview 用ダミーキーを置いて確認）: それらは**値が不変**。書き込みは `…--pr-783-8137dc3` のみ（Pitz 999、burrata 未所持、既発見 83、reload で維持）。バッジ `PREVIEW · PR#783 · 8137dc3`、manifest は新パス、外部リクエスト 0、ページエラー 0、CSP 違反 0。
- 公開内容の不変: `pages.yml` の assemble ステップを抽出して実行し、`pr/` が無い状態で `_pages` が `site/` と**バイト一致**。`site/pr` の衝突・`pr/` 内の symlink は拒否（テスト済み）。`pages.yml` の push 時 `paths: site/**` フィルタは維持。
- 未実施: GitHub Actions 上での実行、`tests/pr-page-runtime.mjs`（Playwright。同等の確認を上記で別途実施）、全 Vitest/CI（本変更は Preview リポジトリの infra のみ）。

## 公開時のリスク
- **同一 origin（`perusonao.github.io`）は分離できない**。キーの付け替えは誤用の防止で、悪意あるコードへの防御ではない。CSP（`connect-src 'self'`）は fetch/XHR を止めるが、同一 origin の storage アクセスは止められない。**Safari のプライベートタブ必須**。
- `pages.yml` の実行は **main 全体の公開**。共有 Preview に未公開の更新があると巻き込むため、`check-root-synced.sh` がライブのルート＝`site/index.html` を要求（不一致なら中止）。
- workflow は `main` 上でしか公開できない設計（validate が `refs/heads/main` を要求）。**merge 前は実行できない**。merge しても `site/` は変わらないため、merge 自体では Pages は再公開されない（push の paths フィルタ）。
- ページは公開リポジトリの git 履歴に残る（秘密情報なし）。`noindex` は検索対策で、アクセス制限ではない。
- GitHub 上の Pages / `github-pages` environment の保護ルールは未確認。
- 共有 Preview の次回更新（`deploy-from-source`）では `pr/` は消えない。B19 終了後は必ず remove する。

## 公開手順（Owner 承認後。iPhone の GitHub Web で可）
1. （承認 A）このブランチを main へ merge（PR #2 の置き換え。`site/` 不変）。
2. （承認 B）Actions → **Publish / remove a PR-scoped preview page** → Run workflow（branch `main`）: `action=deploy`、`pr_number=783`、`sha=8137dc3ba61d636d777b05596b8866f5a74a9d03`、`confirm=pr-783-8137dc3`。validate → build → publish が自動で進み、Pages 再公開と live 検証まで行う。
3. Safari の**プライベートタブ**で開く。バッジ `PREVIEW · PR#783 · 8137dc3` と `preview-meta.json` の `sha` を確認。

## 撤去手順
- Actions → 同 workflow → `action=remove`、同じ値（`pr_number=783`、`sha`、`confirm=pr-783-8137dc3`）。`pr/pr-783-8137dc3/` だけが消え、Pages が再公開され、URL が 404 になるまで待つ。`site/`（共有 Preview）には触れない。
- 手動: Web 画面で `pr/pr-783-8137dc3/` を削除 → Actions で `pages.yml` を実行。

## 専用 URL
- `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-pesto-burrata`
- `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-crudaiola`
URL を新しく開くと再シード、reload・戻る操作では再シードされない。

## 残る Owner 判断
承認 A（main への merge、または PR #2 の扱い）、承認 B（deploy の実行）、`github-pages` environment の Required reviewer の使用可否、HV 終了後の remove。

## 追補（レビュー指摘4件の精査、PR #5）
PR #2 の未解決指摘（P1×3・P2×1）と、PR #5 の Codex 指摘 P2×2 を精査して修正した。詳細は `docs/PR-PAGES.md` の「Open risk register」。
- **同一 origin（P1）: 残存（OPEN）。** Safari のプライベートタブは、tester の既存データをそのセッションから隔離する手順にすぎず、URL を通常タブで開く人には効かない（公開側で強制できない）。別 origin だけが根本解決で、現状は Owner が受容する時限リスク（短期公開 → remove）。
- 追加 HTML の CSP（P1）: 修正（index.html 以外の文書系ファイルはビルド失敗、frame/child 禁止）。
- Worker（P1）: 修正（`worker-src 'none'`）。実ブラウザで blob Worker は実行されず、旧ポリシーでは失敗することを確認。
- 共有サイト全体の同期（P2）: 修正（全ファイル比較＋ push 時に `site/` が動いたら中止）。
- PR #5 Codex P2×2: push 時の `site/` 変更検査（上記）／ランタイムテストのバッジを slug から導出（さらに `?cheeseCanvas=0` の期待値を現行アプリに合わせた）。
