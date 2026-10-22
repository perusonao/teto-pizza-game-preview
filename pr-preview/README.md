# PR 別 Preview（Cloudflare Pages Direct Upload）

`perusonao/teto-pizza-game` の PR／検証対象ごとに、**本番 (`perusonao.github.io`) とは別の origin** で iPhone Safari から開ける Preview を作る仕組みです。
設計: `perusonao/teto-pizza-game` の `docs/reports/TETO_PHASE-1B_PER-PR-PREVIEW_Fresh-Audit.md` と `..._CLOUDFLARE-PREVIEW_Phase1-Implementation-Plan.md`。

**共有 Preview（`site/`、`deploy-from-source.yml`、`pages.yml`、README.md）はこの仕組みの対象外で、変更しません（凍結）。**

## 使い方（Owner の設定が済んだ後）

Actions → **Deploy PR preview (Cloudflare Pages)** → Run workflow（ブランチは `main`）。

| 入力 | 内容 |
|---|---|
| `ref` | `perusonao/teto-pizza-game` の commit SHA（HV は **完全な SHA** を推奨） |
| `pr_number` | PR 番号。`0` は main 上のコミットのスモークテスト専用（`label` は `smoke`） |
| `label` | 任意。`[a-z0-9-]`、16 文字まで。Cloudflare のブランチ名が `pr-<n>-<label>` になる |
| `deploy` | **既定 `false` = ビルドと検査だけ（Cloudflare に接続しない）**。`true` で Environment の承認後にデプロイ |

URL（Job Summary に出ます。Issue に記録してください）:
- PR のエイリアス `https://pr-<n>[-<label>].teto-pizza-pr-preview.pages.dev` — 同じ PR の再デプロイで最新を指す。同じ origin なので保存も引き継がれる。
- デプロイ固有 URL `https://<hash>.teto-pizza-pr-preview.pages.dev` — その回のビルド専用。毎回空の保存から始まる。**R8 実機 HV（#617／#618）はこちらを使う。**
- FINISH を試すときは URL に `?freeFinish=on`（Preview のみ、そのページロード限り）。本番は OFF のまま。
- ビルドの確認: 画面のバッジ `PREVIEW · PR#<n> · <short SHA>` と `/preview-info.json`（`commit` が一致すること）。

## パイプライン（3 つの job）

| job | 内容 | secrets |
|---|---|---|
| `build` | 入力検証 → source を checkout → **コミットが PR に属することを確認**（head／merge commit／PR 内のコミット。fork 由来は拒否。`pr_number=0` は main 上のコミットのみ）→ source に `.env*` がないことを確認 → `npm ci` → `vite build --base=/`（`VITE_PREVIEW_MODE=1`、`VITE_PREVIEW_PR`、`VITE_PREVIEW_SHA`。`VITE_FIREBASE_*` は渡さない） | **なし** |
| `finalize` | この repo の信頼できるスクリプトが、ビルド出力を許可リストでコピー（`_worker.js`／`functions/`／`_redirects` 等と未知の拡張子は拒否）、manifest の `start_url`／`scope` を `/` に、noindex の meta と `_headers`、`preview-info.json` を生成。Firebase の API キー（`AIza…`）の混入、Preview モードのビルドか（Preview の保存キーと short SHA がバンドルにあるか）も検査 | **なし** |
| `deploy` | `deploy=true` かつ `main` から実行のときだけ。**Environment `cloudflare-preview`（Owner の承認）** → 固定バージョンの Wrangler（ロックファイル、`--ignore-scripts`）→ ガード再実行 → `wrangler pages deploy` | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（Environment secrets） |

## デプロイを防ぐガード

1. `workflow_dispatch` のみ。`pull_request`／`pull_request_target`／`workflow_run`／`issue_comment`／`schedule` では動かない。
2. `deploy` の既定は `false`。既定のまま実行しても Cloudflare には届かない。
3. `deploy` job は `deploy == true` かつ `refs/heads/main` かつ本 repo のときだけ実行され、Environment の承認が必要。
4. Cloudflare のプロジェクト名（`teto-pizza-pr-preview`）と production ブランチ名（`production-disabled`）は `pr-preview/lib.mjs` の定数。入力からは取らない。ブランチは `pr-<n>[-<label>]`（28 文字以内）のみで、`production-disabled` や `main` は拒否。
5. secrets は `deploy` job だけ（テストで固定）。PR のコードを実行する `build` job には渡さない（`GITHUB_TOKEN` の読み取り専用 1 ステップを除く）。
6. `deploy` job は PR のコードを実行しない。ビルド出力は `finalize` で作り直した木だけを使い、デプロイ直前に全項目を再検査する。
7. 全 action は commit SHA で固定。入力は `env` 経由のみ（シェル行に `${{ }}` を埋め込まない。テストで固定）。
8. 作業ディレクトリに `functions/`、`_worker.js`、wrangler 設定がないことを確認（Wrangler がそれらを実行してしまうのを防ぐ）。

## テスト

`node --test pr-preview/*.test.mjs`（PR では `PR preview pipeline tests` が自動実行。secrets なし、デプロイなし）。このテストは共有 Preview のファイルが変更されていないことも確認します。

## Owner が一度だけ行う設定（Claude は行わない）

1. **Cloudflare**（専用の無料アカウント推奨・2 要素認証）: Workers & Pages → Pages → **Direct Upload** で、プロジェクト名 **`teto-pizza-pr-preview`** を作成。production ブランチは **`production-disabled`** にする（CLI なら `wrangler pages project create teto-pizza-pr-preview --production-branch production-disabled`）。※ Direct Upload は後から Git 連携に切り替えられません。
2. **API トークン**: Custom token、権限は `Account` → `Cloudflare Pages` → `Edit` のみ。有効期限を設定。Account ID も控える。
3. **GitHub**（この repo の Settings → Environments）: **`cloudflare-preview`** を作成 →
   - Required reviewers に Owner を追加（public repo なので利用可）。**「Prevent self-review」をオンにすると、自分で実行した deploy を自分で承認できなくなる**ので、Owner 単独運用ならオフにする。
   - **Deployment branches は `main` のみ**（Selected branches）。
   - Environment secrets に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` を登録（repo secrets には置かない）。
4. この PR の merge 後、最初は `deploy=false` で動作を確認し、スモーク（`pr_number=0`、`label=smoke`、`deploy=true`）→ #618 の実機 HV の順に進める。各デプロイは Environment で承認する。

## ロールバック

- 不要な公開物: Cloudflare でデプロイを削除（エイリアス付きは `--force`、ブランチの最新デプロイは削除できない場合あり）、またはプロジェクトごと削除。
- トークン漏えいの疑い: Cloudflare で Revoke → GitHub の Environment secrets を削除。
- 取りやめ: このディレクトリと 2 つの workflow を削除する PR。共有 Preview・本番・source repo は影響を受けません。

## 注意

この PR を `main` に merge すると、`main` への push で既存の `Deploy Preview to GitHub Pages`（`pages.yml`）が走り、**同じ `site/` が共有 Preview に再デプロイされます**（内容は変わりません）。`pages.yml` を変更せずには避けられないため、承知の上で merge してください。
