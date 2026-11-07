// Static checks of .github/workflows/deploy-pr-preview.yml (text-based; no YAML dependency).
// They pin the safety properties the Owner relies on: who can trigger it, which job can see secrets, what may reach Cloudflare.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRODUCTION_BRANCH, PROJECT_NAME } from "./lib.mjs";

const root = new URL("../", import.meta.url);
const text = readFileSync(new URL(".github/workflows/deploy-pr-preview.yml", root), "utf8");
const lines = text.split("\n");
const code = lines.filter((l) => !l.trim().startsWith("#")).join("\n");

/** { build: "...", finalize: "...", deploy: "..." } by the two-space-indented job keys under `jobs:`. */
function jobs() {
  const start = lines.findIndex((l) => l === "jobs:");
  const out = {};
  let name = null;
  for (const line of lines.slice(start + 1)) {
    const m = /^ {2}([a-z]+):\s*$/.exec(line);
    if (m) { name = m[1]; out[name] = []; } else if (name) out[name].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n")]));
}
const J = jobs();

test("three jobs: build, finalize, deploy", () => {
  assert.deepEqual(Object.keys(J), ["build", "finalize", "deploy"]);
});

test("triggered by workflow_dispatch only", () => {
  assert.match(code, /^on:\n {2}workflow_dispatch:/m);
  for (const trigger of ["pull_request", "pull_request_target", "workflow_run", "issue_comment", "schedule", "push:", "repository_dispatch", "workflow_call"]) {
    assert.ok(!new RegExp(`^ {2}${trigger}`, "m").test(code), `${trigger} must not be a trigger`);
  }
});

test("deploy input defaults to false", () => {
  assert.match(code, /deploy:\n\s+description:[^\n]*\n\s+required: false\n\s+default: false\n\s+type: boolean/);
});

test("no permissions by default; every job asks only for contents: read", () => {
  assert.match(code, /^permissions: \{\}$/m);
  for (const [name, body] of Object.entries(J)) {
    assert.match(body, /\n {4}permissions:\n {6}contents: read\n/, `${name}: permissions`);
    assert.ok(!/(write|id-token)/.test(body.match(/\n {4}permissions:\n(?: {6}[^\n]+\n)+/)[0]), `${name}: no write / id-token`);
  }
});

test("Cloudflare secrets appear only in the deploy job", () => {
  assert.ok(!/secrets\./.test(J.build), "build must have no secrets");
  assert.ok(!/secrets\./.test(J.finalize), "finalize must have no secrets");
  const used = [...J.deploy.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const name of used) assert.ok(["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].includes(name), name);
  assert.ok(!/secrets:\s*inherit/.test(code));
  assert.ok(!/(CLOUDFLARE_|CF_API)/.test(J.build + J.finalize), "no Cloudflare variables before the approval");
});

test("the build job sees only the read-only GITHUB_TOKEN, in one verification step", () => {
  const tokens = [...J.build.matchAll(/github\.token|GITHUB_TOKEN/g)];
  assert.equal(tokens.length, 1);
  assert.match(J.build, /name: Verify the commit[\s\S]*GH_TOKEN: \$\{\{ github\.token \}\}[\s\S]*verify-source\.mjs/);
});

test("no Firebase configuration anywhere in the workflow", () => {
  assert.ok(!/FIREBASE/.test(code));
  assert.ok(!/GOOGLE_APPLICATION/.test(code));
});

test("the deploy job needs the Environment, main, the preview repository and the explicit deploy input", () => {
  assert.match(J.deploy, /environment:\n\s+name: cloudflare-preview\n/);
  assert.match(J.deploy, /\n {4}if: .*inputs\.deploy == true.*github\.ref == 'refs\/heads\/main'.*github\.repository == 'perusonao\/teto-pizza-game-preview'/);
  assert.match(J.deploy, /needs: \[build, finalize\]/);
  assert.ok(!/environment:/.test(J.build + J.finalize));
});

test("the deploy job never checks out or runs the PR's source", () => {
  assert.ok(!/repository: perusonao\/teto-pizza-game\n/.test(J.deploy));
  assert.ok(!/npm ci(?! --ignore-scripts)/.test(J.deploy));
  assert.ok(!/npx vite|npm run/.test(J.deploy));
});

test("every action is pinned to a full commit SHA", () => {
  const uses = [...code.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 8);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, u);
});

test("checkouts do not persist credentials", () => {
  const checkouts = code.split("actions/checkout@").slice(1);
  assert.equal(checkouts.length, 4);
  for (const c of checkouts) assert.match(c.slice(0, 400), /persist-credentials: false/);
});

test("untrusted values never reach a shell line through ${{ }}", () => {
  // Inputs, outputs and the like are passed through env: in every `run:` block. Only a few fixed, non-user values may be interpolated.
  const blocks = [];
  lines.forEach((line, i) => {
    const m = /^(\s*)run:\s*(\|)?\s*(.*)$/.exec(line);
    if (!m) return;
    const body = [m[3]];
    if (m[2]) for (let j = i + 1; j < lines.length && (lines[j].trim() === "" || lines[j].startsWith(`${m[1]}  `)); j++) body.push(lines[j]);
    blocks.push(body.join("\n"));
  });
  assert.ok(blocks.length >= 6);
  for (const b of blocks) assert.ok(!/\$\{\{/.test(b), `run block interpolates an expression:\n${b}`);
});

test("wrangler is pinned, installed from the lockfile without scripts, and run from its own clean directory", () => {
  const pkg = JSON.parse(readFileSync(new URL("pr-preview/wrangler/package.json", root), "utf8"));
  const version = pkg.dependencies.wrangler;
  assert.match(version, /^\d+\.\d+\.\d+$/, "exact version, no range");
  const lock = JSON.parse(readFileSync(new URL("pr-preview/wrangler/package-lock.json", root), "utf8"));
  assert.equal(lock.packages["node_modules/wrangler"].version, version);
  assert.match(lock.packages["node_modules/wrangler"].integrity, /^sha512-/);
  assert.match(J.deploy, /working-directory: pr-preview\/wrangler\n\s+run: npm ci --ignore-scripts/);
  assert.ok(!/npx wrangler|wrangler@/.test(code), "no unpinned wrangler");
  assert.match(J.deploy, /\.\/node_modules\/\.bin\/wrangler pages deploy "\$GITHUB_WORKSPACE\/finalized-site"/);
  assert.match(J.deploy, /name: Deploy \(Direct Upload\)\n\s+id: wrangler\n\s+working-directory: pr-preview\/wrangler/);
});

test("project and branch come from the guard step, never from the inputs", () => {
  assert.match(J.deploy, /--project-name "\$CF_PROJECT"/);
  assert.match(J.deploy, /--branch "\$CF_BRANCH"/);
  assert.match(J.deploy, /CF_PROJECT: \$\{\{ steps\.guard\.outputs\.project \}\}/);
  assert.match(J.deploy, /CF_BRANCH: \$\{\{ steps\.guard\.outputs\.branch \}\}/);
  assert.ok(!/inputs\./.test(J.deploy.replace(/inputs\.deploy/g, "")), "deploy job must not read dispatch inputs");
  assert.ok(!code.includes(PROJECT_NAME) && !code.includes(PRODUCTION_BRANCH), "the fixed names live only in lib.mjs");
  assert.match(J.deploy, /--commit-hash "\$SHA"/);
});

test("the shared Preview's files are not referenced", () => {
  const bare = code.replace(/\s+#.*$/gm, "").replace(/finalized-site/g, "");
  assert.ok(!/\bsite\b/.test(bare), "no use of the shared Preview's site/ directory");
  assert.ok(!/git (push|commit)/.test(code), "this workflow commits nothing");
  assert.ok(!/pages\.yml|deploy-from-source/.test(code));
});

test("the finalized artifact is downloaded into an empty directory, never into a tracked one (shared Preview's site/)", () => {
  const download = J.deploy.match(/actions\/download-artifact@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+name: pr-preview-final-[^\n]+\n\s+path: (\S+)/);
  assert.ok(download, "deploy job downloads the finalized artifact");
  const dir = download[1];
  for (const tracked of ["site", "pr-preview", ".github", "."]) assert.notEqual(dir, tracked);
  assert.match(J.deploy, new RegExp(`SITE_DIR: ${dir}\\n`));
  assert.ok(J.deploy.includes(`wrangler pages deploy "$GITHUB_WORKSPACE/${dir}"`), "Wrangler publishes the same directory the guard checked");
  // no step anywhere downloads into, uploads from, or deploys the tracked site/ directory
  assert.ok(!/path: site\s*(#.*)?\n/.test(code));
  assert.ok(!/GITHUB_WORKSPACE\/site\b/.test(code));
});
