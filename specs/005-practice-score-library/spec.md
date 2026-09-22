# Feature Specification: Practice Score Library

**Feature Branch**: `005-practice-score-library`
**Created**: 2026-09-22
**Status**: Draft
**Input**: User description: "build some base of tracks. Put them in folders for now. Probably we should have folder like learning -> chords -> Cmajor, cminor... cmajor to cminor etc (combination of few chords). And other folders if tracks. Like difficulty begginer, medium, advance (I want fur elise in it somwhere :), + many others. Try to find some legit musical xmls or other formats (compatible with the app), that will produce real looking scores. Try to find learning or create by yourself. Suggest something more. Make sure if we download tracks from somwhere, they are open-source, or other licences, so we will be able to put them into the app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the app and find something to play (Priority: P1)

A musician opens Musicanyya for the first time. They have no MusicXML file of their own and no idea
where to get one. Instead of an empty window, they see a library of practice Scores grouped in
folders - *Learning* and *Repertoire*, and inside *Repertoire* the levels *Beginner*,
*Intermediate* and *Advanced*. They open *Repertoire > Intermediate > Fur Elise*, the Score is
engraved like a printed page, and Listen mode plays it.

**Why this priority**: without material, every other mode of the app is unreachable for a new user.
One browsable shelf of playable Scores is the whole value of this feature; everything else refines
it.

**Independent Test**: start the app with no user file, browse to a library item, open it and press
Listen - the Score engraves and plays, exactly as a dragged-in file would.

**Acceptance Scenarios**:

1. **Given** a fresh app with no user files, **When** the musician opens the library, **Then** the
   folder structure (*Learning*, *Repertoire > Beginner / Intermediate / Advanced*) and the items in
   each folder are listed with title, composer and difficulty.
2. **Given** the library list, **When** the musician selects *Fur Elise*, **Then** the Score opens
   in the score view and Listen, Practice and Play modes all work on it.
3. **Given** a library item is open, **When** the musician looks for its origin, **Then** the item's
   source and licence (or "written for Musicanyya") are visible without leaving the score view.
4. **Given** the app has been loaded once, **When** the musician goes offline and reopens the app,
   **Then** the library still lists and opens its items.
5. **Given** any library item, **When** it is opened, **Then** no load error is shown and the Score
   engraves on the first page within the same time budget as any other Score of that size.

---

### User Story 2 - Practise chords in every key (Priority: P2)

A learner wants to drill chords. Under *Learning > Chords* they find one exercise per key - C major,
G major, ... , C minor, A minor, ... - each built the same way, and a second group of
*chord-change* drills that move between a few chords (C - F - G - C, C major - C minor, i - iv - V
- i). They pick one, switch to Practice mode, and the app waits for each chord until they play it.

**Why this priority**: chord and chord-change drills are the material the app's Practice (wait) mode
was built for, and they are the part a learner repeats daily. They depend on the library existing
(P1) but deliver value on their own.

**Independent Test**: open *Learning > Chords > C major*, switch to Practice mode, play the written
chords - the app advances chord by chord and marks each one; then open the same exercise in D major
and confirm it is the same exercise transposed, with the same structure and fingering logic.

**Acceptance Scenarios**:

1. **Given** the *Learning > Chords* folder, **When** the learner lists it, **Then** there is one
   exercise per major key and one per minor key, each named by its key.
2. **Given** two key exercises of the same quality, **When** they are compared, **Then** they have
   the same number of measures, the same chord positions, the same rhythm and the same fingering
   convention - only the key differs.
3. **Given** a chord-change drill, **When** it is opened, **Then** it moves between 2-4 named chords
   and states which chords it trains.
4. **Given** any Learning exercise, **When** it is engraved, **Then** every note carries a fingering
   mark.
5. **Given** a chord exercise in Practice mode, **When** the learner plays a chord with the notes
   slightly spread, **Then** the app accepts it as one chord (existing Practice rules apply
   unchanged).

---

### User Story 3 - Levels that actually mean something (Priority: P2)

A returning user wants a piece just above what they can already play. The three levels are not
labels someone guessed: each level has written criteria (range, hands together or separate,
shortest note value, tempo, key signatures, length), and every piece in the level meets them. Each
item also says what it trains, so the user can pick "beginner, both hands, needs steady eighths".

**Why this priority**: a library the user cannot navigate by difficulty is a folder dump. This turns
the shelf into a path.

**Independent Test**: read the published criteria for *Beginner*, then check every Beginner item
against them - all pass; a piece that breaks one criterion is either re-levelled or not shipped.

**Acceptance Scenarios**:

