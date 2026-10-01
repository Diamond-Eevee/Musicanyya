# Data model: Score browser with progress

**Feature**: `013-score-browser-progress` | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

Types live in `src/core/progress/types.ts` and `src/core/browser/types.ts` (pure, no DOM), except the port shapes in
`src/engine/ports.ts` ([contracts/progress-store.md](contracts/progress-store.md)). Times are ISO 8601 strings in UTC.
Percentages are integers.

## 1. Score key

`ScoreKey = string`: lowercase hex SHA-256 of the file bytes (R-3). It is the same value as `contentHash`, library
`item.hash` and the `scoreId` of Practice/Play settings and stored Performances.

## 2. Result (one Play run)

```ts
interface ProgressResult {
  runId: string;                 // = StoredPerformance.runId; makes `played` idempotent
  finishedAt: string;            // ISO 8601
  notesCorrect: { count: number; total: number };   // = GradeSummary.notesCorrect (FR-009)
  notesOnTime: { count: number; total: number };    // = GradeSummary.notesOnTime
  extra: number;                 // = GradeSummary.counts.extra (OD-2)
  tempoPercent: number;          // RunSettings.tempoPercent, 25..200
  strictness: StrictnessLevelName;
  complete: boolean | null;      // null = recorded before this feature, not known (R-6)
  scope: ResultScope;
}
type ResultScope =
  | { kind: 'whole' }
  | { kind: 'partial'; fromMeasure: number | null; toMeasure: number | null;   // 1-based written bars, null = whole Score
      hands: 'right' | 'left' | 'custom' | null };                              // null = all staves
```

Validation: counts are integers with 0 <= count <= total; `tempoPercent` is finite and in [25, 200]; `runId` is not
empty. A result failing validation is dropped when a record is read (R-19).

Derived (pure, `src/core/progress/compare.ts`):
- `bestEligible(r)` = `r.complete !== false && r.scope.kind === 'whole'`
- `masteryEligible(r, t)` = `r.complete === true && r.scope.kind === 'whole' && r.tempoPercent >= t.tempoPercentMin
  && atLeast(r.notesCorrect, t.notesCorrectMinPercent) && atLeast(r.notesOnTime, t.notesOnTimeMinPercent)
  && strictnessRank(r.strictness) >= strictnessRank(t.minStrictness) && extraWithin(r, t.maxExtraPercent)`
- `atLeast({count,total}, p)` = `total > 0 && count * 100 >= p * total` (R-8)
- `compareResults(a, b)`: notes correct, then notes on time, then later `finishedAt`, by integer cross-multiplication
  (FR-023, R-8).
- `percentShown({count,total})` = `total === 0 ? null : Math.floor(count * 100 / total)`.

## 3. Progress record (per Score key)

```ts
interface ProgressRecord {
  format: 1;                     // PROGRESS_FORMAT_VERSION (FR-030)
  scoreKey: ScoreKey;
  updatedAt: string;             // time of the last applied event (FR-030, merge key for a future server)
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openedAs: ItemRef | null;      // how it was last opened, for Continue
  lastPractisedAt: string | null;
  practisedBars: { fromMeasure: number; toMeasure: number } | null;  // of the last `practised` event
  attempts: number;              // Play runs ever recorded, minus removed ones (survives trimming, FR-015)
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  best: ProgressResult | null;   // best eligible (FR-010, FR-023)
  masteredAt: string | null;     // first mastering result's finishedAt; null = not mastered
  masteredBy: string | null;     // runId of that result
  results: ProgressResult[];     // newest first, at most PROGRESS_RESULTS_MAX (20)
}
type ItemRef = { kind: 'library'; id: string } | { kind: 'file'; fileKey: string };
```

Invariants (property-tested, SC-004):
- `results[0]` is the **last** result and `results[1]` the **previous** one.
- `best` equals the maximum by `compareResults` over every eligible result recorded since the last reset and not
  removed, including results trimmed from `results`.
- `attempts` equals the number of `played` events applied since the last reset minus the `resultRemoved` events that
  matched.
- `masteredAt !== null` iff some mastering result was recorded since the last reset and was not removed afterwards
  (R-12: after a removal it is recomputed from `results`).
- `updatedAt` is >= every event time applied.

