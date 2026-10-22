import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { GuardError, HEADERS_FILE, NOINDEX_META, checkFinalTree } from "./lib.mjs";
import { finalize, insertNoindex, rewriteManifest } from "./finalize.mjs";
import { SHA, fakeBuild, put, tmp } from "./testSupport.mjs";

const run = (over = {}) => {
  const inDir = tmp("in-");
  const outDir = path.join(tmp("out-"), "final");
  (over.build ?? fakeBuild)(inDir, over.buildOptions);
  return { inDir, outDir, ...finalize({ inDir, outDir, sha: SHA, pr: "618", label: "", branch: "pr-618", ref: SHA, runUrl: "https://example/run/1", builtAt: "2026-10-22T00:00:00.000Z", env: {}, ...over.args }) };
};
const rejects = (over) => assert.throws(() => run(over), GuardError);

test("a Preview build is finalized: manifest at the root, noindex, headers, preview-info.json", () => {
  const { outDir, info } = run();
  const read = (rel) => readFileSync(path.join(outDir, rel), "utf8");
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(read("index.html").split(NOINDEX_META).length, 2);
  assert.equal(read("_headers"), HEADERS_FILE);
  assert.deepEqual(JSON.parse(read("preview-info.json")), info);
  const { files, ...rest } = info;
  assert.deepEqual(files.map((f) => f.path), ["_headers", "assets/index-abc.css", "assets/index-abc.js", "icons/icon-16.png", "index.html", "manifest.webmanifest"]);
  for (const f of files) assert.match(f.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(rest, {
    schema: 1,
    sourceRepo: "perusonao/teto-pizza-game",
    ref: SHA,
    commit: SHA,
    shortSha: "83f4b55",
    pr: 618,
    label: "",
    branch: "pr-618",
    builtAt: "2026-10-22T00:00:00.000Z",
    workflowRunUrl: "https://example/run/1",
    firebase: "disabled (no VITE_FIREBASE_* at build)",
    freeFinishOptIn: "append ?freeFinish=on to the URL (Preview only; applies to that page load)",
  });
  checkFinalTree(outDir, { sha: SHA, pr: "618", branch: "pr-618" });
});

test("the input tree is not modified, and noindex / manifest rewriting are idempotent", () => {
  const { inDir } = run();
  assert.ok(!readFileSync(path.join(inDir, "index.html"), "utf8").includes("noindex"));
  const once = insertNoindex(readFileSync(path.join(inDir, "index.html"), "utf8"));
  assert.equal(insertNoindex(once), once);
  const m = rewriteManifest('{"start_url":"/teto-pizza-game/","scope":"/teto-pizza-game/"}');
  assert.equal(rewriteManifest(m), m);
});

test("labelled and smoke builds carry their label and branch", () => {
  const { info } = run({ args: { pr: "0", label: "smoke", branch: "pr-0-smoke" } });
  assert.equal(info.branch, "pr-0-smoke");
  assert.equal(info.label, "smoke");
  assert.equal(info.pr, 0);
});

test("the production branch and malformed branches are refused", () => {
  rejects({ args: { branch: "production-disabled" } });
  rejects({ args: { branch: "main" } });
  rejects({ args: { sha: "83f4b55" } });
});

test("Firebase configuration in the environment is refused", () => {
  rejects({ args: { env: { VITE_FIREBASE_API_KEY: "x" } } });
});

test("a Firebase API key inside the bundle is refused", () => {
  rejects({ buildOptions: { extra: { "assets/leak.js": 'const k="AIzaSyA1234567890abcdefghijklmnopqrstuv0";' } } });
});

test("a build that is not a Preview build of this SHA is refused", () => {
  rejects({ buildOptions: { short: "deadbee" } }); // wrong short SHA inlined
  rejects({ build: (d) => { fakeBuild(d); put(d, "assets/index-abc.js", `const S="83f4b55"`); } }); // Preview save key missing
});

test("server-side code and Cloudflare special files are refused", () => {
  for (const rel of ["_worker.js", "_routes.json", "_redirects", "_headers", "_middleware.js", "functions/api.js", "assets/_worker.js/index.js", "wrangler.toml"]) {
    rejects({ buildOptions: { extra: { [rel]: "x" } } });
  }
});

test("only an allowlist of file types is published", () => {
  for (const rel of ["run.sh", "x.exe", "a.php", "a.map", "noext", "x.mjs", "x.wasm"]) rejects({ buildOptions: { extra: { [rel]: "x" } } });
  run({ buildOptions: { extra: { "assets/a.woff2": "x", "assets/b.svg": "<svg/>", "assets/_commonjsHelpers-abc.js": "x" } } }); // underscore-prefixed chunk names are fine
});

test("symbolic links in the build output are refused", () => {
  rejects({ build: (d) => { fakeBuild(d); symlinkSync("/etc/passwd", path.join(d, "assets/link.txt")); } });
});

test("an empty or incomplete build is refused", () => {
  rejects({ build: () => {} });
  rejects({ build: (d) => put(d, "assets/a.js", "x") });
  rejects({ build: (d) => { fakeBuild(d); put(d, "index.html", "<html><head></head></html>"); } }); // nowhere to put the noindex meta
  rejects({ build: (d) => { fakeBuild(d); put(d, "manifest.webmanifest", "not json"); } });
});

test("a tampered final tree fails the check that runs again before deploy", () => {
  const { outDir } = run();
  const expect = { sha: SHA, pr: "618", branch: "pr-618" };
  checkFinalTree(outDir, expect);
  const tamper = (rel, text, mutate) => {
    const file = path.join(outDir, rel);
    const before = readFileSync(file, "utf8");
    put(outDir, rel, mutate ? mutate(before) : text);
    assert.throws(() => checkFinalTree(outDir, expect), GuardError, rel);
    put(outDir, rel, before);
  };
  tamper("_headers", "/*\n  X-Robots-Tag: all\n");
  tamper("index.html", "", (h) => h.replace(NOINDEX_META, ""));
  tamper("manifest.webmanifest", "", (m) => m.replace('"scope": "/"', '"scope": "/x/"'));
  tamper("preview-info.json", "", (j) => j.replaceAll(SHA, "1".repeat(40)));
  tamper("preview-info.json", "", (j) => j.replace("disabled", "enabled"));
  tamper("assets/index-abc.js", "", (t) => `${t};//changed after finalize`); // same file name, different content
  put(outDir, "_worker.js", "export default {}");
  assert.throws(() => checkFinalTree(outDir, expect), GuardError);
  assert.ok(existsSync(path.join(outDir, "index.html")));
});

test("exact membership: a file that finalize did not write is refused, whatever its type (the shared Preview's site/ overlay)", () => {
  const { outDir } = run();
  const expect = { sha: SHA, pr: "618", branch: "pr-618" };
  put(outDir, "assets/index-CcpGotdz.js", "old shared-preview bundle"); // an allowed type, but not in the manifest
  assert.throws(() => checkFinalTree(outDir, expect), /not written by finalize/);
  rmSync(path.join(outDir, "assets/index-CcpGotdz.js"));
  put(outDir, "dm3r2-setup.html", "<html>helper page</html>");
  assert.throws(() => checkFinalTree(outDir, expect), /not written by finalize/);
  rmSync(path.join(outDir, "dm3r2-setup.html"));
  checkFinalTree(outDir, expect);
  rmSync(path.join(outDir, "assets/index-abc.css")); // a listed file that went missing
  assert.throws(() => checkFinalTree(outDir, expect), /is missing/);
});
