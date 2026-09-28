# Implementation Log: See the Next System While Playing (015)

## 2026-09-28 22:14 - claude-opus-5-5 (analyze)
- Analyze: 14 findings (CRITICAL 0, HIGH 2, MEDIUM 6, LOW 6); tasks.md as of b5d04e9; requirement coverage 23/24 (FR-008 has no task).
- Top recommendations: (1) glide redirects restart the full 400 ms, so a distant jump to an unmounted page (estimate, then redirect) can exceed FR-009's bound - keep the original end time on redirect (follow-view.md 3.2, research R-6/R-7, T017/T019); (2) the work sits on branch claude/wonderful-curie-ajrosv, which status.ps1/check-prerequisites.ps1 do not recognise - use a 015-next-system-lookahead branch or set SPECIFY_FEATURE=015-next-system-lookahead; (3) align FR-001 "not under a notice" with the design's clear space (notices not subtracted) and add an FR-008 assertion to T019.
- Model fit: analyze (deep) run by claude-opus-5-5, which fits.
- Note: this file was created by analyze; T002 appends its baseline entry here instead of creating the file.
- Handoff: next = resolve HIGH findings (owner choice), then /speckit.implement from T001.

## 2026-09-28 22:17 - claude-opus-5-5 (analyze remediation)
- Done: every analyze finding resolved as recommended (owner: "resolve all with recommended").
- Decisions: A1 redirect keeps the running glide's end time, at least FOLLOW_GLIDE_MIN_REDIRECT_MS = 250 ms (follow-view.md 1.1.0, research R-6, data-model, T001, T017 e/i/j, T019 c); A2 branch 015-next-system-lookahead created at the same commit as claude/wonderful-curie-ajrosv, both pushed; A3 FR-001 / Clear space: notices and the Grade panel not counted (spec amended); A4 FR-008 frame check in T019 b; A5 dropout comparison in T019 f; A6 FR-014 over-tall system shown from its top (spec amended); A7 T024 b names tests/fixtures/musicxml/voice-and-piano.musicxml; A8 T030/T034 need a working pnpm screenshot (stop and hand off otherwise); A9 US1 #1/#3 fit condition; A10 kept (FR-012 already refers to FR-005); A11 Practice loop case T011 k, large-score jump T019 c; A12 T015 wording; A13 redirect assumption; A14 re-tick Follow check T019 e.
- Handoff: next = T001 (/speckit.implement); branch 015-next-system-lookahead.
