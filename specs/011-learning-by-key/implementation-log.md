# Implementation Log: Learning by key

## 2026-09-26 - claude-opus-5-5 (analyze)
- Analyze: 16 findings (CRITICAL 0, HIGH 4, MEDIUM 4, LOW 8); tasks.md as of 1e0f28b; coverage 23/23 FR, 7/7 SC after
  remediation (FR-023 and US3 scenario 3 were uncovered before).
- Owner: "answer with recommended" - applied in 32e91f1: A1 songs name their source (library-port 1.2 §4a, T084-T085);
  A2 song levels vs beginner caps (Wenceslas -> G major, Silent Night intermediate, level-check before commit, stop if
  fewer than 6 beginner songs); A3 `raisedBecause` for steps computing below their name; A4 T011 keeps reviewed
  repertoire levels with `raisedBecause` when B1 lowers the computed level; A5 unique song `stepOrder`, songs outside the
  step-order check; A6 key-change Intermediate q=80, 9 bars; A7 Electron shelf check (T088); A8 minor scale form named;
  A9-A16 wording, test-first splits (T086, T087), paths, moved audit records, shelf counts.
- Handoff: next = `/speckit.implement` from T001; tasks.md now T001-T088 (88 tasks); T083 needs the owner.
