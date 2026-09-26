# Exercise definitions kept as generator fixtures

These `chords`-form definitions (contract `exercise-definition` 1.0.0) were the shelf's Learning content until feature 011
(2026-09-26), which replaced them with the four generated steps per key (`content/library/exercises/step-*.json`). They are
no longer generated into `public/library/`; they stay here so the 1.0.0 generator (`generateTriadFamily`,
`generateChangeFamily`) keeps its goldens, invariants and engraving tests.

- Origin: written for this project by claude-sonnet-5 (2026-09-22 to 2026-09-24), CC0-1.0, like everything under
  `content/library/`.
- `triads-major.json`, `triads-minor.json`: 24 keys x 15 chords (feature 005 data-model §5.1).
- `changes-*.json`: chord-change drills (feature 005 data-model §5.2).
