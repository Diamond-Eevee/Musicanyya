# Progress and Score-browser seed fixtures

`e2e-progress-seed` payloads (specs/013-score-browser-progress/contracts/score-browser.md section 8, T094): each
seeds `ProgressEvent`s, applied through `ProgressStore.apply` at every real library id it names, keyed by the
library index's own hash - no bytes or musical content of their own.

| Fixture | Behaviour | Origin | Licence |
|---|---|---|---|
| mixed-statuses.json | One real library item each in status New, Practised, Played and Mastered (`learning/keys/c-major` folder) | Hand-written (own work) | CC0 |
| c-major-intro-mastered.json | The item opened, then a single mastering result on `learning/keys/c-major/introduction`, for the US4 *Continue*/*Suggested next* Independent Test | Hand-written (own work) | CC0 |
| played-ladder.json | Three played, not mastered items whose best results (60 %, 72 %, 85 %) are in a different order from library order, one mastered item and one practised item, for the US5 filter and sort Independent Test | Hand-written (own work) | CC0 |

`db-v2.ts` (T006) is not a seed file for the app; it is a version-2 `recentScores`/`performances` fixture for the
progress migration test (`tests/engine/storage/progress-migration.test.ts`). It reads the real bytes of
`tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` and
`public/library/learning/keys/c-major/introduction.musicxml` (both already documented in their own fixture/library
READMEs) and computes their real SHA-256 at import time; the record shapes themselves are hand-written (own work,
CC0).
