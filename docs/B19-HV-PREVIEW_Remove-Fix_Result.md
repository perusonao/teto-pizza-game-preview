# B19 専用 Preview — remove 失敗の修正（Final Gate Result Report）

2026-11-07。Owner 判断（A案）: remove の不具合を修正して PR にする。**この PR の merge、remove の再実行、手動のページ削除、Pages deploy、Production ON、共有 Preview の更新、PR #783 の merge はしていない。** B19 の iPhone Safari HV は両レシピ 6/6、合計 12/12 PASS 済み（再検証不要）。

## 失敗
- 失敗した run: `42403809324`（Publish / remove の `remove`、`pr-783-8137dc3`）。validate は成功、publish の「Apply」で失敗（`fatal: pathspec 'pr' did not match any files`、終了コード 128）。main・Pages・公開ページは変化なし（`pr/pr-783-8137dc3/` は公開されたまま）。
- 原因: `apply.sh remove` は対象を `git rm` したあと `git add -A -- pr` を実行する。消したページが `pr/` の**最後の 1 つ**だと `pr/` ディレクトリ自体が消え、`git add` の対象が存在せず失敗する。B19 が `pr/` に入った最初で唯一のページだった。従来のテストは「別のページが残る」ケースだけで、この場合を検出できなかった。

## 修正（最小）
`.github/scripts/pr-pages/apply.sh` の remove 経路だけ。削除は `git rm` で既にステージ済みなので、`git add -A -- pr` を **`pr/` が存在するときだけ**実行する（1 行）。deploy は常に `pr/` を作るため影響なし。`guard-paths.sh` は削除だけを検査し、`pr/` が無くても通る（テスト済み）。

## 回帰テスト（`tests/pr-pages.test.sh`、15 件追加）
- 最後の 1 ページを削除: 成功し、`pr/` ごと消え、ステージされるのは `pr/<slug>/` 配下の削除のみ、`push.sh` で公開でき、リモートの main に `pr/` 配下のファイルが残らない。
- 複数ページから 1 ページだけ削除: 選んだページだけが消え、`pr/` と他のページはバイト一致で残る。
- 対象ページが既に存在しない: `pr/` が無い場合も、他のページだけがある場合も、大きなエラーで失敗し、何もステージされない。
- `site/`・`README.md`・`.github` が不変: インデックスとバイトで一致、削除コミットは `pr/<slug>/` だけを触る。
- 旧挙動に戻すと「最後の 1 ページを削除」のテストが失敗する（変異で確認）。

## テスト環境の安全策（同時に追加）
`guard_tmp`: git に書き込む節（remove、rollback）の前で、作業ディレクトリが一時ディレクトリ内であることを確認し、外なら `exit 99` で中止する。意図的に cwd を外へ出した試験で、中止されることを確認済み。

## 事故の記録（開示）
この修正の作業中、テストスクリプトに私が入れた誤り（新しいテスト節の最後で作業ディレクトリを一時ディレクトリではなくリポジトリのルートに戻した）により、後続の rollback 節のテストが**実際のクローンで実行され、実リポジトリの `origin/main` に 2 コミットを push した**（19:03:52Z `26f356a PR page deploy`＝テスト用の `pr/pr-494-a3d1872/` 3 ファイルの追加、19:03:55Z `1d0e4e8` その revert）。コミットは `github-actions[bot]` 名義（`push.sh` が設定する）。
- 影響: **ツリーは `188ec32` と完全に同一**（差分なし）。`site/`・README・公開ページに変化なし。`pages.yml` は `site/**` のみで起動するため **Pages の実行は起きていない**（最新の Pages run は 211 のまま）。HV 済みの公開ページと remove の再実行には影響しない。
- 対応: 履歴は書き換えていない（強制 push は禁止）。履歴上は `main` が `188ec32` → `26f356a` → `1d0e4e8` になっている。以後、作業クローンの push 先を無効化して再発を防ぎ、上の `guard_tmp` を入れた。

## 検証
| 項目 | 結果 |
|---|---|
| offline テスト | **194 passed / 0 failed**（従来 179 ＋ 追加 15）。旧挙動への変異は 1 件失敗 |
| `site/` と `README.md` | main と差分なし（この PR は `.github/scripts/pr-pages/apply.sh`、`tests/pr-pages.test.sh`、docs のみ） |
| CI | このリポジトリに pull_request で起動する workflow はない（チェック 0 件）。「関連 CI」は存在しない |
| 実ブラウザ | 不要（スクリプトとテストのみの変更で、公開物は変わらない）。B19 の実機 HV は 12/12 PASS 済み |

## 次のステップ（Owner の承認が必要）
1. この PR の Codex レビューと merge（merge commit 方式）。
2. merge 後、remove を **1 回だけ**実行する（`remove` / `783` / `abb3da5a…` / `source_sha=8137dc3b…` / `confirm=pr-783-8137dc3`）。最後の 1 ページなので、修正後は `pr/` ごと消え、Pages が再公開され、URL が 404 になる。
3. 同一 origin の条件付き受容は B19 の HV に限るもので、HV は完了済みのため、公開の継続は望ましくない。
