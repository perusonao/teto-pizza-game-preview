// Job 2 (no secrets): turn the untrusted build output into the exact tree that may be published.
// Only this script (from this repository, not from the PR) copies files, rewrites the manifest, adds noindex and
// writes _headers and preview-info.json. Anything the build wrote beyond the allowlist fails the run before approval is asked.
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GuardError, HEADERS_FILE, NOINDEX_META, SOURCE_REPO, assertNoFirebaseEnv, checkFinalTree, checkTree, fail, parseJson, validateBranch, validateSha } from "./lib.mjs";

const CHARSET_META = /<meta charset="UTF-8"\s*\/?>/i;

export function insertNoindex(html) {
  if (html.includes(NOINDEX_META)) return html;
  const matches = html.match(new RegExp(CHARSET_META.source, "gi"));
  if (!matches || matches.length !== 1) fail("index.html must contain exactly one <meta charset=\"UTF-8\"> to place the noindex meta after");
  return html.replace(CHARSET_META, (m) => `${m}\n    ${NOINDEX_META}`);
}

export function rewriteManifest(text) {
  const manifest = parseJson(text, "manifest.webmanifest");
  if (typeof manifest.start_url !== "string" || typeof manifest.scope !== "string") fail("manifest.webmanifest has no start_url/scope");
  manifest.start_url = "/";
  manifest.scope = "/";
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** A preview was built in Preview mode with this PR/SHA: the bundle must say so (badge) and use the Preview save key. */
export function checkPreviewMarkers(dir, short) {
  const js = checkTree(dir).filter((f) => f.rel.endsWith(".js"));
  const all = js.map((f) => readFileSync(f.abs, "utf8"));
  if (!all.some((t) => t.includes("teto-pizza-preview-save-v1"))) fail("the bundle does not use the Preview save key; was it built with VITE_PREVIEW_MODE=1?");
  if (!all.some((t) => t.includes(short))) fail(`the bundle does not contain the short SHA ${short}; was it built with VITE_PREVIEW_SHA?`);
}

export function finalize({ inDir, outDir, sha, pr, label = "", branch, ref, runUrl = "", builtAt = new Date().toISOString(), env = process.env }) {
  validateSha(sha);
  validateBranch(branch);
  assertNoFirebaseEnv(env);
  const files = checkTree(inDir);
  checkPreviewMarkers(inDir, sha.slice(0, 7));
  rmSync(outDir, { recursive: true, force: true });
  for (const f of files) {
    const dest = path.join(outDir, f.rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(f.abs, dest);
  }
  const read = (rel) => readFileSync(path.join(outDir, rel), "utf8");
  const write = (rel, text) => writeFileSync(path.join(outDir, rel), text);
  write("index.html", insertNoindex(read("index.html")));
  write("manifest.webmanifest", rewriteManifest(read("manifest.webmanifest")));
  write("_headers", HEADERS_FILE);
  const info = {
    schema: 1,
    sourceRepo: SOURCE_REPO,
    ref,
    commit: sha,
    shortSha: sha.slice(0, 7),
    pr: Number(pr),
    label,
    branch,
    builtAt,
    workflowRunUrl: runUrl,
    firebase: "disabled (no VITE_FIREBASE_* at build)",
    freeFinishOptIn: "append ?freeFinish=on to the URL (Preview only; applies to that page load)",
  };
  write("preview-info.json", `${JSON.stringify(info, null, 2)}\n`);
  const result = checkFinalTree(outDir, { sha, pr, branch });
  return { info, files: result.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const e = process.env;
    const { info, files } = finalize({
      inDir: e.IN_DIR, outDir: e.OUT_DIR, sha: e.SHA, pr: e.PR, label: e.LABEL ?? "", branch: e.BRANCH, ref: e.REF, runUrl: e.RUN_URL ?? "",
    });
    console.log(`finalized ${files} files for ${info.branch} @ ${info.shortSha}`);
    if (e.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        e.GITHUB_STEP_SUMMARY,
        `### Preview build ready (not deployed)\n\n| | |\n|---|---|\n| Branch (Cloudflare) | \`${info.branch}\` |\n| Commit | \`${info.commit}\` |\n| PR | #${info.pr} |\n| Files | ${files} |\n| Firebase | disabled |\n`,
      );
    }
  } catch (err) {
    if (!(err instanceof GuardError)) throw err;
    console.error(`::error::${err.message}`);
    process.exit(1);
  }
}
