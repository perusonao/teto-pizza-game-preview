// Job 3 (after Environment approval), immediately before `wrangler pages deploy`: re-check everything about the tree and the target.
// Prints project= / branch= to GITHUB_OUTPUT so the deploy step takes them from here, not from the dispatch inputs.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GuardError, PRODUCTION_BRANCH, PROJECT_NAME, checkFinalTree, fail, validateBranch, validateSha } from "./lib.mjs";

/** wrangler reads `functions/`, `_worker.js` and its config from the working directory: it must hold none of them. */
export function checkWorkingDirectory(cwd) {
  for (const name of ["functions", "_worker.js", "_routes.json", "wrangler.toml", "wrangler.json", "wrangler.jsonc"]) {
    if (existsSync(path.join(cwd, name))) fail(`${name} exists in the deploy working directory ${cwd}`);
  }
}

/**
 * The directory that is published must not be (or sit inside) a directory tracked by git: in the deploy job the checkout holds the shared
 * Preview's site/, and downloading the artifact into it would publish both. Outside a git work tree there is nothing tracked.
 */
export function assertNotTracked(dir, cwd = process.cwd()) {
  let listed = "";
  try {
    listed = execFileSync("git", ["-C", cwd, "ls-files", "--", path.resolve(cwd, dir)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return; // not a git work tree
  }
  if (listed.trim() !== "") fail(`${dir} contains files tracked by git (the shared Preview?); the finalized tree must be downloaded into an empty directory`);
}

export function guardDeploy({ dir, sha, pr, branch, cwd, env = process.env }) {
  validateSha(sha);
  const b = validateBranch(branch);
  if (b === PRODUCTION_BRANCH) fail("production branch");
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== "perusonao/teto-pizza-game-preview") fail(`unexpected repository ${env.GITHUB_REPOSITORY}`);
  if (env.GITHUB_REF && env.GITHUB_REF !== "refs/heads/main") fail(`deploys only run from refs/heads/main (got ${env.GITHUB_REF})`);
  for (const secret of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    if (!env[secret]) fail(`${secret} is not set (is the cloudflare-preview Environment configured with its secrets?)`);
  }
  checkWorkingDirectory(cwd);
  assertNotTracked(dir, env.GITHUB_WORKSPACE ?? process.cwd());
  const files = checkFinalTree(dir, { sha, pr, branch: b });
  return { project: PROJECT_NAME, branch: b, files: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const e = process.env;
    const r = guardDeploy({ dir: e.SITE_DIR, sha: e.SHA, pr: e.PR, branch: e.BRANCH, cwd: e.DEPLOY_CWD ?? process.cwd() });
    console.log(`deploy guard ok: ${r.files} files -> ${r.project} / ${r.branch}`);
    if (e.GITHUB_OUTPUT) appendFileSync(e.GITHUB_OUTPUT, `project=${r.project}\nbranch=${r.branch}\n`);
  } catch (err) {
    if (!(err instanceof GuardError)) throw err;
    console.error(`::error::${err.message}`);
    process.exit(1);
  }
}
