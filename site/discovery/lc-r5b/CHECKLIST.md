# iPhone checklist (Owner, iPhone only)

Prep: settings via the 「LOG/設定」 button (close the sheet before changing). Run once with **mode A**
(current 70dvh) and once with **mode B** (ceiling); mode C (visualViewport fit) is an EXPERIMENT, run last.
HUD: ◀▶ picks the step number, **SNAP** records the numbers (it does not steal focus, so it works with the
keyboard up). At the end: LOG/設定 → 「結果をコピー」 and paste it somewhere to share.
Do NOT judge PASS/FAIL yourself; the point is to record what happens.

Safari tab (H-1〜H-17), then standalone (H-18〜H-20 = repeat the important ones).

1. H-1  Open the URL in **Safari** (not Chrome). SNAP (baseline, sheet closed).
2. H-2  Tap 🧺食材庫. SNAP. (Keyboard must NOT appear; focus is on 閉じる.)
3. H-3  Tap the search field. Japanese keyboard appears. SNAP right after, and again after ~2 s.
4. H-4  Type 「たまねぎ」 (hiragana, unconverted). SNAP.
5. H-5  Tap a candidate so it shows 「玉ねぎ」 but do NOT confirm yet. SNAP. Watch: does 「該当する材料がありません」 flash?
6. H-6  Confirm the conversion. SNAP.
7. H-7  Read the result (alias ON → たまねぎ shows; also try settings alias OFF once → expect 0 rows). Also try 「卵」, 「モッツァレラチーズ」, 「ﾓｯﾂｧﾚﾗ」.
8. H-8  Tap a shelf chip (e.g. 肉). SNAP. Does the keyboard stay / does anything jump?
9. H-9  Drag the result list up/down with the keyboard up. SNAP. Does the page / sheet pan?
10. H-10 Press Enter: (a) the 検索/確定 key after typing kana (unconfirmed), (b) after confirming. Note if a confirm-Enter was treated like submit (see the log line “Enter treated as CONFIRM”).
11. H-11 Escape (only if you have a hardware keyboard): while the field is focused, and mid-conversion. Note what happens.
12. H-12 Dismiss the keyboard: try 検索キー / tapping a tile / tapping empty sheet area / scrolling / tapping the backdrop. Write down which of these closes the keyboard and which closes the sheet.
13. H-13 Close the sheet (閉じる). SNAP immediately, then again after 2 s.
14. H-14 Check where focus went (HUD “active”: should be button#entry).
15. H-15 Viewport back: vv offTop should be 0, vv height = inner height. SNAP.
16. H-16 Body not scrolled: scrollY 0 the whole time (HUD max scroll).
17. H-17 Fake stage / dock / bake bar look intact and in the same place as at H-1.
18. H-18 Share → 「ホーム画面に追加」 → open the new icon (standalone). If iOS asks, allow “Open as Web App”.
19. H-19 In standalone repeat H-2 → H-13 (at least H-3, H-5, H-6, H-9, H-12, H-13).
20. H-20 In standalone: keyboard up → close sheet → check H-15 again (offTop, sheet/stage/dock positions).

Also note: iPhone model, iOS version, Safari toolbar position (bottom/top), keyboard type, predictive bar on/off.
