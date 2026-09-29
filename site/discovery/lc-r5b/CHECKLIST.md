# LC-R5-b Real-Device Discovery — Owner checklist (iPhone only)

Claude cannot start or stop the recording. **You** do: 画面収録開始 → 指定操作 → 画面収録停止 → 動画を保存/共有.
Do NOT judge PASS/FAIL yourself. The point is to record what happens. Mode C is an EXPERIMENT, not a chosen design.

## 0. One-time setup

- Add 「画面収録」 to Control Center: 設定 → コントロールセンター → 画面収録 (＋).
- Start recording: swipe to open Control Center → tap ⏺ (3-2-1) → swipe Control Center away. Stop: tap the red status pill/clock → 停止, or ⏺ again. The video lands in 写真.
- Turn on Do Not Disturb (通知が映らないように). Keep the microphone OFF (long-press ⏺ → マイク OFF).
- Metadata: in the harness, 「LOG/設定」 → **Owner metadata** and fill in every field (they go into the JSON):
  iPhone model / iOS version / Safari toolbar position (下 / 上(コンパクト) / 標準) / Japanese keyboard type (かな・ローマ字・フリック…) / predictive conversion ON or OFF / メモ.
  Also say them out loud or type them into the メモ so they are in the video too.

## 1. Modes (do A first; B second; C only after A and B are done)

Settings: 「LOG/設定」 → 設定 (close the sheet first). At the start of each mode, tap **設定表示** and hold still for ~5 s so the video shows the banner (MODE, alias, IME凍結, strip, Enter→blur, focus復帰, inner / vv size).

| Mode | sheet height | Notes |
|---|---|---|
| A | current 70dvh | default. alias ON, IME凍結 OFF, strip なし, Enter→blur ON, focus() 既定 |
| B | ceiling (100dvh − safe-top − 20px) | change only "sheet高さ" → B |
| C | B + visualViewport fit (EXPERIMENT) | only after A and B are recorded. Not adopted; data only |

One Safari video per mode is fine; if too long, cut at natural points (each ≤ ~3 min).

## VIDEO A — Safari (H-1〜H-17)  → file: `safari-modeA.mov` (…modeB / …modeC)

1. Start recording. Open the harness URL in **Safari** (the address must be visible at the start). Do not use Chrome / an in-app browser.
2. Tap **設定表示** (hold 5 s). Tap **SNAP** (baseline, sheet closed) — H-1.
3. Tap ▶ to step to H-2. Tap 🧺食材庫. The keyboard must NOT appear. **SNAP** — H-2.
4. ▶ H-3. Tap the search field. Japanese keyboard appears. **SNAP** immediately, and **SNAP** again after ~2 s.
5. ▶ H-4. Type 「たまねぎ」 (hiragana, unconverted, leave it underlined). **SNAP**.
6. ▶ H-5. Tap the candidate 「玉ねぎ」 so it is selected but NOT confirmed. **SNAP**. (Watch for a flash of 「該当する材料がありません」.)
7. ▶ H-6. Confirm the conversion. **SNAP**.
8. ▶ H-7. Read the result. Then search 「卵」 → **SNAP**; search 「モッツァレラチーズ」 → **SNAP**; search 「ﾓｯﾂｧﾚﾗ」 (half-width) → **SNAP**. Clear with ✕ (keyboard should stay).
9. ▶ H-8. Tap a shelf chip (e.g. 肉). Does the keyboard stay? Does anything jump? **SNAP**.
10. ▶ H-9. With the keyboard up, drag the result list up and down. **SNAP** while scrolled. Watch whether the page/sheet pans.
11. ▶ H-10. Enter: (a) type kana and press the 検索/確定 key **before** confirming; (b) after confirming, press it again. **SNAP** each time. Note if the log shows “Enter treated as CONFIRM”.
12. ▶ H-11. Escape: only with a hardware keyboard — while focused, and mid-conversion. Otherwise say “Escape 未実施” in the メモ.
13. ▶ H-12. Dismiss the keyboard. Try, one by one, and say out loud what happens: 検索キー / tap a tile / tap empty sheet area / scroll the list / tap the dark backdrop (this may close the sheet). **SNAP** after each.
14. ▶ H-13. Close the sheet (閉じる). **SNAP** immediately; **SNAP** again after ~2 s.
15. ▶ H-14. Look at the HUD “active” (expect button#entry). **SNAP**.
16. ▶ H-15. Check viewport return: vv offTop should be 0 and vv height = inner height. **SNAP**.
17. ▶ H-16. Check body scroll: HUD “max scroll” / scrollY. **SNAP**.
18. ▶ H-17. Check the fake stage / dock / bake bar are intact and where they were at H-1. **SNAP**.
19. Open 「LOG/設定」 → **JSON保存** (Files/共有シートで保存) or **結果をコピー**. Keep the panel visible for 2 s in the video. Stop recording.
20. Save/share the video (写真 → 共有 → ファイルに保存 / AirDrop / メッセージ など).

## VIDEO B — Standalone / Home Screen (H-18〜H-20)  → file: `standalone-modeA.mov`

1. Start recording in Safari on the harness page. Tap Share → **ホーム画面に追加** → 追加. (If iOS offers “Webアプリとして開く”, keep it ON.) Show the Home Screen icon.
2. Tap the new Home Screen icon (standalone launch — no Safari bars). Tap **設定表示** (hold 5 s: the banner must say **STANDALONE**). **SNAP** baseline — H-18.
3. ▶ H-19. 🧺食材庫 → tap search → keyboard up. **SNAP**. Type 「たまねぎ」 → convert to 「玉ねぎ」 (unconfirmed) → **SNAP** → confirm → **SNAP**. Scroll the list with the keyboard up → **SNAP**. Dismiss the keyboard (say how). **SNAP**. Close the sheet → **SNAP** immediately and after ~2 s.
4. ▶ H-20. Check viewport return (offTop 0, vv height = inner height) and stage/dock. **SNAP**.
5. 「LOG/設定」 → **JSON保存** (or **結果をコピー**). Stop recording, save/share the video.

If time allows, repeat VIDEO B with mode B (set in Safari first, then relaunch the icon; settings persist).

## Evidence package (upload to the ChatGPT thread)

1. Safari screen recording(s): `safari-modeA.mov` (+ `safari-modeB.mov`, `safari-modeC.mov` if done)
2. Standalone screen recording: `standalone-modeA.mov` (+ modeB)
3. Safari Discovery JSON: `lc-r5b-discovery-safari-modeA.json` (or the text from 「結果をコピー」 pasted into a .txt)
4. Standalone Discovery JSON: `lc-r5b-discovery-standalone-modeA.json` (or copied text)
5. Optional screenshots of any surprising state (keyboard covering the search, header off-screen…).

JSON note: iOS may not allow a direct file save. **JSON保存** opens the share sheet (ファイルに保存 / AirDrop / メール). If nothing saves, use **結果をコピー**, paste into Notes/Files as a text file, and upload that. The JSON already contains the owner metadata, all SNAPs, and the last 250 events.

## Owner metadata checklist (fill before stopping each recording)

- [ ] iPhone model
- [ ] iOS version
- [ ] Safari (not Chrome) / standalone (Home Screen)
- [ ] Safari toolbar position (下 / 上(コンパクト) / 標準)
- [ ] Japanese keyboard type (かな / ローマ字 / フリック …)
- [ ] Predictive conversion ON / OFF
- [ ] Test mode A / B / C (banner visible in the video)
- [ ] Hardware keyboard used? (Escape / PageDown tests)
- [ ] Anything unexpected (free text in メモ)
