// Shared constants, validators and checks for the per-PR Cloudflare Pages preview pipeline
// (.github/workflows/deploy-pr-preview.yml). Dependency-free Node >= 20 (ESM).
//
// Nothing here talks to Cloudflare. The same checks run three times: on the dispatch inputs (validate-inputs),
// on the built tree before anyone is asked to approve (finalize), and again in the deploy job after approval (guard-deploy).
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const SOURCE_REPO = "perusonao/teto-pizza-game";
export const PROJECT_NAME = "teto-pizza-pr-preview";
/** The Cloudflare project's production branch. No deployment may ever be made to it (it would publish to <project>.pages.dev). */
export const PRODUCTION_BRANCH = "production-disabled";
export const MAX_BRANCH_LENGTH = 28;
export const MAX_LABEL_LENGTH = 16;

export const LIMITS = { files: 500, fileBytes: 20 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 };

/** What a Vite build of the game emits (measured: html, js, css, png, webp, webmanifest) plus a few ordinary static types. */
export const ALLOWED_EXTENSIONS = new Set([
  ".html", ".js", ".css", ".json", ".webmanifest", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".txt", ".woff", ".woff2", ".mp3", ".ogg", ".wav",
]);
/** Files/directories Cloudflare Pages treats specially (server-side code, routing, headers). A build may never ship them; we write _headers ourselves. */
export const RESERVED_NAMES = new Set(["_worker.js", "_routes.json", "_redirects", "_headers", "_middleware.js", "functions", "wrangler.toml", "wrangler.json", "wrangler.jsonc"]);

export const NOINDEX_META = '<meta name="robots" content="noindex, nofollow" />';
export const HEADERS_FILE = [
  "/*",
  "  X-Robots-Tag: noindex, nofollow",
  "  X-Content-Type-Options: nosniff",
  "",
  "/index.html",
  "  Cache-Control: no-cache",
  "",
  "/preview-info.json",
  "  Cache-Control: no-store",
  "",
].join("\n");

const PR_RE = /^(0|[1-9][0-9]{0,5})$/;
const LABEL_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BRANCH_RE = /^pr-(0|[1-9][0-9]{0,5})(-[a-z0-9]+(-[a-z0-9]+)*)?$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

export class GuardError extends Error {}

export function fail(message) {
  throw new GuardError(message);
}

export function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`${what} is not valid JSON: ${e.message}`);
  }
}

export function validatePrNumber(value) {
  if (typeof value !== "string" || !PR_RE.test(value)) fail(`pr_number must be digits without leading zeros (0 only for the smoke test): ${JSON.stringify(value)}`);
  return value;
}

export function validateLabel(value) {
  if (value === "" || value === undefined) return "";
  if (typeof value !== "string" || value.length > MAX_LABEL_LENGTH || !LABEL_RE.test(value)) {
    fail(`label must be [a-z0-9] words joined by single hyphens, at most ${MAX_LABEL_LENGTH} characters: ${JSON.stringify(value)}`);
  }
  return value;
}

export function validateRef(value) {
  if (typeof value !== "string" || !REF_RE.test(value) || value.includes("..") || value.endsWith("/") || value.endsWith(".lock") || value.includes("//")) {
    fail(`ref is not a plain branch, tag or commit name: ${JSON.stringify(value)}`);
  }
  return value;
}

export function validateSha(value) {
  if (typeof value !== "string" || !SHA_RE.test(value)) fail(`not a full 40-hex commit SHA: ${JSON.stringify(value)}`);
  return value;
}

export function branchName(pr, label) {
  return label ? `pr-${pr}-${label}` : `pr-${pr}`;
}

export function validateBranch(branch) {
  if (typeof branch !== "string" || branch.length > MAX_BRANCH_LENGTH || !BRANCH_RE.test(branch)) {
    fail(`branch must look like pr-<n>[-<label>] and be at most ${MAX_BRANCH_LENGTH} characters: ${JSON.stringify(branch)}`);
  }
  if (branch === PRODUCTION_BRANCH) fail(`refusing to deploy to the production branch ${PRODUCTION_BRANCH}`);
  return branch;
}

/** The dispatch inputs -> the validated values every later step uses. pr_number 0 is the smoke test and needs label "smoke". */
export function validateInputs({ ref, prNumber, label }) {
  const r = validateRef(ref);
  const pr = validatePrNumber(prNumber);
  const l = validateLabel(label);
  if (pr === "0" && l !== "smoke") fail('pr_number 0 is only for the smoke test and requires label "smoke"');
  if (pr !== "0" && l === "smoke") fail('label "smoke" is reserved for pr_number 0');
  return { ref: r, pr, label: l, branch: validateBranch(branchName(pr, l)) };
}

/** A Firebase build config in the environment would switch the game's ranking on. Previews never get one. */
export function assertNoFirebaseEnv(env) {
  const names = Object.keys(env).filter((k) => /^VITE_FIREBASE_/i.test(k) || /^FIREBASE_/i.test(k) || k === "GOOGLE_APPLICATION_CREDENTIALS");
  if (names.length > 0) fail(`Firebase/Google credentials must not be present in the preview build environment: ${names.join(", ")}`);
}

const hasEnvFileName = (name) => name === ".env" || (name.startsWith(".env.") && name !== ".env.example");