1. **Given** the library, **When** the user opens the level description, **Then** each level lists
   its objective criteria in plain language.
2. **Given** any item, **When** its details are shown, **Then** they include composer, key, time
   signature, tempo, measure count, approximate duration, hands used and skill tags.
3. **Given** the library list, **When** the user filters by level, key or skill tag, **Then** only
   matching items remain.
4. **Given** an item assigned to a level, **When** it is checked against that level's criteria,
   **Then** it satisfies every criterion.

---

### User Story 4 - Everything on the shelf is legally clear (Priority: P2)

The owner must be able to publish the app - online and, later, packaged - without a licensing
question on any bundled Score. Every item is either public domain / CC0, under a licence that
permits redistribution and commercial use, or written for this project; every downloaded item
records where it came from, when, and under which licence; nothing ships without that record.

**Why this priority**: an item with an unclear licence cannot be published at all, so this gates the
release of the whole library, but it does not block building and testing the library first.

**Independent Test**: run the library check - it lists every item with its licence and attribution,
and fails if any item lacks provenance, carries a non-permitted licence, or is missing its file.

**Acceptance Scenarios**:

1. **Given** a downloaded item, **When** it is added, **Then** its source URL, date obtained,
   licence and required attribution are recorded with it and in the project's third-party notices.
2. **Given** an item whose licence cannot be established, **When** the library is assembled,
   **Then** the item is not included and the reason is recorded.
3. **Given** an item that requires attribution, **When** it is shown or opened, **Then** its
   attribution text is visible to the user.
4. **Given** the library, **When** the check runs, **Then** a missing, empty or placeholder file
   fails it.

---

### User Story 5 - The library keeps the app honest (Priority: P3)

Every library item is also a real-world Score: exports from notation programs, with the notation
quirks that hand-written fixtures never have. The app is checked against the whole library, so a
parsing or engraving regression that only real files expose is caught before a user meets it.

**Why this priority**: valuable and cheap once the library exists, but it improves confidence rather
than delivering user-facing function.

**Independent Test**: sweep every library item - each one loads, engraves and produces a playable
timeline; any load notice is one that is recorded as expected for that item.

**Acceptance Scenarios**:

1. **Given** the full library, **When** every item is loaded, **Then** none fails and none hangs.
2. **Given** an item that uses notation the app does not yet support, **When** it is loaded,
   **Then** the unsupported part is reported as a notice, the rest plays, and the notice is
   recorded as expected for that item.
3. **Given** a newly added item, **When** it is not recorded in the library index, **Then** the
   check fails rather than the item silently disappearing.

---

### Edge Cases

- A library item's file is missing, truncated or not valid MusicXML: the library still lists and
  opens every other item; the broken item reports a clear error and the library check fails in
  development.
- A downloaded export uses notation beyond the supported subset (cross-staff beaming, ossia,
  unusual repeats, percussion staves): it degrades gracefully; if the result misrepresents the
  music, the item does not ship.
- Very long or dense advanced pieces (hundreds of measures, many parts): browsing stays responsive
  and opening stays within the app's existing large-score budget; if an item cannot meet it, it is
  marked as such rather than shipped silently.
- Two items with the same title by different arrangers, or several arrangements of *Fur Elise* at
  different levels: each is distinguishable in the list by level and arranger.
- Non-ASCII titles and composer names (*Fur Elise*, *Zyczenie*, Japanese titles) are listed,
  sorted and opened correctly.
- The MIDI controller is unplugged while a library item is open: unchanged behaviour - the item
  stays open, Listen continues, Practice explains the missing device.
- The user has their own file open with unsaved session state and then picks a library item: the
  switch is explicit, and the library item is never written to.
- The library grows: adding items must not slow the list or force a code change.
- An item's upstream source changes or disappears after it was obtained: the bundled copy and its
  recorded provenance remain valid.

## Requirements *(mandatory)*

### Functional Requirements

**Content and organisation**

- **FR-001**: The app MUST ship with a built-in library of practice Scores that a user can open
  without supplying a file of their own.
- **FR-002**: The library MUST be organised as a folder hierarchy with at least two top-level
  sections - *Learning* (exercises) and *Repertoire* (pieces) - and *Repertoire* MUST be divided
  into *Beginner*, *Intermediate* and *Advanced*.
- **FR-003**: *Learning* MUST contain a *Chords* group holding one chord exercise for each of the
  12 major keys and each of the 12 minor keys, named by key.
- **FR-004**: *Learning > Chords* MUST also contain chord-change drills, each moving between 2-4
  named chords (including at least one major-to-minor change on the same tonic and at least one
  I-IV-V-I progression), and each MUST state which chords it trains.
