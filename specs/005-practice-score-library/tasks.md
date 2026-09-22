# Tasks: Practice Score Library

**Input**: Design documents from `specs/005-practice-score-library/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
-->

**No real-time code is touched by this feature** (plan.md, "Real-time Paths Touched: none"), so no task
carries an RT review. If a task turns out to edit an AudioWorklet, the scheduler, metronome or MIDI
timing, stop and add an `rt-audio-reviewer` task next to it (Constitution I).

**Content tasks are music, not typing.** Every authored score is reviewed with
`music-domain-expert` before its task is ticked, and no task may be finished with an empty, silent or
partial file (AGENTS.md section 4: no placeholders).

---

## Phase 1: Setup

- [x] T001 Add `library:exercises` and `library:index` scripts to `package.json`, and include
  `tools/` in the type-check and lint scope (`tsconfig.json` project references, `biome.json`)
- [x] T002 [P] Create the shelf skeleton: `public/library/learning/chords/`,
  `public/library/learning/chords/changes/`,
  `public/library/repertoire/{beginner,intermediate,advanced}/`
- [x] T003 [P] Write `public/library/README.md`: the licence rule (CC0 / clear public domain / our
  own work), the sidecar requirement, the "regenerate the index" workflow, and a **Rejected items**
  section - the home FR-018 needs for "the reason MUST be recorded" when a candidate is turned away
  (analyze A13)
- [x] T004 [P] Add `tools/library/sections.ts` - the section table (id, title, description, parent,
  order) from data-model SS2 - and exclude the generated `public/library/index.json` from Biome
  formatting so the generator's output stays authoritative
- [x] T083 Add a `library` project to `vitest.config.ts` (node environment,
  `include: ['tests/library/**/*.test.ts']`). The config filters by explicit include globs, so
  `tests/library/` is invisible to `pnpm test` until it is registered - without this, T017, T067 and
  T071 would pass by never running (analyze A1)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T005 [P] Test first: `tests/core/library/index-model.test.ts` - a valid index parses; a
  `version` other than 1 rejects the whole index with one notice; an item failing validation is
  skipped and reported while the rest still list; unknown fields are ignored; an item over
  `MAX_FILE_BYTES` is skipped (contract `library-index.md` SS3). Confirm it fails
- [x] T006 [P] `src/core/library/types.ts` - `LibraryIndex`, `LibrarySection`, `LibraryItem`,
  `ItemMetadata`, `Provenance`, `ItemFacts`, `LevelCheck`, `SkillTag`, `Level`, `LibraryFilter`
  (types only, straight from the contracts)
- [x] T007 `src/core/library/index-model.ts` - parse and validate the index, making T005 pass. Pure:
  no DOM, no `fetch`, runs in Node
- [x] T008 [P] Test first: `tests/core/library/facts.test.ts` - derive `ItemFacts` from existing
  fixtures (`scale-c-major-q100`, `grand-staff-two-voices-per-staff`, `tuplet-triplet-eighths`,
  `tie-chain-three`, `meter-change`): span, absolute bounds, hand independence, voices per staff,
  shortest division, note densities, accidentals, notation flags, fingering coverage. Confirm it fails
- [x] T009 `src/core/library/facts.ts` - derive `ItemFacts` from a parsed Score plus its load report,
  making T008 pass. Facts are display/filter data only, never a second source of musical truth
  (data-model SS3). **Design addendum**: the `Score` model carries no key signature (only tempo/time
  are needed for playback, Principle II), so `facts.ts` also takes the parsed `XmlDocument` and reads
  `<key>`/`<time-modification>`/`<octave-shift>`/`<pedal>` directly - the one place `core/library`
  touches XML instead of the `Score` model. Recorded in `research.md`. Two facts fields beyond the
  v1.0.0 contract's required set were added (`voicesPerStaff`, `handIndependenceFraction`) - the
  contract's `facts` schema has no `additionalProperties: false`, so this is the MINOR addition its
  versioning section allows.
- [x] T010 [P] `src/engine/ports.ts` - add `LibraryCatalog`, `CatalogResult`, `CatalogError`
  (contract `library-port.md` SS1), mirroring the existing `StoreResult` shape
- [x] T011 [P] `tests/fakes/fake-library-catalog.ts` - in-memory index and items, able to fail with
  any `CatalogError`, so every UI and session test runs in Node
- [x] T012 [P] `src/ui/i18n/en.ts` - library strings: section and level names, filter labels, empty
  and error states, Retry, "where this score came from", licence and credit labels

**Checkpoint**: the pure model, the port and the fakes exist; user stories can proceed.

---

## Phase 3: User Story 1 - Open the app and find something to play (Priority: P1) MVP

**Goal**: a musician with no file of their own opens the app, browses the shelf and plays a Score.
**Independent Test**: fresh profile, no recents -> *Score > Scores* -> *Repertoire > Intermediate >
Für Elise* -> Listen plays it, with its source and licence visible.

### Tests (write first, confirm they fail)

- [x] T013 [P] [US1] `tests/engine/library/http-catalog.test.ts` - index fetched and parsed; 404 ->
  `notFound`; malformed JSON -> `malformedIndex`; oversize -> `tooLarge`; Cache Storage missing or
  throwing still returns the bytes; a second call is served without a network hit (FR-014)
- [x] T014 [P] [US1] `tests/ui/library-state.test.ts` - the state machine of data-model SS6
  (`idle -> loadingIndex -> ready | indexError -> openingItem`), and that `indexError` leaves recents
  and Open usable
- [x] T015 [P] [US1] `tests/ui/mx-library.test.ts` - renders sections and items with title, composer
  and level; emits `openlibraryitem`; shows one error row with Retry when the index fails
- [x] T016 [P] [US1] `tests/engine/session-library.test.ts` (beside `play-session.test.ts` and
  `replay-session.test.ts`, so the `engine` project picks it up) - `openlibraryitem` fetches the
  bytes and goes through the **existing** `loadBytes`, so the Score, its Note IDs and the report are
  identical to a dragged-in file (FR-013); a fetch failure raises a notice and leaves the current
  Score untouched; opening a user file clears `openedLibraryItemId`. **Design addendum**: this logic
  is factored into `src/app/library-session.ts` (`LibrarySessionController`), mirroring how
  `PlaySessionController` is factored out of `Session` - the giant `Session` class constructs real
  Workers in its constructor and cannot be unit-tested directly (no other test does), so the same
  extraction pattern makes T016 possible at all.
- [x] T017 [P] [US1] `tests/library/index.test.ts` - regenerating the index in memory equals the
  committed `index.json` apart from `generated`; every score file has a sidecar; no item is unlisted
  (FR-025). **Currently red on purpose**: its "matches the committed index.json" assertion needs
  `public/library/index.json`, which does not exist until T030. The other two assertions
  (no-problems, nothing unlisted) already pass against the empty tree. Re-confirmed at T030.
- [x] T084 [P] [US1] `tests/library/extensibility.test.ts` - writing a new score plus sidecar into a
  copy of the tree and regenerating makes it appear in the index, with **no change to any file under
  `src/`** (FR-016, analyze A8). Confirm it fails

### Implementation

- [x] T018 [US1] `tools/library/build-index.ts` - walk `public/library/`, read each sidecar, load each
  score through `readXml` + `buildScore`, derive facts with T009, write `index.json`
  (contract `library-index.md` SS2, SS4). Exports `validMetadata` from `index-model.ts` so the
  generator validates a sidecar against exactly the schema the runtime reader uses. `tsconfig.tools.json`
  needed a reference to `tsconfig.engine.json` added (it imports `src/engine/files/*`).
- [x] T019 [US1] `src/engine/library/http-catalog.ts` - the `fetch` + Cache Storage adapter
  (`musicanyya-library-v1`), resolving paths against `import.meta.env.BASE_URL` so the dev server,
  `dist/` and the Electron `app://` origin all work unchanged
- [x] T020 [US1] `src/ui/state/libraryState.ts` - list, section selection, load status, selected item
- [x] T021 [US1] `src/ui/elements/mx-library.ts` - the shelf: section tree, item list, open action,
  loading and error rows (US1 scope: every non-empty section expanded, no filter chips yet - those are
  US3/T051; the section tree renders as headings rather than a click-to-filter control so opening an
  item never costs more than one click, SC-001)
- [x] T022 [P] [US1] `src/ui/styles/panels.css` - library rows, section headings and the source line,
  using the existing tokens (no new colour outside `tokens.css`)
- [x] T023 [US1] `src/app/session.ts` - construct the element, register it in `PanelTools` as
  `scores: [scoreSource, library, recentList]`, handle `openlibraryitem`, remember
  `openedLibraryItemId`. The index is fetched lazily the first time the *Scores* panel opens
  (`viewState.subscribe`, `libraryState` still `idle`), never at startup (contracts/library-port.md
  §5: one fetch per session). `openFile`/`reopenRecent` clear the opened library item.
- [x] T024 [US1] `src/ui/elements/mx-score-source.ts` - "where this Score came from": source, licence,
  credit, limitations for the open item; nothing for a user's own file (FR-019). Mounted inside the
  existing *Scores* panel (not a new panel, research R-10) - the panel never covers the Score
  (feature 004), so this is visible without leaving the score view.

### Content seed (the shelf must not be empty for the story to exist)

- [x] T025 [P] [US1] Move `musicxml/chords/c-major-scale-and-chords.musicxml` to
  `public/library/learning/chords/`, write its sidecar (authored, CC0, from `musicxml/README.md`),
  leave a pointer in `musicxml/README.md`, and update the path in
  `specs/002-practice-wait-mode/quickstart.md` (owner decision D-3)
- [x] T026 [US1] Author `public/library/repertoire/intermediate/fur-elise-theme.musicxml` + sidecar:
  Für Elise A–B–A theme, simplified, 16ths as the shortest value, labelled an arrangement (data-model
  SS5.3). Authored with the `music-domain-expert` agent, which fetched the Mutopia Project's
  public-domain LilyPond engraving (piece-info id 931) and hand-decoded it rather than working from
  memory alone.
- [x] T027 [P] [US1] Author `public/library/repertoire/beginner/ode-to-joy.musicxml` + sidecar - our
  own two-hand setting of the public-domain melody
- [x] T028 [P] [US1] Author `public/library/repertoire/advanced/chopin-prelude-op28-no4.musicxml` +
  sidecar - 25 bars, binding criterion 11 (chromatic accidental density). Authored with the
  `music-domain-expert` agent from the Mutopia Project's public-domain LilyPond engraving (piece-info
  id 468, 562 notes hand-decoded); the agent caught and fixed a self-introduced left-hand duration bug
  during its own verification re-read before this was reviewed.
- [x] T029 [US1] `music-domain-expert` review of T026-T028 against the published texts: pitches,
  rhythms, key and metre, repeats, and the fingering we added. Record `reviewedBy` / `reviewedOn` in
  each sidecar; fix and re-review anything it flags. **A second, independent `music-domain-expert`
  agent instance** (not the one that authored the files) reviewed all three against the same Mutopia
  sources plus general knowledge: all three **PASS**. Two non-blocking notes recorded in the Chopin
  sidecar's `provenance.note` (a disclosed low-confidence octave detail on one inner-voice bass note
  in bar 24) - no pitch-class errors, no mislabelling. No fingering was added (pieces, not exercises -
  not required by FR-006). Two real bugs were found and fixed during this pass, outside the sidecars
  themselves: both pickup measures were numbered `1` instead of `0 implicit="yes"` (raising a
  `measureLengthMismatch` info notice that an authored item must have none of, data-model SS4
  criterion 28) - renumbered; and `facts.ts`'s `shortestDivision` silently misread the Chopin file
  because grace notes carry `durationTicks: 0`, masking the real shortest notated value behind a
  same-looking fallback - fixed in `src/core/library/facts.ts` with a regression test
  (`tests/core/library/facts.test.ts`). Für Elise's `<key>` was missing `<mode>minor</mode>` (A minor
  and C major share a 0-sharp/flat signature), which made `facts.keys` read "C major" for a piece that
  is famously in A minor - fixed.
- [x] T030 [US1] `pnpm library:index`, commit `public/library/index.json`, and confirm T017 passes.
  4 items, 4 sections, zero problems. Full suite green (141 files, 1144 tests).
- [x] T031 [US1] `tests/e2e/library.spec.ts` - browse -> open Für Elise -> Listen, run in the browser
  projects and under the Electron `app://` origin; assert SC-001 (at most 3 interactions from a fresh
  profile to hearing the Score, under 15 s) and SC-010's offline half (an item opened once opens
  again with the network blocked) - analyze A5, A15. WebKit smoke-checks the transport instead of
  asserting a run starts (Playwright's WebKit has no AudioContext at all - the same limitation every
  other run-needing spec in this suite already skips it for). **Two real bugs found and fixed while
  making this pass**: `session.ts` never closed the Scores panel on a successful `openlibraryitem`
  (data-model SS6 requires it); and all three authored MusicXML files had a leading `<!-- -->` comment
  between the XML declaration and `<score-partwise>`, which Verovio's format-sniffing cannot parse
  past ("unknown XML data") even though the app's own reader tolerates it fine - removed (the
  provenance those comments held was already duplicated in each sidecar's `provenance.note`/`basedOn`,
  with the typesetter credits folded in before the comments were deleted).

**Checkpoint**: US1 is independently testable - a fresh profile can find and play a Score, in both
Shells, with its provenance on screen.

---

## Phase 4: User Story 2 - Practise chords in every key (Priority: P2)

**Goal**: 24 per-key chord exercises and 16 chord-change drills, identical in structure by
construction.
**Independent Test**: *C major triads* and *D major triads* are the same exercise transposed - same
measures, positions, rhythm and fingering - and Practice mode waits chord by chord.

### Tests (write first, confirm they fail)

- [x] T032 [P] [US2] `tests/core/musicxml/write.test.ts` - the minimal writer round-trips: write ->
  `readXml` -> `buildScore` yields the intended pitches, durations, two staves with `<backup>`, and
  fingering on every note
- [x] T033 [P] [US2] `tests/core/library/exercise/degrees.test.ts` - degree to pitch under a key
  signature; inversions; the harmonic-minor major V written with an explicit `<alter>` +
  `<accidental>`; G# minor's V spelled D#–F##–A#; no key in the chosen set produces a double flat
  (data-model SS5.1)
- [x] T034 [P] [US2] `tests/core/library/exercise/guards.test.ts` - a fingering whose length does not
  match its voicing is an error, not a silent mismatch; the register rule places the tonic in
  [57, 68]; a pitch outside the 88-key range fails generation
- [x] T035 [P] [US2] `tests/core/library/exercise/goldens.test.ts` - golden snapshots for C major,
  F# major, E♭ minor and A minor, plus determinism: regenerating unchanged input is byte-identical
- [x] T085 [P] [US2] `tests/core/library/exercise/family-invariants.test.ts` - across **all 24**
  generated keys, assert identical measure count, chord onset ticks, durations and fingering
  sequence; only pitches and the key signature may differ. This is the direct test of FR-005, which
  the goldens of T035 only sample (analyze A2). Written first, it fails for the right reason - the
  keys do not exist yet - and turns green at T040

### Implementation

- [x] T036 [US2] `src/core/musicxml/write.ts` - the minimal writer (score-partwise, parts, attributes,
  notes and chords, `<backup>`, directions with `<words>`, fingering). **Never `<harmony>`**: it is
  not in `supportedElements`, so it would emit an `unsupportedElement` notice on every item
  (data-model SS4, correction A)
- [x] T037 [US2] `src/core/library/exercise/` - definition model, transposition, voicing, the
  fingering rule (root 1-3-5/5-3-1, first inversion 1-2-5/5-3-1, second inversion 1-3-5/5-2-1) and
  the range guard, making T033-T035 pass
- [x] T038 [US2] `content/library/exercises/triads-major.json` + `triads-minor.json` - the 24-key
  definition (split by mode, not the single `triads.json` originally sketched - research.md R-12
  decision 1): 4/4, quarter = 66, the chord order of data-model SS5.1, both hands an octave apart
- [x] T039 [US2] `tools/library/build-exercises.ts` - generate the score and sidecar pairs, refusing
  to touch any item whose provenance is `downloaded`
- [x] T040 [US2] Generate the 24 key exercises (`pnpm library:exercises`) and review the diff
- [x] T041 [US2] `content/library/exercises/changes-*.json` - 13 files, the 16 chord-change drills of
  data-model SS5.2: dotted half + quarter rest in section A, one joined whole note per chord in
  section B, ties on common tones, chord names and Roman numerals above the staff, backward repeats
  (research.md R-12 decision 2 records where the written-measure count deviates from SS5.2's
  illustrative "13")
- [x] T042 [US2] Generate the drills and review the diff
- [x] T043 [US2] `music-domain-expert` review of the generated set: spelling in all 24 keys, the
  fingering rule, the G# minor note, and that each drill trains what it claims. **PASS** on both
  families; one non-blocking finding (drill 14's fixed-anchor voicing produced a backward octave leap
  in the middle of the "diatonic ladder") fixed by chaining each cycle chord's voicing to the
  previous one - research.md R-12, regenerated and re-verified
- [x] T086 [US2] Extend `tests/architecture/layers.test.ts`: no file under `src/app`, `src/ui`,
  `src/engine` or `src/workers` may import `src/core/musicxml/write.ts` or
  `src/core/library/exercise/` - they are dev-only generation code that the plan justified inside
  the core, and nothing else stops the app pulling them into the bundle (analyze A14)
- [x] T044 [US2] `pnpm library:index`; confirm `fingeringCoverage == 1` for every exercise (FR-006),
  that all 40 items load with no notices, and assert the counts in the library suite - at least 24
  chord exercises and 12 drills (SC-004, analyze A11)

**Checkpoint**: US1 and US2 both work independently; the Chords shelf is complete.

---

## Phase 5: User Story 3 - Levels that actually mean something (Priority: P2)

**Goal**: three levels with objective criteria every item satisfies, and a list you can narrow.
**Independent Test**: read the published Beginner criteria, check every Beginner item against them -
all pass; a mis-levelled item fails the check.

### Tests (write first, confirm they fail)

- [x] T045 [P] [US3] `tests/core/library/levels.test.ts` - the 28 criteria of data-model SS4 as
  nested caps; `checkLevel` computes the lowest level an item satisfies; assigned **below** computed
  fails; assigned **above** computed passes only with `raisedBecause`; a missing tempo fails rather
  than assuming one (SS4.1 item 4)
- [x] T046 [P] [US3] `tests/core/library/filter.test.ts` - filtering by section, level, key, tag and
  text; accent- and case-insensitive text ("zyczenie" finds "Życzenie"); a synthetic 200-item index
  filters inside the SC-007 budget
- [x] T047 [P] [US3] `tests/ui/mx-library-filters.test.ts` - filter chips and text box drive the
  list; the item detail shows composer, key, metre, tempo, measures, duration, hands and tags
  (FR-010, FR-012)

### Implementation

- [x] T048 [US3] Level criteria: the **threshold values** as named `LEVEL_*` constants in
  `src/core/defaults.ts` (this project's constants table, AGENTS.md SS6 - analyze A3), and the
  criterion definitions plus `checkLevel` in `src/core/library/levels.ts`. Also implements T050
  (`levelCheck` wired into `tools/library/build-index.ts`) ahead of schedule, since running the
  checker against real US1/US2 content immediately surfaced calibration bugs (data-model.md §4
  "Correction C") that needed fixing before either task could be called done.
- [x] T049 [US3] `src/core/library/filter.ts` - pure filtering and sorting, with the collator passed
  in so the core stays Web-API-free
- [x] T050 [US3] `tools/library/build-index.ts` - add `levelCheck` per item and fail generation when
  an item's assigned level is wrong without a recorded `raisedBecause`
- [x] T051 [US3] `src/ui/elements/mx-library.ts` - filter chips, text box, item detail, and the level
  descriptions in plain language (FR-009, US3 scenario 1)
- [x] T052 [US3] `src/ui/state/libraryState.ts` - persist the filter in `musicanyya.library.v1`
  (contract `library-port.md` SS3); invalid or missing data falls back to "no filter"

### Content build-out (FR-008: >= 6 / >= 5 / >= 4 pieces)

- [x] T053 [P] [US3] Beginner: Czerny Op. 599 nos. 1, 5, 11, 18 + sidecars - **descoped**: Op. 599 is
  a scan-only IMSLP source with no way to read it in this environment, and its verified substitute
  (Op. 821, on Mutopia) turned out to be intermediate-to-advanced technique, not beginner, on
  independent confirmation. No file was mislabeled to force a fit; the Beginner and Intermediate
  targets are both met by T054/T055/T057-T059 without it. See data-model.md §5.3 "Czerny descoped
  entirely" and `implementation-log.md` for the full reasoning.
- [x] T054 [P] [US3] Beginner: Gurlitt Op. 117, Köhler Op. 190 and Türk *Kleine Handstücke* - **all
  three dropped**, same reasoning as T053's Czerny descope: IMSLP has no readable source for the
  requested numbers (scan-only, and a bot-check CAPTCHA the agent correctly refused to bypass), and
  none of the three appear in Mutopia's index at all. The pre-existing unverified
  `gurlitt-op117-no1.musicxml` stub (from before this drop) was removed since its notes did not match
  any verifiable source. **Substituted** with four independently source-verified traditional/PD tunes:
  *Twinkle, Twinkle, Little Star*, *Amazing Grace*, *Jingle Bells* (8-bar refrain, `arrangement: true`),
  *Mary Had a Little Lamb* (transposed to F) + sidecars, all passing the level check.
- [x] T055 [P] [US3] Beginner: *Greensleeves* in A minor (our setting) and the 16-bar Für Elise
  beginner arrangement + sidecars
- [x] T056 [US3] `music-domain-expert` review of T053-T055 (done as part of a combined review pass
  with T060/T065, see that entry) - all four Beginner pieces from T054 and Greensleeves/Für-Elise-16
  approved (Amazing Grace approved with a noted caveat: pitch-verification could not be fully closed
  against an authoritative source in the review window, recommend a follow-up by-ear check, not a
  blocker).
- [ ] T057 [P] [US3] Intermediate: Petzold Minuets BWV Anh. 114 and 115, Musette BWV Anh. 126 +
  sidecars - **not attempted this session** (FR-008's Intermediate target of >= 5 is already met by
  T058/T059 without it - Burgmüller nos. 2 and 5, Schumann Op. 68 no. 10 and Clementi, alongside the
  already-committed Für Elise theme). Left open as optional future work, not descoped.
- [x] T058 [P] [US3] Intermediate: Burgmüller Op. 100 nos. 2 and 5 + sidecars, done and reviewed.
  **Op. 100 no. 1 ("La Candeur") dropped**: re-verified note-for-note against the real Mutopia source
  (piece-info id 202) - the 60-note unbroken right-hand eighth-note run across mm 1-8 is exactly how
  Burgmüller wrote it, not a transcription artifact, so it genuinely fails Intermediate's criterion 6
  cap (32) and cannot be fixed without misrepresenting the piece (same known-limitation class as
  data-model.md §4.1 point 7, "repeated shapes"). Moved out of `public/library/` to the session
  scratchpad rather than deleted (never committed, so nothing is lost by dropping it). **Schumann Op.
  68 no. 10 ("Fröhlicher Landmann") substituted in its place** to hit the FR-008 target - see the new
  task line under T059's old slot below; Schumann nos. 8 and the optional no. 1 not attempted (not
  needed once no. 10 landed).
- [x] T059 [P] [US3] Intermediate: Clementi Sonatina Op. 36 no. 1 mvt I done, re-verified and
  reviewed. **Satie *Gymnopédie no. 1* reassigned to Advanced**, not shipped as Intermediate: verified
  against the real Mutopia source (piece-info id 37) and confirmed the left hand's low-bass-to-high-
  chord voicing (leaps up to ~31 semitones, a genuine "silent accurate jump at pp" difficulty) is
  authentic to the piece and fails Intermediate's criteria 16/17 for real reasons, not a transcription
  slip - it now lives at `public/library/repertoire/advanced/satie-gymnopedie-no1.*` with
  `limitations: ["written pedal is not played"]`, reviewed and approved (see T065). Schumann Op. 68
  no. 10 was written this session to fill the Intermediate slot this reassignment left open (see
  T058's note) - `public/library/repertoire/intermediate/schumann-op68-no10.musicxml`/`.json`,
  transcribed from Mutopia's MIDI parsed programmatically, reviewed and approved.
- [x] T060 [US3] `music-domain-expert` review of T057-T059's actual delivered content (Clementi,
  Burgmüller nos. 2/5, Schumann no. 10 - T057 was not attempted, see above) - combined with T056/T065
  into one review pass since the content plan changed substantially from the original task list. All
  four approved (Burgmüller nos. 2 and 5 approved with a metadata caveat - `reviewedBy` had been
  self-attested by the authoring agent as `"claude-sonnet-5"` rather than the independent reviewer;
  corrected to `"music-domain-expert"` after this pass covered them).
- [x] T061 [P] [US3] Advanced: Für Elise WoO 59 (full A-B-A-C-A form, each section once) re-verified
  this session against Mutopia's published PDF and reviewed - approved with a caveat: a large
  fraction of the content (bridges, the whole B-section melody, the C-section's bass-octave opening)
  remains an honest reconstruction from general knowledge, not a primary-source transcription, since
  no machine-readable source is published for this piece; title/subtitle softened from "(complete)"
  to "(arranged, full A-B-A-C-A form)" + `arrangement: true` so the abridgement (59 measures vs.
  ~102-140 in print) isn't overclaimed. A follow-up bar-by-bar check of the reconstructed passages
  against an IMSLP facsimile is recommended before that caveat is removed. Chopin Prelude Op. 28 no.
  20 done: the original unverified 13-measure draft was re-verified pitch-by-pitch against Mutopia's
  LilyPond source (caught and fixed a real measure-9 octave-placement error in the process) and
  reviewed/approved. Chopin Prelude no. 15 ("Raindrop") **not attempted** - stretch goal, not needed
  (FR-008's Advanced target of >= 4 is already met without it).
- [x] T062 [P] [US3] Advanced: Bach Prelude in C BWV 846 done - verified via harmonic cross-reference
  and a pixel-level image check of measure 1 against a CC0 published edition (both independently
  confirmed by the T065 review pass). Passes the level check cleanly with **no `raisedBecause`
  needed**: `longestRunAtShortestValue` is 412 (16th-note figuration is continuous almost throughout,
  not just the closing measures), which alone puts it past Intermediate's cap of 32 - Advanced is
  where the numbers genuinely place it, not an editorial judgement call, so the data-model.md §5.3
  guess that it would need `raisedBecause` did not hold up. Bach Invention no. 1 BWV 772 and Mozart K.
  545 mvt I **not attempted** - stretch goals, not needed (FR-008's Advanced target already met).
- [ ] T063 [P] [US3] Advanced: Joplin *The Entertainer* + sidecar - **not attempted this session**
  (FR-008's Advanced target of >= 4 is already met without it - Chopin no. 4, Für Elise complete,
  Chopin no. 20, Bach Prelude BWV 846, Satie). Left open as optional future work, not descoped.
- [ ] T064 [US3] Probe Chopin Nocturne Op. 9 no. 2 for the 11:8 / 22:12 tuplets - **not attempted this
  session**, same reason as T063 (target already met). Left open as optional future work.
- [x] T065 [US3] `music-domain-expert` review of T061-T062's delivered content (Für Elise complete,
  Chopin no. 20, Bach Prelude BWV 846) plus the reassigned Satie item - combined with T056/T060 into
  one review pass. Full findings and per-item verdicts recorded above and in
  `implementation-log.md`; 0 items needed rework, 5 of 12 items across all three levels shipped with a
  noted (non-blocking) caveat.
- [x] T066 [US3] `pnpm library:index` run clean: 58 items, 0 problems, every `levelCheck.pass` true.
  FR-008 counts, all with more than one composer and more than one key signature per level (analyze
  A10): **Beginner 7** (5 distinct composers/sources, keys A minor/C/F/G major), **Intermediate 5**
  (4 composers, keys A minor/C/F major), **Advanced 5** (4 composers, keys A minor/B minor/C major/C
  minor/E minor). All three levels clear their FR-008 minimum (>= 6 / >= 5 / >= 4) with room to spare.

**Checkpoint**: the shelf is navigable by level, key and skill, and every level assignment is checked.

---

## Phase 6: User Story 4 - Everything on the shelf is legally clear (Priority: P2)

**Goal**: nothing ships without a licence and a provenance record, and the check fails when it does.
**Independent Test**: `pnpm test -- tests/library/licence.test.ts` lists every item with its licence
and fails on a missing, wrong or unrecorded one.

### Tests (write first, confirm they fail)

- [x] T067 [P] [US4] `tests/library/licence.test.ts` - every score file has a sidecar that validates;
  `licence` is `CC0-1.0` or `public-domain` and anything else **fails** (FR-017); a `downloaded` item
  has `source` + `obtained` **and** a `THIRD_PARTY_NOTICES.md` entry (FR-020); no file is 0 bytes
  **and no item is silent - every item has at least one sounding note** (FR-021, analyze A12); an
  item with `arrangement: true` says so in its `title` or `subtitle` (FR-007, analyze A9); the total
  bytes of `public/library/` stay inside the SC-008 budget (FR-026, analyze A7); every item has
  `reviewedBy` / `reviewedOn`, and a raised level has `raisedBecause`

### Implementation

- [x] T068 [US4] `THIRD_PARTY_NOTICES.md` - an entry for every `downloaded` item, plus one statement
  that the authored library is our own work under CC0
- [x] T069 [US4] `src/ui/elements/mx-score-source.ts` - show `credit` and `limitations`, and say
  "written for Musicanyya" for authored items (FR-019, US4 scenario 3) - **already delivered by T024**
  (US1): that task built this exact component (credit, licence, limitations, the "Written for
  Musicanyya" authored-item line) and `tests/ui/mx-score-source.test.ts` already covers both
  provenance branches plus the limitations line. Verified against FR-019 scenario 3 this session;
  no code change needed.
- [x] T070 [US4] Run the negative paths of `quickstart.md` SS"US4" by hand - a CC-BY sidecar, a
  missing notices entry, a 0-byte file - and confirm each **fails** the suite; revert each

**Checkpoint**: the library cannot ship an item whose licence is unknown or unrecorded.

---

## Phase 7: User Story 5 - The library keeps the app honest (Priority: P3)

**Goal**: the whole shelf is a regression corpus the app is checked against.
**Independent Test**: the sweep loads every item, engraves it and matches its recorded row; a new
notice is a failure, not a surprise.

### Tests (write first, confirm they fail)

- [x] T071 [P] [US5] `tests/library/sweep.test.ts` - every item loads without error, produces a
  playable timeline, and its derived facts and notices equal the committed ones; an item with an
  unrecorded notice fails (FR-022, FR-023)
- [x] T072 [P] [US5] `tests/ui/library-degradation.test.ts` - a missing sidecar, a missing item file
  and a missing `index.json` each degrade to a notice with the rest of the app usable
  (data-model SS3, SS6)

### Implementation

- [x] T073 [US5] Record `meta.expected.notices` for every item that produces one, with a one-line
  reason in the sidecar's `note`
- [x] T074 [US5] `tools/library/probe.ts` - sweep a folder and print the numbers a new item's row
  needs plus its first page as SVG (the `tests/tools/probe-real-scores.ts` pattern), and document it
  in `quickstart.md`
- [x] T075 [US5] Extend `tests/e2e/library.spec.ts` with a Verovio engraving check over a sample of
  items (page counts recorded), so an engraving regression on real content is caught

**Checkpoint**: all five stories work; the shelf defends the parser as well as the musician.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T076 [P] `docs/musicxml-support.md` - update only if authored content changed what we claim to
  support; otherwise record "no change" in the log
- [ ] T077 [P] `README.md`, `quickstart.md` and `docs/agents/reference.md` R7 - add `pnpm
  library:exercises` and `pnpm library:index` to the command lists
- [ ] T078 [P] Size budget: record the actual `du -sh public/library` figure in the log; the budget
  itself is now asserted by the library suite (T067), so this is a report, not the gate (analyze A7)
- [ ] T079 [P] Performance: confirm SC-007 (list <= 1 s for 200 items, filter <= 200 ms) against the
  real index and the synthetic 200-item one, and that no task exceeds 50 ms while browsing
- [ ] T080 `constitution-auditor` review of the whole branch
- [ ] T081 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` - all green
- [ ] T082 Walk `quickstart.md` end to end (all five stories); have `music-domain-expert` re-level a
  random sample of the finished shelf blind and record the agreement rate against SC-006's 90%
  (analyze A6); then write the closing `implementation-log.md` entry

---

## Dependencies & Execution Order

- **Phases**: Setup -> Foundational -> US1 -> US2 -> US3 -> US4 -> US5 -> Polish.
- **Within a story**: tests -> core -> engine -> UI -> content -> review -> reindex.
- **Hard dependencies**:
  - **T083 comes before any suite under `tests/library/`** (T017, T067, T071, T084), or they will
    appear to pass while never running.
  - T007 needs T005 + T006; T009 needs T008.
  - Everything in US1 needs T006-T012.
  - T018 (index generator) needs T009 (facts); T019-T024 need T010-T012.
  - T030 (commit the index) needs T018 and all of T025-T029.
  - T031 (e2e) needs T023 and at least one shipped item.
  - US2's generator (T037-T042) needs T036 (the writer), which needs T032; T085 needs the generated
    set for all 24 keys (T040); T086 is independent once T036-T037 exist.
  - T050 (levelCheck in the generator) needs T048; T051-T052 need T049.
  - Every content task in US3 depends on US1's machinery only for *verification*, not for authoring -
    the files can be written before the filters exist.
  - T067 (licence test) needs content to exist: run it from US1 onwards, tighten it in US4.
  - T071 (sweep) is most useful once US2 and US3 content exists, but is written first and grows.
- **Story independence**: US1 stands alone (browse + open + 4 items). US2 adds the exercise shelf.
  US3 adds levels, filters and the repertoire build-out. US4 and US5 are checks over whatever exists.

## Parallel Opportunities

- **Setup**: T002, T003, T004 together (after T001); T083 is independent of all of them.
- **Foundational**: T005 + T006 + T008 + T010 + T011 + T012 - six different files, no shared state.
- **US1 tests**: T013-T017 and T084 together, before any implementation.
- **US1 content**: T027 and T028 in parallel with T026 (different files); T022 alongside T020-T021.
- **US2 tests**: T032-T035 together; T085 after T040, since it reads the generated set.
- **US3 tests**: T045-T047 together; content batches T053-T055, T057-T059 and T061-T063 are each
  internally parallel (one file per piece) - but their reviews (T056, T060, T065) are not.
- **Polish**: T076-T079 together.
- **Lanes** (only if the owner assigns them, AGENTS.md R6): the natural split is
  *machinery* (US1 + US3 code) against *content* (US2 definitions + US3 repertoire), which touch
  disjoint files apart from `index.json` - regenerate it once, at the end of each lane's work.

## Suggested MVP scope

**US1 only** (T001-T004, T083, T005-T031, T084): a musician with no file of their own can open the app, browse the shelf and
play Für Elise, in the browser and under the desktop shell, with the item's provenance on screen.
Everything after that widens the shelf or hardens the checks.

**Totals**: 86 tasks - Setup 5, Foundational 8, US1 20, US2 15, US3 22, US4 4, US5 5, Polish 7.
T083-T086 were added after `/speckit.analyze` (findings A1, A2, A8, A14) and keep new numbers rather
than renumbering the rest.