### Status (FR-011), `deriveStatus(record)`

| Status | Condition | Badge (R-16) |
|---|---|---|
| `mastered` | `masteredAt !== null` | star, `--status-mastered` |
| `played` | `attempts > 0` | filled circle, `--status-played` |
| `practised` | `lastPractisedAt !== null` | half circle, `--status-practised` |
| `new` | none of the above, or no record | outlined circle, `--status-new` |

### Trend (FR-012), `trend(record)`

`results[0]` vs `results[1]` by `compareResults` restricted to the two figures: `up`, `down` or `same`. `null` with
fewer than two results. The shown delta is the notes-correct percentage difference in points.

## 4. Progress events and the reducer

```ts
type ProgressEvent =
  | { type: 'opened'; at: string; as: ItemRef }
  | { type: 'practised'; at: string; fromMeasure: number; toMeasure: number }
  | { type: 'played'; at: string; result: ProgressResult }
  | { type: 'resultRemoved'; at: string; runId: string }
  | { type: 'reset'; at: string };
```

`applyProgressEvent(record: ProgressRecord | null, key: ScoreKey, event, thresholds): ProgressRecord | null`, pure:

| Event | Effect |
|---|---|
| `opened` | `firstOpenedAt ??= at`; `lastOpenedAt = max(lastOpenedAt, at)`; `openedAs = as` if `at` is the newest |
| `practised` | `lastPractisedAt = max(..., at)`; `practisedBars` from the newest |
| `played` | ignored if `results` or `best` already has `runId` (idempotent); else `attempts++`, `firstPlayedAt ??= at`, `lastPlayedAt = max`, insert into `results` by `finishedAt` desc and trim to 20, `best = max(best, result)` if `bestEligible`, set `masteredAt/masteredBy` if unset and `masteryEligible` |
| `resultRemoved` | if found in `results`: remove it, `attempts--`; if it was `best`: `best` = max eligible of `results`; if it was `masteredBy`: recompute from `results` (earliest mastering one) or clear. Unknown `runId`: no change |
| `reset` | returns `null` (the record is deleted) |

Every applied event sets `updatedAt = max(updatedAt, at)`. Events are applied in arrival order. The reducer does not
depend on the order of `opened`/`practised` events relative to each other.

Mastery thresholds (FR-024), all named, in `src/core/defaults.ts`:

| Constant | Default | Meaning |
|---|---|---|
| `MASTERY_NOTES_CORRECT_MIN_PERCENT` | 90 | notes correct at or above |
| `MASTERY_NOTES_ON_TIME_MIN_PERCENT` | 80 | played notes on time at or above |
| `MASTERY_TEMPO_PERCENT_MIN` | 100 | tempo factor at or above (100 % of written or faster) |
| `MASTERY_MIN_STRICTNESS` | `'beginner'` | lowest strictness that can master |
| `MASTERY_MAX_EXTRA_PERCENT` | 10 (OD-2; `null` disables) | extra notes at most this % of notes total |

`MasteryThresholds` bundles them; tests pass other values (configurable, Principle II).

## 5. *My files* entry

```ts
interface UserFileEntry {
  format: 1;
  fileKey: string;               // fileName.normalize('NFC').toLowerCase() (R-11)
  fileName: string;              // latest spelling, as chosen by the musician
  title: string | null;          // from the Score; shown, file name beneath (US3)
  composer: string | null;
  hash: ScoreKey;                // current content
  earlierHashes: ScoreKey[];     // newest first, max USER_FILE_VERSIONS_MAX (10)
  byteLength: number;
  addedAt: string;
  lastOpenedAt: string;
  stored: boolean;               // a copy of the bytes is kept (FR-020); false = "file not stored"
  origin: 'opened' | 'migrated'; // migrated from recentScores (R-6)
  updatedAt: string;             // FR-030
}
```

State machine of `stored`:

```text
          put (copy fits)                         evicted / quota / cleared bytes
  (new) --------------------> stored=true  ---------------------------------> stored=false
    |                              ^                                               |
    | put (copy does not fit)      |      same name opened from disk, copy fits    |
    +------------------------> stored=false ---------------------------------------+
```

Opening a name with a different hash: `earlierHashes.unshift(hash)`, `hash = new`, `stored` recomputed. Identical
content under another name: separate entry, same `hash`, same progress.