- **FR-005**: All chord exercises of the same kind MUST share one structure - same measure count,
  chord positions, rhythm and fingering convention - so that only the key differs between them.
- **FR-006**: Every *Learning* exercise MUST carry a fingering mark on every note, and MUST be
  written for both hands on a grand staff unless the exercise is explicitly hands-separate.
- **FR-007**: *Repertoire* MUST contain Beethoven's *Fur Elise*; if only an arrangement meets a
  level's criteria, the arrangement MUST be labelled as such.
- **FR-008**: *Repertoire* MUST contain at least 15 pieces - at least 6 *Beginner*, at least 5
  *Intermediate* and at least 4 *Advanced* - covering more than one composer and more than one key
  signature per level.
- **FR-009**: Each difficulty level MUST have written, objective criteria (pitch range, hands
  together or separate, shortest note value, tempo range, number of key-signature accidentals,
  length), and every item in a level MUST satisfy that level's criteria.

**Metadata and navigation**

- **FR-010**: Every library item MUST carry: title, composer or author, arranger (if any),
  difficulty level, key, time signature, tempo, measure count, approximate duration, hands used,
  skill tags, and provenance (source, date obtained, licence, required attribution - or "written
  for Musicanyya").
- **FR-011**: Users MUST be able to browse the library in the app, grouped by its folder structure,
  in every Shell (browser and Electron). [NEEDS CLARIFICATION: does the first release include an
  in-app library browser, or only the folder structure plus the existing Open dialog ("put them in
  folders for now")?]
- **FR-012**: Users MUST be able to narrow the list by section, difficulty level, key and skill
  tag.
- **FR-013**: Opening a library item MUST give exactly the same behaviour as opening a user's own
  file: the same engraving, the same stable Note IDs, and Listen, Practice and Play all available.
- **FR-014**: The library MUST remain listable and openable offline once the app has been loaded.
- **FR-015**: Library items MUST be read-only: opening, practising or grading one MUST never modify
  it, and user-opened files MUST stay distinguishable from library items.
- **FR-016**: The library MUST be extensible by content alone - adding an item means adding its
  file and its index entry, with no change to application behaviour.

**Licensing and provenance**

- **FR-017**: Every library item MUST be public domain / CC0, under a licence that permits
  redistribution and commercial use without a share-alike obligation, or written for this project.
  [NEEDS CLARIFICATION: is attribution-required (CC BY) material acceptable in the bundled library,
  or CC0 / public domain / own work only?]
- **FR-018**: An item whose licence cannot be established MUST NOT ship, and the reason MUST be
  recorded.
- **FR-019**: Users MUST be able to see an open item's licence and attribution from the score view.
- **FR-020**: Every downloaded item MUST be recorded in the project's third-party notices with its
  source, date obtained and licence.
- **FR-021**: No item may be a placeholder: empty, truncated, silent or dummy files MUST NOT be
  included, and the library MUST NOT claim material it does not contain.

**Quality**

- **FR-022**: Every library item MUST load, engrave and produce a playable timeline end to end
  without a load error.
- **FR-023**: Any load notice an item produces (an unsupported or skipped element) MUST be recorded
  as expected for that item; a new, unrecorded notice MUST be treated as a regression.
- **FR-024**: An item whose notation the app cannot represent faithfully MUST NOT ship, even if it
  loads without an error.
- **FR-025**: The library MUST be verifiable automatically: a check MUST fail when an item is
  missing, unlisted, unlicensed, without required metadata, or no longer loads.
- **FR-026**: The bundled library MUST stay within a size budget that keeps the app's first load
  fast; items beyond that budget MUST be left out rather than shipped.

### Key Entities

- **Library**: the complete set of bundled practice Scores and the folder structure they are shown
  in.
- **Section / Folder**: a named node of that structure (*Learning*, *Learning > Chords*,
  *Repertoire > Beginner*, ...), with a description of what it holds.
- **Library item**: one Score in the library, with its metadata, its level, its skill tags and its
  provenance record.
- **Difficulty level**: *Beginner*, *Intermediate* or *Advanced*, each with published objective
  criteria an item must satisfy.
- **Skill tag**: what an item trains (e.g. "chord changes", "steady eighths", "hands together",
  "arpeggios", "pedal", "sight-reading") - used for filtering and, later, for suggestions.
- **Provenance record**: where an item came from - source, date obtained, licence, attribution text
  - or the statement that it was written for this project.
- **Exercise family**: a group of Learning items that are the same exercise in different keys, so
  that structure and fingering stay consistent across the family.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user with no file of their own goes from opening the app to hearing a
  Score in Listen mode in at most 3 interactions and under 15 seconds.
- **SC-002**: 100% of library items load, engrave and play end to end; a sweep of the whole library
  reports zero load errors and zero unrecorded load notices.
- **SC-003**: 100% of library items have complete metadata and a provenance record; the library
  check fails if any item does not.
- **SC-004**: The library contains at least 24 chord exercises (12 major, 12 minor keys) and at
  least 12 chord-change drills, all following one structure per exercise family.
- **SC-005**: *Repertoire* contains at least 15 pieces spread over the three levels (>= 6 / >= 5 /
  >= 4) and includes *Fur Elise*.
- **SC-006**: 100% of items satisfy the published criteria of the level they are assigned to, and a
  musician reviewing the library independently agrees with at least 90% of the level assignments.
- **SC-007**: The library list appears within 1 second for a library of 200 items, and filtering it
  gives a result within 200 ms.
- **SC-008**: The bundled library adds no more than 10 MB to the app download, and browsing or
  opening it never blocks the main thread for more than 50 ms at a time.
- **SC-009**: Every downloaded item is traceable: for each one, a reader of the notices file can
  find the original source and confirm its licence.
- **SC-010**: The library works identically in the browser and Electron Shells, including offline
  after the first load.

## Assumptions

- The learner's instrument is piano (grand staff, 88 keys); Learning exercises are written for
  piano. Repertoire may include other instrumentation where it is playable on a keyboard, but
  piano-playable material comes first.
- The library ships **with** the app (bundled content, offline by default) rather than being
  fetched from a server on demand; a downloadable extension library is a later feature.
- The three levels the owner named map to *Beginner*, *Intermediate* ("medium") and *Advanced*;
  finer grading (e.g. ABRSM/RCM grades) may be added later as an extra attribute, not as a
  replacement.
- Chord exercises stay consistent across all keys by being produced from one exercise definition
  rather than written twenty-four times by hand; they are committed as ordinary Score files so they
  behave like every other library item.
- "Compatible formats" means what the app already reads: MusicXML (`.musicxml`, `.xml`) and
  compressed MusicXML (`.mxl`). Nothing in the library requires a new input format.
- Sources considered licence-clean for downloads, subject to FR-017: OpenScore (CC0 transcriptions
  of public-domain works, already used for this project's fixtures), the MusicXML specification's
  own example files (W3C licence), public-domain engravings the project converts itself, and
  CC0-only subsets of public MusicXML collections. Per-score licensing on general score-sharing
  sites is checked score by score, never assumed from the site.
- Being in the public domain as *music* (Beethoven) does not make a particular *engraving* free;
  the licence of the file itself is what is recorded and respected.
- Listing, filtering and opening the library are the scope here; tracking which items a user has
  practised is a separate feature.

## Suggested additions *(recommended, to be confirmed as scope)*

Beyond chords and graded repertoire, the material that earns its place fastest:

- **Learning > Scales and arpeggios**: one exercise per key, same family treatment as chords -
  the other half of daily technique, and the natural companion of the chord drills.
- **Learning > Intervals and cadences**: two-note interval drills and cadence patterns
  (perfect, plagal, interrupted) - short, and directly useful for reading.
- **Learning > Five-finger positions**: the first thing an absolute beginner can play, before any
  piece.
- **Learning > Rhythm**: single-pitch rhythm patterns for Play mode, where only timing is graded.
- **Repertoire, public-domain classics** to fill the levels: Bach's *Notebook for Anna Magdalena*
  minuets, Burgmuller Op. 100, Czerny Op. 599, Schumann *Album for the Young*, Satie
  *Gymnopedies*, Clementi sonatinas, and traditional melodies for the first Beginner steps.
- **Sight-reading sets**: short unseen pieces grouped by level, meant to be played once.
- **A suggested path**: an ordering through the library ("what to play next") built from levels and
  skill tags.
- **Advice files per item** (Principle VII): fingering and practice tips anchored to Note IDs -
  the library is what makes Advice worth authoring.

## Out of Scope

- Copyrighted or licence-unclear repertoire, including modern popular music.
- User-managed libraries: importing a folder, organising personal collections, cloud sync.
- Score editing, transposition on demand, or arranging inside the app.
- Automatic difficulty estimation of arbitrary Scores.
- Progress tracking, streaks, curriculum sequencing and recommendations (the "suggested path" above
  is listed as a candidate, not committed here).
- A server-hosted or downloadable extension library.
- New input formats (MIDI files, ABC, PDF scans, audio).
