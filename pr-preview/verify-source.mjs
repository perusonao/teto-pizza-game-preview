// Step 3 of the build job (runs BEFORE any dependency of the source is installed or executed):
// the commit that was checked out must belong to the PR number the caller named, and the source tree must not carry env files.
//
//   - pr_number > 0: the checked-out commit must be that PR's head, its merge commit (once merged), or one of its commits, and the
//     PR must come from this repository, not a fork.
//   - pr_number 0 (smoke test only): the commit must already be on main (an ancestor of, or equal to, main).
//
// Fail closed: any API error, missing field or unexpected shape rejects the build.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GuardError, SOURCE_REPO, fail, findEnvFiles, validateBranch, validateSha } from "./lib.mjs";

const API = "https://api.github.com";

async function getJson(fetchImpl, url, token) {
  let res;
  try {
    res = await fetchImpl(url, {
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
  } catch (e) {
    return fail(`GitHub API request failed (${url}): ${e.message}`);
  }
  if (!res.ok) return fail(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

async function prCommitShas(fetchImpl, pr, token) {
  const shas = new Set();
  for (let page = 1; page <= 3; page++) {
    const batch = await getJson(fetchImpl, `${API}/repos/${SOURCE_REPO}/pulls/${pr}/commits?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) fail("unexpected response for the PR's commit list");
    for (const c of batch) if (c && typeof c.sha === "string") shas.add(c.sha);
    if (batch.length < 100) return shas;
  }
  return shas; // 300 commits is more than any PR here; a commit beyond that is rejected below (fail closed)
}

/** @returns {Promise<{ok: true, reason: string}>} or throws GuardError */
export async function verifyCommitBelongsToPr({ sha, pr, fetchImpl = fetch, token }) {
  validateSha(sha);
  if (pr === "0") {
    const cmp = await getJson(fetchImpl, `${API}/repos/${SOURCE_REPO}/compare/main...${sha}`, token);
    if (cmp?.status !== "identical" && cmp?.status !== "behind") fail(`smoke test commit ${sha} is not on main (compare status: ${cmp?.status})`);
    return { ok: true, reason: `commit is on main (${cmp.status})` };
  }
  const data = await getJson(fetchImpl, `${API}/repos/${SOURCE_REPO}/pulls/${pr}`, token);
  if (data?.base?.repo?.full_name !== SOURCE_REPO) fail(`PR #${pr} is not a pull request of ${SOURCE_REPO}`);
  if (data?.head?.repo?.full_name !== SOURCE_REPO) fail(`PR #${pr} comes from a fork or a deleted repository; only same-repository PRs can be previewed`);
  if (typeof data?.head?.sha !== "string") fail(`PR #${pr} has no head SHA`);
  if (sha === data.head.sha) return { ok: true, reason: "commit is the PR head" };
  if (data.merged === true && typeof data.merge_commit_sha === "string" && sha === data.merge_commit_sha) return { ok: true, reason: "commit is the PR's merge commit" };
  const commits = await prCommitShas(fetchImpl, pr, token);
  if (commits.has(sha)) return { ok: true, reason: "commit is one of the PR's commits" };
  return fail(`commit ${sha} does not belong to PR #${pr} (head ${data.head.sha})`);
}

export function main({ env = process.env, sourceDir = "source", git = (args) => execFileSync("git", ["-C", sourceDir, ...args], { encoding: "utf8" }).trim() } = {}) {
  const sha = validateSha(git(["rev-parse", "HEAD"]));
  const envFiles = findEnvFiles(sourceDir);
  if (envFiles.length > 0) fail(`the source tree carries env files that Vite would load: ${envFiles.join(", ")}`);
  validateBranch(env.BRANCH);
  return sha;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const sourceDir = process.argv[2] ?? "source";
    const sha = main({ sourceDir });
    const pr = process.env.PR_NUMBER;
    const verdict = await verifyCommitBelongsToPr({ sha, pr, token: process.env.GH_TOKEN });
    console.log(`source ok: ${sha} (${verdict.reason})`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\nshort=${sha.slice(0, 7)}\n`);
  } catch (e) {
    if (!(e instanceof GuardError)) throw e;
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
