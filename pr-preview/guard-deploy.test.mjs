import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { GuardError, PROJECT_NAME } from "./lib.mjs";
import { finalize } from "./finalize.mjs";
import { checkWorkingDirectory, guardDeploy } from "./guard-deploy.mjs";
import { SHA, fakeBuild, put, tmp } from "./testSupport.mjs";

const ENV = { GITHUB_REPOSITORY: "perusonao/teto-pizza-game-preview", GITHUB_REF: "refs/heads/main", CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" };

function site() {
  const inDir = tmp("in-");
  const dir = path.join(tmp("out-"), "site");
  fakeBuild(inDir);
  finalize({ inDir, outDir: dir, sha: SHA, pr: "618", branch: "pr-618", ref: SHA, env: {} });
  return dir;
}
const args = (dir, over = {}) => ({ dir, sha: SHA, pr: "618", branch: "pr-618", cwd: tmp("cwd-"), env: ENV, ...over });
const rejects = (a) => assert.throws(() => guardDeploy(a), GuardError);

test("a finalized tree for an allowed branch passes and names the fixed project", () => {
  const r = guardDeploy(args(site()));
  assert.equal(r.project, PROJECT_NAME);
  assert.equal(r.branch, "pr-618");
});

test("never deploys to the production branch or an invalid branch", () => {
  const dir = site();
  for (const branch of ["production-disabled", "main", "pr-618-", ""]) rejects(args(dir, { branch }));
});

test("only from main of the preview repository", () => {
  const dir = site();
  rejects(args(dir, { env: { ...ENV, GITHUB_REF: "refs/heads/claude/x" } }));
  rejects(args(dir, { env: { ...ENV, GITHUB_REF: "refs/pull/1/merge" } }));
  rejects(args(dir, { env: { ...ENV, GITHUB_REPOSITORY: "someone/fork" } }));
});

test("missing Cloudflare credentials are reported, not silently skipped", () => {
  const dir = site();
  rejects(args(dir, { env: { ...ENV, CLOUDFLARE_API_TOKEN: "" } }));
  rejects(args(dir, { env: { ...ENV, CLOUDFLARE_ACCOUNT_ID: undefined } }));
});

test("the tree must be the finalized one for this SHA / PR / branch", () => {
  const dir = site();
  rejects(args(dir, { sha: "1".repeat(40) }));
  rejects(args(dir, { pr: "619" }));
  rejects(args(dir, { branch: "pr-619" }));
  put(dir, "functions/x.js", "x");
  rejects(args(dir));
});

test("the working directory must not hold functions / worker / wrangler config", () => {
  const dir = site();
  for (const name of ["functions/a.js", "_worker.js", "_routes.json", "wrangler.toml", "wrangler.jsonc"]) {
    const cwd = tmp("cwd-");
    put(cwd, name, "x");
    rejects(args(dir, { cwd }));
  }
  checkWorkingDirectory(tmp("clean-"));
});
