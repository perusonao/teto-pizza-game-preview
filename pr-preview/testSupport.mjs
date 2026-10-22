// Test helpers: a small fake "Vite output" tree.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const SHA = "83f4b55a404ace3148adbb9058f4d63c5b1a1c55";

export function tmp(prefix = "pr-preview-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function put(dir, rel, content) {
  const abs = path.join(dir, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** What a Preview-mode Vite build of the game looks like, reduced to the parts the pipeline looks at. */
export function fakeBuild(dir, { short = SHA.slice(0, 7), extra = {} } = {}) {
  put(dir, "index.html", '<!doctype html>\n<html lang="ja">\n  <head>\n    <meta charset="UTF-8" />\n    <title>t</title>\n  </head>\n  <body></body>\n</html>\n');
  put(dir, "manifest.webmanifest", JSON.stringify({ name: "t", start_url: "/teto-pizza-game/", scope: "/teto-pizza-game/", display: "standalone" }));
  put(dir, "assets/index-abc.js", `const K="teto-pizza-preview-save-v1",S="${short}";export{K,S}`);
  put(dir, "assets/index-abc.css", "body{margin:0}");
  put(dir, "icons/icon-16.png", Buffer.from([137, 80, 78, 71]));
  for (const [rel, content] of Object.entries(extra)) put(dir, rel, content);
}
