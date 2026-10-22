import assert from "node:assert/strict";
import { test } from "node:test";
import { GuardError, PRODUCTION_BRANCH, PROJECT_NAME, assertNoFirebaseEnv, branchName, validateBranch, validateInputs, validateLabel, validatePrNumber, validateRef, validateSha } from "./lib.mjs";

const bad = (fn) => assert.throws(fn, GuardError);

test("constants are the Owner-decided names", () => {
  assert.equal(PROJECT_NAME, "teto-pizza-pr-preview");
  assert.equal(PRODUCTION_BRANCH, "production-disabled");
});

test("pr_number: digits without leading zeros", () => {
  for (const ok of ["0", "1", "618", "999999"]) assert.equal(validatePrNumber(ok), ok);
  for (const no of ["", "01", "-1", "1e3", "618 ", "6 18", "1000000", "６１８", "618;rm", undefined, 618]) bad(() => validatePrNumber(no));
});

test("label: lowercase words joined by single hyphens, short", () => {
  for (const ok of ["", "r8hv", "r8-hv", "a1-b2-c3"]) assert.equal(validateLabel(ok), ok);
  for (const no of ["R8", "r8_hv", "-r8", "r8-", "r8--hv", "a".repeat(17), "r8 hv", "r8/hv", "../x"]) bad(() => validateLabel(no));
});

test("branch: pr-<n>[-label], at most 28 characters, never the production branch", () => {
  assert.equal(validateBranch("pr-618"), "pr-618");
  assert.equal(validateBranch("pr-618-r8hv"), "pr-618-r8hv");
  assert.equal(validateBranch(branchName("0", "smoke")), "pr-0-smoke");
  for (const no of ["production-disabled", "main", "pr-", "pr-618-", "PR-618", "pr-618-" + "a".repeat(30), "pr-0618", "pr-618/x", "preview"]) bad(() => validateBranch(no));
  assert.equal(validateBranch("pr-999999-" + "a".repeat(16)).length, 26);
});

test("ref: plain branch/tag/sha names only", () => {
  for (const ok of ["main", "83f4b55a404ace3148adbb9058f4d63c5b1a1c55", "claude/issue-617-finish-r8-x2qavm", "v1.2.3"]) assert.equal(validateRef(ok), ok);
  for (const no of ["", "-x", "--upload-pack=x", "a..b", "a b", "a;b", "a$(b)", "a`b`", "x\ny", "refs//x", "x/", "x.lock", "a".repeat(101)]) bad(() => validateRef(no));
});

test("sha: exactly 40 lowercase hex", () => {
  validateSha("83f4b55a404ace3148adbb9058f4d63c5b1a1c55");
  for (const no of ["83f4b55", "83F4B55A404ACE3148ADBB9058F4D63C5B1A1C55", "g".repeat(40), ""]) bad(() => validateSha(no));
});

test("inputs: pr_number 0 is the smoke test and only with label smoke", () => {
  assert.deepEqual(validateInputs({ ref: "main", prNumber: "0", label: "smoke" }), { ref: "main", pr: "0", label: "smoke", branch: "pr-0-smoke" });
  bad(() => validateInputs({ ref: "main", prNumber: "0", label: "" }));
  bad(() => validateInputs({ ref: "main", prNumber: "618", label: "smoke" }));
  assert.equal(validateInputs({ ref: "83f4b55a404ace3148adbb9058f4d63c5b1a1c55", prNumber: "618", label: "" }).branch, "pr-618");
});

test("no Firebase / Google credentials in the build environment", () => {
  assertNoFirebaseEnv({ PATH: "/bin", VITE_PREVIEW_MODE: "1" });
  for (const name of ["VITE_FIREBASE_API_KEY", "vite_firebase_project_id", "FIREBASE_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS"]) bad(() => assertNoFirebaseEnv({ [name]: "x" }));
});
