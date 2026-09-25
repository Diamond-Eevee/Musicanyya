# Implementation log: 008-pressed-keys-on-score

## 2026-09-25 - claude-opus-5.5 (analyze)
- Analyze: 14 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 7); tasks.md as of 102424b
- Top recommendations: (A1) give `skipped` a shape, since grey vs green heads behind the cursor differ by colour only (FR-010); (A2) say when green marks clear on a loop/repeat (the matcher clears each note as the cursor reaches it again) and test it; (A3-A4) add zoom/reflow and Electron checks for FR-013/FR-015; (A5) record canvas-drawn ledger lines/ottava labels in plan Complexity Tracking (Constitution III)
- Handoff: next = resolve A1 (needs owner: skipped mark shape), then /speckit.implement from T001; no code changed
- Remediation (owner: "answer all with recommended"): A1 skipped = grey head + right-pointing skip chevron (spec FR-009/FR-010, R-03, contract `drawStateChevron`, T050/T052/T053/T054); A2 FR-012 = marks clear note by note as the session reaches them again (existing matcher behaviour), tested in T014(h); A3 zoom checks in T014(g)/T032; A4 new T066 Electron e2e; A5 plan Complexity Tracking row for canvas ledger lines/ottava labels; A6 new static test T057; A7 `harvestGlyphs` in `src/workers/glyphs.ts` (T030/T038); A8/A12 FR-011 and 10-key frame-time assertions in T032; A9 contract aligned; A10 staff found via `closest('g.staff')` (R-05); A11 chevrons relative to the notehead box; A13 README in T004; A14 owner confirmed shift-aside (FR-006). Now 53 tasks.
- Handoff: next = /speckit.implement from T001; no code changed
