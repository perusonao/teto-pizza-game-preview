import assert from "node:assert/strict";
import { test } from "node:test";
import { GuardError, SOURCE_REPO } from "./lib.mjs";
import { main, verifyCommitBelongsToPr } from "./verify-source.mjs";
import { SHA, put, tmp } from "./testSupport.mjs";

const HEAD = "7d023a1726838c793b5d56ba37eeb460871cf589";
const MID = "1111111111111111111111111111111111111111";
const MERGE = SHA;

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function api(routes) {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    for (const [needle, body] of Object.entries(routes)) if (url.includes(needle)) return body instanceof Error ? Promise.reject(body) : body;
    return json({}, 404);
  };
  return { fetchImpl, seen };
}
const pr = (over = {}) => ({ base: { repo: { full_name: SOURCE_REPO } }, head: { sha: HEAD, repo: { full_name: SOURCE_REPO } }, merged: true, merge_commit_sha: MERGE, ...over });
const rejects = (p) => assert.rejects(p, GuardError);

test("the PR head, its merge commit and its own commits are accepted", async () => {
  const { fetchImpl } = api({ "/pulls/618/commits": json([{ sha: MID }, { sha: HEAD }]), "/pulls/618": json(pr()) });
  assert.equal((await verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl })).reason, "commit is the PR head");
  assert.equal((await verifyCommitBelongsToPr({ sha: MERGE, pr: "618", fetchImpl })).reason, "commit is the PR's merge commit");
  assert.equal((await verifyCommitBelongsToPr({ sha: MID, pr: "618", fetchImpl })).reason, "commit is one of the PR's commits");
});

test("a commit that is not part of the PR is rejected", async () => {
  const { fetchImpl } = api({ "/pulls/618/commits": json([{ sha: HEAD }]), "/pulls/618": json(pr()) });
  await rejects(verifyCommitBelongsToPr({ sha: "2".repeat(40), pr: "618", fetchImpl }));
});

test("the merge commit of a PR that is not merged is not accepted", async () => {
  const { fetchImpl } = api({ "/pulls/618/commits": json([{ sha: HEAD }]), "/pulls/618": json(pr({ merged: false })) });
  await rejects(verifyCommitBelongsToPr({ sha: MERGE, pr: "618", fetchImpl }));
});

test("a PR from a fork, a deleted head repository or another base is rejected", async () => {
  for (const over of [
    { head: { sha: HEAD, repo: { full_name: "someone/teto-pizza-game" } } },
    { head: { sha: HEAD, repo: null } },
    { base: { repo: { full_name: "someone/else" } } },
  ]) {
    const { fetchImpl } = api({ "/pulls/618": json(pr(over)) });
    await rejects(verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl }));
  }
});

test("fail closed: API errors, odd shapes and network failures reject", async () => {
  await rejects(verifyCommitBelongsToPr({ sha: HEAD, pr: "999", fetchImpl: api({}).fetchImpl })); // 404
  await rejects(verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl: api({ "/pulls/618": json({}) }).fetchImpl }));
  await rejects(verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl: api({ "/pulls/618": new Error("offline") }).fetchImpl }));
  await rejects(verifyCommitBelongsToPr({ sha: MID, pr: "618", fetchImpl: api({ "/pulls/618/commits": json({ not: "a list" }), "/pulls/618": json(pr()) }).fetchImpl }));
  await rejects(verifyCommitBelongsToPr({ sha: "abc", pr: "618", fetchImpl: api({}).fetchImpl })); // not a full SHA
});

test("smoke test (pr 0): only a commit that is already on main", async () => {
  for (const status of ["identical", "behind"]) {
    const { fetchImpl, seen } = api({ "/compare/main...": json({ status }) });
    await verifyCommitBelongsToPr({ sha: SHA, pr: "0", fetchImpl });
    assert.ok(seen[0].endsWith(`/compare/main...${SHA}`));
  }
  for (const status of ["ahead", "diverged"]) await rejects(verifyCommitBelongsToPr({ sha: SHA, pr: "0", fetchImpl: api({ "/compare/main...": json({ status }) }).fetchImpl }));
});

test("the token is sent as a bearer header only when given", async () => {
  let headers;
  const fetchImpl = async (_url, init) => ((headers = init.headers), json(pr()));
  await verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl, token: "t0k" });
  assert.equal(headers.authorization, "Bearer t0k");
  await verifyCommitBelongsToPr({ sha: HEAD, pr: "618", fetchImpl });
  assert.equal(headers.authorization, undefined);
});

test("the source tree must not carry env files (Vite would load them)", () => {
  const dir = tmp();
  put(dir, "package.json", "{}");
  put(dir, ".env.example", "VITE_FIREBASE_API_KEY=");
  const git = () => SHA;
  assert.equal(main({ env: { BRANCH: "pr-618" }, sourceDir: dir, git }), SHA);
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const d = tmp();
    put(d, name, "VITE_FIREBASE_API_KEY=x");
    assert.throws(() => main({ env: { BRANCH: "pr-618" }, sourceDir: d, git }), GuardError);
  }
});

test("the branch must be valid and not the production branch", () => {
  const dir = tmp();
  put(dir, "package.json", "{}");
  for (const BRANCH of ["production-disabled", "", undefined, "main"]) assert.throws(() => main({ env: { BRANCH }, sourceDir: dir, git: () => SHA }), GuardError);
  assert.throws(() => main({ env: { BRANCH: "pr-618" }, sourceDir: dir, git: () => "HEAD" }), GuardError);
});
