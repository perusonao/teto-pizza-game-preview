// Runtime check of a PATCHED PR page next to the shared Preview, in one browser origin.
//   ORIGIN=http://127.0.0.1:8765 SLUG=pr-494-a3d1872 PLAYWRIGHT=/path/to/playwright-core/index.mjs \
//     node tests/pr-page-runtime.mjs
// Serve a tree where /teto-pizza-game-preview/ is the assembled Pages root (site/ + pr/<slug>/).
// Needs playwright-core + a Chromium; exits non-zero on any failed assertion.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:8765";
const SLUG = process.env.SLUG ?? "pr-494-a3d1872";
// Expected badge, derived from the slug (pr-<number>-<sha7>); HV = the ?hv= seed to load (default: the Hint 5.0 "normal" seed).
const [, EXPECT_PR, EXPECT_SHA7] = /^pr-([1-9][0-9]*)-([0-9a-f]{7})$/.exec(SLUG) ?? [];
if (!EXPECT_PR) throw new Error(`bad SLUG ${SLUG}`);
const HV = process.env.HV ?? "normal";
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
check(`badge shows PR#${EXPECT_PR} and the short SHA ${EXPECT_SHA7}`, new RegExp(`PR#${EXPECT_PR}\\b`).test(badge ?? "") && (badge ?? "").includes(EXPECT_SHA7), String(badge));

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
// Since #486 `?cheeseCanvas=0` is REMEMBERED as "0" (older builds removed the key): either way only the page-scoped key changes.
check("?cheeseCanvas=0 changed only the page-scoped key (removed or remembered as 0); the shared key is intact", (!(`${CHEESE}--${SLUG}` in ls) || ls[`${CHEESE}--${SLUG}`] === "0") && ls[CHEESE] === "1");

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
violations.length = 0;

// 4d) Workers and frames are denied outright: a worker script is not governed by the creating document's CSP, and a same-origin
//     child document would not inherit this <meta> CSP, so either could relay storage around connect-src (Codex P1s on PR 2).
const wf = await page.evaluate(async (assetsHint) => {
  const out = {};
  const js = [...document.scripts].map((x) => x.src).find(Boolean) ?? assetsHint;
  // `new Worker()` does not throw when a CSP denies it (the load fails asynchronously), so "created" proves nothing: a worker only counts
  // as allowed if its script actually RUNS and posts a message back.
  const runs = (make) => new Promise((res) => {
    let w; try { w = make(); } catch { res("blocked"); return; }
    w.onmessage = () => { w.terminate(); res("ran"); }; w.onerror = () => { w.terminate(); res("blocked"); };
    setTimeout(() => { w.terminate(); res("blocked"); }, 2000);
  });
  out.blobWorker = await runs(() => new Worker(URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" }))));
  out.urlWorker = await runs(() => new Worker(js)); // the app bundle: would error (no window) if it loaded, so only the violation report below proves the CSP did it
  try { await navigator.serviceWorker.register(js); out.serviceWorker = "registered"; } catch { out.serviceWorker = "blocked"; }
  out.iframe = await new Promise((res) => {
    const f = document.createElement("iframe"); f.src = location.href; f.onload = () => { let ok = true; try { ok = !!f.contentDocument && f.contentDocument.body !== null && f.contentDocument.URL !== "about:blank"; } catch { ok = false; } f.remove(); res(ok ? "loaded" : "blocked"); }; f.onerror = () => res("blocked"); document.body.appendChild(f); setTimeout(() => res("blocked"), 3000);
  });
  return out;
}, PAGE);
check("Worker / blob Worker / service worker / iframe are all blocked by the CSP", Object.values(wf).every((v) => v === "blocked"), JSON.stringify(wf));
check("those blocks were reported as CSP violations (worker-src x2+ and frame/child-src)", violations.filter((v) => v.startsWith("worker-src")).length >= 2 && violations.some((v) => v.startsWith("frame-src") || v.startsWith("child-src")), violations.join(" | "));
violations.length = 0;

// 5) the shared Preview root still works and still sees only its own keys
const root = await ctx.newPage();
await root.goto(ORIGIN + ROOT);
await root.waitForTimeout(800);
ls = await dump(root);
for (const [k, v] of Object.entries(marks)) check(`root view unchanged: ${k}`, ls[k] === v, `now=${ls[k]}`);
const rbadge = await root.locator(".preview-badge").first().textContent().catch(() => null);
check(`shared Preview root badge is unchanged (not PR#${EXPECT_PR})`, !new RegExp(`PR#${EXPECT_PR}\\b`).test(rbadge ?? ""), String(rbadge));

// 6) no request ever left localhost (blocked attempts above never reach the network): nothing can reach Firebase / production
const unexpected = external.filter((u) => !u.includes("example.com/x")); // example.com/x = the sendBeacon probe above
check("no external request from normal use (only the deliberate probe)", unexpected.length === 0, unexpected.join(", "));

await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall runtime checks passed");
process.exit(failed ? 1 : 0);