### Entry progress, `entryProgress(entry, records)`

It combines `records[entry.hash]` (current) and `records[h]` for each `h` of `earlierHashes`:
- status, best, *Mastered*, trend: current record only.
- attempts: sum over all.
- history: every result of every record, newest first, each flagged `earlierVersion: h !== entry.hash`. The flag is
  derived when the entry is shown, never stored on the result: a result belongs to a content hash, and only the
  entry knows which hash is current (spec Key Entities "Result").

## 6. Browser item (row)

```ts
interface BrowserItem {
  ref: ItemRef;
  scoreKey: ScoreKey;
  title: string;                 // library meta.title / entry title ?? fileName
  subtitle: string | null;       // composer/arranger, or the file name under a title
  folderPath: readonly string[]; // section titles root -> leaf; ['My files'] for files (FR-026)
  sectionId: string | null;      // null for My files
  level: Level | null;
  keys: readonly string[];       // facts.keys (library) / [] for files until opened
  tags: readonly SkillTag[];
  durationSeconds: number | null;
  measures: number | null;
  step: Step | null;
  stepOrder: number | null;
  libraryOrder: number;          // position in depth-first section order, then in-section order (011)
  searchText: string;            // pre-folded: title, composer, arranger, folder names, file name (FR-026)
  progress: ItemProgressView;    // status, best, last, trend, attempts, lastPlayedAt (+ history for detail)
  stored: boolean;               // files: copy available; library: true
}
```

