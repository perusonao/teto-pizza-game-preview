// Runtime check of a PATCHED PR page next to the shared Preview, in one browser origin.
//   ORIGIN=http://127.0.0.1:8765 SLUG=pr-494-a3d1872 PLAYWRIGHT=/path/to/playwright-core/index.mjs \
//     node tests/pr-page-runtime.mjs
// SERVE_ROOT=<dir that ORIGIN serves as "/"> is REQUIRED (the worker / service-worker probes write real fixture scripts next to the page).
// Optional: HV=<scenario> (default "normal"; e.g. b19-pesto-burrata), PR_NUMBER (default 494), SHA7 (default a3d1872) -- the page the
// slug names, so a source_sha add-on page (slug pr-<N>-<source sha7>) is checked against ITS badge.
// Serve a tree where /teto-pizza-game-preview/ is the assembled Pages root (site/ + pr/<slug>/).
// Needs playwright-core + a Chromium; exits non-zero on any failed assertion.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:8765";
const SLUG = process.env.SLUG ?? "pr-494-a3d1872";
const HV = process.env.HV ?? "normal";
const PR_NUMBER = process.env.PR_NUMBER ?? "494";
const SHA7 = process.env.SHA7 ?? "a3d1872";
const ROOT = "/teto-pizza-game-preview/";
const PAGE = `${ROOT}pr/${SLUG}/`;
const SAVE = "teto-pizza-preview-save-v1";
const PROD = "teto-pizza-save-v1";
const CHEESE = "teto-pizza-cheese-canvas";
const HINT5 = "teto-pizza-preview-hint5-optin";
const DEV = "teto.dev.researchIdentify";

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} - ${name}${ok ? "" : ` ${extra}`}`);
  if (!ok) failed++;
};

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const external = [];
ctx.on("request", (r) => {
  const u = new URL(r.url());
  if (!["127.0.0.1", "localhost"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.method() + " " + r.url());
});
const dump = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));

// 1) mark every key the shared Preview / production could own
const shared = await ctx.newPage();
await shared.goto(ORIGIN + ROOT);
const marks = { [SAVE]: '{"mark":"SHARED-PREVIEW-SAVE"}', [PROD]: '{"mark":"PRODUCTION-SAVE"}', [CHEESE]: "1", [HINT5]: "1", [DEV]: "0" };
await shared.evaluate((m) => Object.entries(m).forEach(([k, v]) => localStorage.setItem(k, v)), marks);
await shared.close();

// 2) PR page, fresh navigation with the HV seed: the app itself persists a real save
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${ORIGIN}${PAGE}?hv=${HV}`);
await page.waitForTimeout(1500);
let ls = await dump(page);
const own = `${SAVE}--${SLUG}`;
check("PR page wrote its own save key", own in ls, JSON.stringify(Object.keys(ls)));
let seeded = null;
try { seeded = JSON.parse(ls[own] ?? "null"); } catch { /* checked below */ }
check("that save is a real game save (not the sentinel)", !!seeded && seeded.mark === undefined && JSON.stringify(seeded).length > 100);
for (const [k, v] of Object.entries(marks)) check(`untouched: ${k}`, ls[k] === v, `now=${ls[k]}`);
check("PR page did not read the shared cheese opt-in", !(`${CHEESE}--${SLUG}` in ls));
check("no page errors", errors.length === 0, errors.join(" | "));
const badge = await page.locator(".preview-badge").first().textContent().catch(() => null);
check(`badge shows PR#${PR_NUMBER} and the short SHA`, new RegExp(`PR#${PR_NUMBER}`).test(badge ?? "") && badge.includes(SHA7), String(badge));

// 3) it really is the page's persistence: change state through the UI, reload, still there
const before = ls[own];
await page.reload();
await page.waitForTimeout(1000);
ls = await dump(page);
check("reload (no re-seed) keeps the page's own save", ls[own] === before);
const pitz = await page.getByText(/Pitz/).first().textContent().catch(() => "");
console.log("      home text:", (pitz ?? "").replace(/\s+/g, " ").trim());

// 4) opt-in query parameters land in the page's namespace only
await page.goto(`${ORIGIN}${PAGE}?cheeseCanvas=1`);
await page.waitForTimeout(800);
ls = await dump(page);
check("?cheeseCanvas=1 wrote the page-scoped key", ls[`${CHEESE}--${SLUG}`] === "1");
check("shared cheese key unchanged", ls[CHEESE] === "1");
await page.goto(`${ORIGIN}${PAGE}?cheeseCanvas=0`);
await page.waitForTimeout(800);
ls = await dump(page);
// (Since the source made Canvas the default, `?cheeseCanvas=0` REMEMBERS "0" in the key instead of removing it: assert the page-scoped value moved and the shared one did not.)
check("?cheeseCanvas=0 changed only the page-scoped key (shared key still \"1\")", ls[`${CHEESE}--${SLUG}`] === "0" && ls[CHEESE] === "1", `page=${ls[`${CHEESE}--${SLUG}`]} shared=${ls[CHEESE]}`);

