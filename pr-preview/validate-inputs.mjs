// Step 1 of the build job: validate the workflow_dispatch inputs before anything is checked out or run.
// Inputs arrive through env (never interpolated into a shell line).
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GuardError, validateInputs } from "./lib.mjs";

export function main(env = process.env) {
  const v = validateInputs({ ref: env.INPUT_REF, prNumber: env.INPUT_PR_NUMBER, label: env.INPUT_LABEL ?? "" });
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `ref=${v.ref}\npr=${v.pr}\nlabel=${v.label}\nbranch=${v.branch}\n`);
  return v;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const v = main();
    console.log(`inputs ok: ref=${v.ref} pr=${v.pr} label=${v.label || "(none)"} branch=${v.branch}`);
  } catch (e) {
    if (!(e instanceof GuardError)) throw e;
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