`buildBrowserItems(index | null, files, records, thresholds, compare): BrowserItem[]` is pure; `compare` is the same
caller-supplied `Intl.Collator`-backed comparator `filterItems` takes (library-port.md §2), used only to break a
title tie within one folder/step (Principle V: the core stays Web-API-free, so it never constructs its own
collator - found while implementing T013/T021, buildBrowserItems's `libraryOrder` must equal 011's panel order
exactly, and a title starting with a lower-case letter or punctuation sorts differently under plain ordinal
comparison than under `filterItems`' own collator). The library `hash` and every
`supersedes[].hash` are looked up, so progress under an old hash carries over to the replacement (Edge Cases). The
view merges them the way `entryProgress` does, but **counts** superseded results as current, because the library
decides the replacement is the same piece.

### Folder progress (FR-014), `folderProgress(tree, items)`

It returns `{ played, mastered, total }` for every section id, counting sub-folders (`played` counts `played` **or**
`mastered`, so "5 of 8 played, 2 mastered" reads naturally), plus one entry for *My files*. Invariant (US2 #6): a
folder's figures equal the sum over its items in its subtree.

## 7. Browser view state (FR-006), persisted

```ts
interface BrowserViewState {
  folder: FolderSel;             // { kind: 'continue' } | { kind: 'all' } | { kind: 'myFiles' } | { kind: 'section'; id }
  search: string;                // max 200 chars
  filters: {
    level: Level | null;
    key: string | null;
    tag: SkillTag | null;
    status: StatusFilter | null; // 'new' | 'practised' | 'played' | 'mastered' | 'notMastered' | 'playedNotMastered'
  };
  sort: { by: 'library' | 'title' | 'lastPlayed' | 'best'; dir: 'asc' | 'desc' };
  selected: ItemRef | null;
  expanded: readonly string[];   // (018) section ids of the open rail folders, sorted, unique; absent in 013 payloads = []
}
```

Defaults: folder `continue`, empty search, no filters, sort `library asc`, nothing selected, `expanded: []` (018: every
rail folder collapsed). A non-empty search shows
the folder selection as "All" (US1 #4) without changing `folder`, which comes back when the search is cleared.
`localStorage` `musicanyya.browser.v1` = `{ version: 1, view }`, each field validated alone (R-15).

`queryBrowser(items, view, collator): { rows: BrowserItem[]; total: number }`, pure: folder -> search (every
whitespace-separated term must match `searchText`, accent- and case-folded) -> filters -> sort. `best` sort:
items without a best go last in both directions. Ties fall back to library order.

## 8. Browser UI state (session only), `browserState`

```text
closed --open()--> loading --data ready--> ready --openItem()--> opening --success--> closed
   ^                  |                      |  ^                   |
   |                  +--index failed------->|  +------failure------+   (message line, browser stays open)
   +------------------------ close() / Escape / backdrop / run start -----+
```

Fields: `phase`, `data: { index | indexError, files, records }`, `view: BrowserViewState`,
`pending: PendingAction | null` (R-12 deferred removal/reset with its deadline), `message: { code, fileName? } | null`,
`openingRef: ItemRef | null`.

(018) Additions, full text in [018 data-model.md](../018-browser-tree-collapse/data-model.md) section 3:

- `revealSelection: boolean` and `selectionRevealed()`: a one-shot request for the list and rail to scroll the restored
  selection and chosen folder into view (018).
- `fileOpened(ref)`: a direct file open (*Open file...*, drop) selects the file in any phase, phase unchanged (018).
- The open rule (018): `openSucceeded` and `fileOpened` set `selected = ref` (library and file refs); when the chosen
  folder cannot list the item, `folder` becomes the item's section (library) or *My files* (file); for a library item
  its section's ancestors are added to `expanded`.
- First-load-only reveal (018): on the first successful `indexLoaded` of an app run, the ancestors of a chosen section
  folder are added to `expanded`; later loads leave `expanded` alone.
- A restored `selected` that names a library item not in the index, or a file not in *My files*, is cleared to `null`
  on `indexLoaded` (018).

`PendingAction` = `{ kind: 'removeFile'; fileKey; keepProgress: boolean } | { kind: 'reset'; ref: ItemRef }` plus
`deadline` (ms). Only one at a time: starting a second commits the first immediately.

## 9. Suggestion (FR-025), `suggestNext(items, records, tree)`

```ts
type Suggestion =
  | { kind: 'continue'; ref: ItemRef }                  // most recent stepped item, not mastered
  | { kind: 'next'; ref: ItemRef; after: ItemRef }      // next main step / song / next key folder
  | { kind: 'firstSteps'; ref: ItemRef; repertoireSectionId: string | null }  // no history (US4 #3)
  | { kind: 'none' };
```

Plus `morePractice: ItemRef | null` (R-10: after `MORE_PRACTICE_AFTER_RUNS` whole complete runs without mastery).

## 10. Changes to existing entities

| Entity | Change |
|---|---|
| `StoredPerformance` (003) | optional `complete?: boolean`, written from now on; absent = not recorded (performance-log MINOR) |
| `PracticeEffect` (002) | `{ type: 'loopCompleted' }` (practice-session MINOR, R-9) |
| `playState` | `newBest: boolean` beside the Grade (FR-016) |
| `Session.practiceScoreId` / `playScoreId` | `contentHash` whenever the progress store is available (R-3) |
| IndexedDB `musicanyya` | version 3: `progress`, `userFiles`, `userFileBytes`, `meta` (R-5) |

## 11. Named constants added

| Constant | Value | Where |
|---|---|---|
| `PROGRESS_FORMAT_VERSION` | 1 | `src/core/defaults.ts` |
| `PROGRESS_RESULTS_MAX` | 20 (>= `PERFORMANCES_PER_SCORE_MAX`) | `src/core/defaults.ts` |
| `MASTERY_*` | see section 4 | `src/core/defaults.ts` |
| `CONTINUE_ITEMS_MAX` | 8 | `src/core/defaults.ts` |
| `MORE_PRACTICE_AFTER_RUNS` | 3 | `src/core/defaults.ts` |
| `USER_FILE_VERSIONS_MAX` | 10 | `src/core/defaults.ts` |
| `USER_FILES_BYTES_BUDGET` | 100 MiB | `src/engine/config.ts` |
| `UNDO_WINDOW_MS` | 8000 | `src/engine/config.ts` (UI timing, not audio) |
| `BROWSER_SEARCH_MAX_CHARS` | 200 | `src/core/defaults.ts` (re-exported from `src/engine/config.ts`) - `src/core/browser/query.ts` cuts the search text itself, so this cannot live only in the engine layer (found implementing T014/T022) |
| `BROWSER_ANNOUNCE_DEBOUNCE_MS` | 300 | `src/engine/config.ts` (screen-reader count announcement) |
| `DB_VERSION` | 2 -> 3 | `src/engine/storage/db.ts` |