// 4b) the CSP: nothing breaks on the main screens, and the BROWSER (not just the absence of a config) blocks
//     any request to another origin -- Firebase, production endpoints, anything.
const violations = [];
await page.exposeFunction("__csp", (d) => violations.push(d));
await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => window.__csp(`${e.violatedDirective} ${e.blockedURI}`)));
await page.goto(`${ORIGIN}${PAGE}`);
await page.waitForTimeout(800);
const tourErrors = [];
page.on("pageerror", (e) => tourErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) tourErrors.push(m.text()); });
for (const label of [/ピザを作る/, /ショップ/, /ピザ図鑑/, /材料/, /レシピ発見/, /ランチラッシュ/]) {
  await page.getByRole("button", { name: label }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${process.env.SHOTS ?? "/tmp"}/tour-${String(label.source).replace(/\W/g, "")}.png` }).catch(() => {});
  const back = page.getByRole("button", { name: /ホーム/ }).first();
  if (await back.count()) await back.click({ timeout: 2000 }).catch(() => {});
  else await page.goto(`${ORIGIN}${PAGE}`);
  await page.waitForTimeout(300);
}
check("main screens render with the CSP: no violation", violations.length === 0, violations.join(" | "));
check("main screens render with the CSP: no page error", tourErrors.length === 0, tourErrors.join(" | "));
// 4c) real play on the page: Margherita -> dough -> SAUCE, paint with the pointer, watch the gauge drain.
//     Runs under the CSP, writes only the page-scoped save key, makes no external request.
{
  await page.goto(`${ORIGIN}${PAGE}`);
  await page.getByRole("button", { name: /ピザを作る/ }).first().click();
  await page.getByRole("button", { name: /マルゲリータ/ }).first().click();
  await page.getByRole("button", { name: /このピザを作る/ }).first().click();
  await page.waitForTimeout(900);
  const dough = await page.locator(".pizza-dough--interactive").boundingBox();
  const cx = dough.x + dough.width / 2, cy = dough.y + dough.height / 2, r = dough.width * 0.46;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(150);
  }
  await page.getByRole("button", { name: /次へ/ }).first().click();
  await page.waitForTimeout(800);
  const gauge = page.locator("[aria-valuenow]").first();
  const start = Number(await gauge.getAttribute("aria-valuenow"));
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(1200);
  const painting = Number(await gauge.getAttribute("aria-valuenow"));
  await page.mouse.up(); await page.waitForTimeout(300);
  const released = Number(await gauge.getAttribute("aria-valuenow"));
  console.log(`      sauce gauge: start ${start} -> painting ${painting} -> released ${released}`);
  check("SAUCE gauge starts full and drains while painting", start === 100 && painting < 100 && released <= painting + 8 && released < 100, `${start}/${painting}/${released}`);
  ls = await dump(page);
  check("real play touched only the page-scoped save key (shared + production keys intact)",
    Object.entries(marks).every(([k, v]) => ls[k] === v) && !!ls[`${SAVE}--${SLUG}`]);
}

const probes = await page.evaluate(async () => {
  const out = {};
  for (const [name, url] of [["firestore", "https://firestore.googleapis.com/google.firestore.v1.Firestore/Write"], ["production-origin", "https://perusonao.github.io/teto-pizza-game/"], ["example", "https://example.com/x"]]) {
    out[name] = await fetch(url, { mode: "no-cors" }).then(() => "sent", () => "blocked");
  }
  // sendBeacon is NOT stopped by connect-src in Chromium (reported below, not asserted): the CSP is a layer, not a wall
  out.beacon = navigator.sendBeacon("https://example.com/x", "x") ? "queued" : "blocked";
  out.xhr = await new Promise((res) => { const x = new XMLHttpRequest(); x.onerror = () => res("blocked"); x.onload = () => res("sent"); try { x.open("POST", "https://example.com/x"); x.send("x"); } catch { res("blocked"); } });
  return out;
});
const { beacon, ...asserted } = probes;
console.log(`      known gap (documented): navigator.sendBeacon -> ${beacon}`);
check("fetch / XHR to Firestore, the production origin or any other origin is blocked by the browser", Object.values(asserted).every((v) => v === "blocked"), JSON.stringify(asserted));
check("the blocks were reported as CSP connect-src violations", violations.filter((v) => v.startsWith("connect-src")).length >= 3, violations.join(" | "));
// 4d) Codex P1 x2 on PR #2 (+ P2 on the probe itself): a Worker (a Service Worker included) and a framed same-origin document are NOT governed by this page's <meta>
//     CSP, so the page may create neither. The probes use REAL, working same-origin scripts (so a 404 can never pass for "blocked") and a control from a page WITHOUT the
//     CSP (the shared Preview root) proves the very same script URLs do start when nothing forbids them. SERVE_ROOT = the directory that ORIGIN serves as "/" (the fixtures
//     are written next to the page; they are not part of any build).
{
  const fs = await import("node:fs");
  const SERVE_ROOT = process.env.SERVE_ROOT;
  check("SERVE_ROOT is set (the worker / service-worker probes need real fixture scripts)", !!SERVE_ROOT && fs.existsSync(`${SERVE_ROOT}${PAGE}index.html`), String(SERVE_ROOT));
  const WORKER_URL = `${PAGE}__probe-worker.js`, SW_URL = `${PAGE}__probe-sw.js`;
  if (SERVE_ROOT) {
    fs.writeFileSync(`${SERVE_ROOT}${WORKER_URL}`, 'postMessage("up");\n');
    fs.writeFileSync(`${SERVE_ROOT}${SW_URL}`, 'self.addEventListener("install", () => self.skipWaiting());\n');
  }
  // one function for the page and the control: resolves "started" only if the worker really ran and posted, "blocked" on an error event
  const probes = async ([workerUrl, swUrl]) => {
    const out = {};
    const probe = (mk) => new Promise((res) => {
      try { const w = mk(); w.onerror = () => res("blocked"); w.onmessage = (e) => res(e.data === "up" ? "started" : "message?"); setTimeout(() => res("no-signal"), 1500); } catch { res("blocked"); }
    });
    out.worker = await probe(() => new Worker(workerUrl));
    out.blobWorker = await probe(() => new Worker(URL.createObjectURL(new Blob(['postMessage("up")']))));
    try { await navigator.serviceWorker.register(swUrl, { scope: new URL(".", swUrl).pathname }); out.sw = "registered"; } catch { out.sw = "blocked"; }
    return out;
  };
  // control: the shared Preview root has no CSP, so the fixtures must start there
  const ctl = await ctx.newPage();
  await ctl.goto(ORIGIN + ROOT);
  const control = await ctl.evaluate(probes, [`${ORIGIN}${WORKER_URL}`, `${ORIGIN}${SW_URL}`]).catch((e) => ({ error: String(e) }));
  await ctl.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); }).catch(() => {});
  await ctl.close();
  check("control: the real fixture Worker, a blob Worker and the fixture Service Worker DO start on a page without the CSP (the probe can tell)", control.worker === "started" && control.blobWorker === "started" && control.sw === "registered", JSON.stringify(control));

  const before = violations.length;
  const wp = await page.evaluate(probes, [`${ORIGIN}${WORKER_URL}`, `${ORIGIN}${SW_URL}`]);
  await page.evaluate(() => { const f = document.createElement("iframe"); f.src = location.pathname; document.body.appendChild(f); });
  await page.waitForTimeout(800);
  const fresh = violations.slice(before);
  const kinds = fresh.map((v) => v.split(" ")[0]);
  check("the page cannot start a real same-origin Worker, nor a blob Worker", wp.worker === "blocked" && wp.blobWorker === "blocked", JSON.stringify(wp));
  check("the page cannot register a real same-origin Service Worker", wp.sw === "blocked", JSON.stringify(wp));
  check("the browser reported a worker-src violation FOR the real fixture script and a frame-src violation", fresh.some((v) => v.startsWith("worker-src") && v.includes("__probe-worker.js")) && kinds.includes("frame-src"), fresh.join(" | "));
  const sws = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  check("no Service Worker registration exists for this origin after the probe", sws === 0, String(sws));
  if (SERVE_ROOT) { fs.rmSync(`${SERVE_ROOT}${WORKER_URL}`, { force: true }); fs.rmSync(`${SERVE_ROOT}${SW_URL}`, { force: true }); }
}
violations.length = 0;

// 5) the shared Preview root still works and still sees only its own keys
const root = await ctx.newPage();
await root.goto(ORIGIN + ROOT);
await root.waitForTimeout(800);
ls = await dump(root);
for (const [k, v] of Object.entries(marks)) check(`root view unchanged: ${k}`, ls[k] === v, `now=${ls[k]}`);
const rbadge = await root.locator(".preview-badge").first().textContent().catch(() => null);
check(`shared Preview root badge is unchanged (not PR#${PR_NUMBER})`, !new RegExp(`PR#${PR_NUMBER}`).test(rbadge ?? ""), String(rbadge));

// 6) no request ever left localhost (blocked attempts above never reach the network): nothing can reach Firebase / production
const unexpected = external.filter((u) => !u.includes("example.com/x")); // example.com/x = the sendBeacon probe above
check("no external request from normal use (only the deliberate probe)", unexpected.length === 0, unexpected.join(", "));

await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall runtime checks passed");
process.exit(failed ? 1 : 0);