/** Vite reads .env, .env.local, .env.production ... from the project root; a source tree carrying one could switch Firebase on. */
export function findEnvFiles(sourceDir) {
  return readdirSync(sourceDir).filter(hasEnvFileName);
}

/** Every file of a built tree, relative with "/" separators. Symlinks and special files are an error (they could point outside). */
export function listTree(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const childAbs = path.join(abs, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = lstatSync(childAbs);
      if (st.isSymbolicLink()) fail(`symbolic link in the build output: ${childRel}`);
      if (st.isDirectory()) walk(childAbs, childRel);
      else if (st.isFile()) out.push({ rel: childRel, abs: childAbs, size: st.size });
      else fail(`not a regular file in the build output: ${childRel}`);
    }
  };
  walk(dir, "");
  return out;
}

export function checkAllowedFile(rel) {
  for (const segment of rel.split("/")) {
    if (RESERVED_NAMES.has(segment)) fail(`reserved Cloudflare Pages name in the build output: ${rel}`);
  }
  const ext = path.extname(rel).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) fail(`file type not allowed in a preview: ${rel}`);
}

const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt"]);
const FIREBASE_KEY_RE = /AIza[0-9A-Za-z_-]{35}/;

/** Allowlist, limits and secrets scan over a built tree. Returns the file list. */
export function checkTree(dir, { allowHeaders = false } = {}) {
  const files = listTree(dir);
  if (files.length === 0) fail("the build output is empty");
  if (files.length > LIMITS.files) fail(`too many files (${files.length} > ${LIMITS.files})`);
  let total = 0;
  for (const f of files) {
    if (!(allowHeaders && f.rel === "_headers")) checkAllowedFile(f.rel);
    if (f.size > LIMITS.fileBytes) fail(`file too large: ${f.rel} (${f.size} bytes)`);
    total += f.size;
    if (TEXT_EXTENSIONS.has(path.extname(f.rel).toLowerCase()) && FIREBASE_KEY_RE.test(readFileSync(f.abs, "utf8"))) {
      fail(`a Firebase API key (AIza...) is present in ${f.rel}`);
    }
  }
  if (total > LIMITS.totalBytes) fail(`build output too large (${total} bytes)`);
  return files;
}

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** Every published file except preview-info.json itself, with its hash: what finalize wrote, and nothing else, may be published. */
export function manifestOf(dir) {
  return listTree(dir)
    .filter((f) => f.rel !== "preview-info.json")
    .map((f) => ({ path: f.rel, bytes: f.size, sha256: sha256(readFileSync(f.abs)) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** The finished tree must be exactly what the pipeline intends to publish. */
export function checkFinalTree(dir, expect) {
  const files = checkTree(dir, { allowHeaders: true });
  const rels = new Set(files.map((f) => f.rel));
  for (const required of ["index.html", "manifest.webmanifest", "preview-info.json", "_headers"]) {
    if (!rels.has(required)) fail(`missing ${required}`);
  }
  const read = (rel) => readFileSync(path.join(dir, rel), "utf8");
  if (read("_headers") !== HEADERS_FILE) fail("_headers differs from the pipeline's own noindex/cache headers");
  const html = read("index.html");
  if (html.split(NOINDEX_META).length !== 2) fail("index.html must carry the noindex meta exactly once");
  const manifest = parseJson(read("manifest.webmanifest"), "manifest.webmanifest");
  if (manifest.start_url !== "/" || manifest.scope !== "/") fail(`manifest start_url/scope must be "/" (got ${manifest.start_url} / ${manifest.scope})`);
  const info = parseJson(read("preview-info.json"), "preview-info.json");
  if (info.schema !== 1) fail("preview-info.json schema must be 1");
  if (info.sourceRepo !== SOURCE_REPO) fail("preview-info.json sourceRepo mismatch");
  if (info.commit !== expect.sha) fail(`preview-info.json commit ${info.commit} does not match ${expect.sha}`);
  if (info.shortSha !== expect.sha.slice(0, 7)) fail("preview-info.json shortSha mismatch");
  if (String(info.pr) !== String(expect.pr)) fail("preview-info.json pr mismatch");
  if (info.branch !== expect.branch) fail("preview-info.json branch mismatch");
  if (typeof info.firebase !== "string" || !info.firebase.startsWith("disabled")) fail("preview-info.json must state that Firebase is disabled");
  // Exact membership: a file that finalize did not write (for example the shared Preview's tracked site/ left in the directory the artifact
  // was downloaded into), a missing file, or a changed file is refused.
  if (!Array.isArray(info.files) || info.files.length === 0) fail("preview-info.json has no file list");
  const actual = manifestOf(dir);
  const want = new Map(info.files.map((f) => [f.path, f]));
  if (want.size !== info.files.length) fail("preview-info.json lists a file twice");
  for (const f of actual) {
    const w = want.get(f.path);
    if (!w) fail(`file not written by finalize (not in preview-info.json): ${f.path}`);
    if (w.sha256 !== f.sha256 || w.bytes !== f.bytes) fail(`file differs from what finalize wrote: ${f.path}`);
  }
  for (const w of want.keys()) if (!actual.some((f) => f.path === w)) fail(`file listed in preview-info.json is missing: ${w}`);
  return files;
}
