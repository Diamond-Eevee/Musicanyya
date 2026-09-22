# Phase 0 Research: Practice Score Library

Feature `005-practice-score-library`. Everything here was checked on **2026-09-22** unless stated.
Facts about external corpora were verified against the source (GitHub API / raw files), not recalled.

---

## R-1. Where the content comes from, and which sources fail the licence bar

**Decision**: the library is **content this project authors**, from public-domain music, with
**OpenScore** as the only external corpus trusted for bundled items. Concretely:

| Tier | What | Licence |
|---|---|---|
| A | All *Learning* exercises - 24 per-key chord exercises and the chord-change drills - generated from our own definitions (R-7) | Our own work, CC0 |
| B | All *Repertoire* items - short public-domain works engraved by us as MusicXML, and our own arrangements of public-domain melodies (labelled as arrangements, FR-007) | Music: public domain. Engraving: our own work, CC0 |
| C | Anything from **OpenScore** (`github.com/OpenScore/Lieder`, `github.com/OpenScore/StringQuartets`) that fits a level | CC0-1.0, verified per file |
| D | Any file the **owner** verifies as CC0 in their own browser and hands over | CC0, recorded per file |

**Rationale**: the owner's rule (spec FR-017) is CC0 / public domain / own work only. Searching for a
fetchable corpus that meets it produced exactly one: OpenScore, which this repository already uses for
its real-score fixtures, is CC0-1.0 at the repository level *and* carries `<rights>OpenScore (CC0)</rights>`
plus an IMSLP source link inside every file. Its contents, however, are **Lieder and string quartets
only** - the GitHub organisation has no other data repository - so it cannot supply solo piano
repertoire. Nothing else reachable from here clears the bar, so authoring is not a preference, it is
the only remaining route. It also answers the owner's own suggestion ("try to find learning or create
by yourself").

**Alternatives considered (all rejected, with the reason):**

| Source | Finding | Verdict |
|---|---|---|
| `github.com/musetrainer/library` ("Public domain MusicXML files", ~69 `.mxl`, includes four *Fur Elise* files - and is where the owner's `Fur_Elise_Easy_Piano.mxl` came from: the filename matches byte for byte) | **No LICENSE file** (top level is `.vscode`, `README.md`, `index.html`, `poetry.lock`, `pyproject.toml`, `scores`, `scripts`), no per-score provenance - `scripts/generate.py` only reads each file's `<work-title>` to build a listing. The "public domain" claim is a README heading. The set contains material that is plainly **still in copyright**, e.g. `Mariage_dAmour.mxl` (Paul de Senneville, 1979) and `Bella_Ciao_-_La_Casa_de_Papel.mxl` | **Rejected.** A blanket claim contradicted by its own contents cannot be relied on for anything we ship |
| **PDMX** (`github.com/pnlong/PDMX`, Zenodo record 15571083) - 250k+ MuseScore scores presented as CC0 | Licence evidence is scraped MuseScore metadata, and the authors themselves report a conflict between the public-facing copyright metadata and the file's internal data for **12.29%** of songs (they recommend the `no_license_conflict` subset). Distribution is the whole dataset from Zenodo; no documented per-score download | **Rejected as a content source.** Usable later only as a *lead* - to find a specific score id whose licence we then verify ourselves |
| `github.com/eduardomourar/music-scores-musicxml` (public-domain works typeset as MusicXML) | Repository licence is **CC-BY-SA-4.0** | **Rejected** by FR-017 (share-alike) |
| **IMSLP** | Overwhelmingly PDF scans; MusicXML/Finale uploads exist but carry per-file licences (often CC BY-SA or CC BY-NC) | Only usable one file at a time, when that file is explicitly PD/CC0. Not a corpus |
| **Mutopia Project** | Public-domain and CC0 editions, distributed as LilyPond source + PDF + MIDI. LilyPond has no MusicXML exporter (`musicxml2ly` converts the other way) | **Rejected**: no conversion path we would trust |
| **CPDL / ChoralWiki** | Genuinely offers MusicXML, but mostly CC BY / CC BY-SA, and choral rather than piano | **Rejected** by FR-017 and by instrument |
| **musescore.com** directly (incl. the CC0 *Open Goldberg Variations* and *Open Well-Tempered Clavier* editions, which really are CC0) | The site returns 403 to this environment (recorded during feature 001); licences are per score | **Not fetchable here.** A genuine Tier D route: the owner can open these in their browser, confirm the CC0 badge and hand the file over |
| Humdrum `**kern` corpora (`craigsapp/*`, `humdrum-tools/humdrum-data`) - Beethoven/Mozart sonatas, Chopin, Joplin | Conversion is plausible (Verovio reads Humdrum), but the repositories carry **no SPDX licence** (`craigsapp/beethoven-piano-sonatas`, `chopin-mazurkas`: none; `mozart-piano-sonatas`, `joplin`: `NOASSERTION`) | **Rejected**: an unstated licence is not CC0, and a conversion step would add an engraving-fidelity question on top |

**Consequence for *Fur Elise* (FR-007)**: no CC0 file for it is obtainable from here. We engrave it
ourselves from the public-domain text (WoO 59) - the music is unquestionably public domain and the
engraving becomes our own CC0 work. R-9 covers how its accuracy is assured.

**Consequence for the repertoire count (FR-008, >= 15 pieces)**: authored repertoire arrives piece by
piece, so the count is the target for the finished feature rather than for P1. Raised as owner
decision **D-1** in `plan.md`.

---

## R-2. Where the files live and how both Shells reach them

**Decision**: `public/library/<section>/<...>/<item>.musicxml` plus `<item>.json` beside it, with a
generated `public/library/index.json`. The folder names are exactly the shelf the owner sketched
(`learning/chords/...`, `repertoire/beginner|intermediate|advanced/...`).

**Rationale**: Vite copies `public/` verbatim into `dist/`, and `electron/main.ts` serves `dist/`
through its `app://musicanyya/` handler - so one copy of the content reaches the browser build, the
dev server and the desktop shell with no packaging code. This is exactly how the 32 MB SoundFont
already ships (`public/soundfonts/`), which also proves `fetch` works under `app://`. Authoring in the
same folders the app serves means the "folders" the owner asked for *are* the shipped structure, with
no mapping step to get wrong.

**Alternatives considered**: `content/library/` copied by a build plugin (an extra moving part for no
gain; `content/` is reserved in the repo map for Advice JSON); the existing root `musicxml/` folder
(not served, so the browser could never read it - and its README explicitly frames it as
drag-in material, not app content); importing scores as ES modules through the bundler (puts every
score in the JS bundle, wrecking SC-008 and first load).

**Note**: `musicxml/chords/c-major-scale-and-chords.musicxml` moves into the library (owner decision
D-3) and `musicxml/README.md` keeps a pointer, so feature 002's reference Score does not vanish.

---

## R-3. How `index.json` is produced and kept honest

**Decision**: a dev script, `tools/library/build-index.ts` (`pnpm library:index`), walks
`public/library/`, reads each item's authored `.json` sidecar, **loads each score through the app's own
`readXml` + `buildScore`**, and writes `index.json` (contract v1.0.0) with both the authored metadata
and the derived facts (measure count, key, metre, tempo, duration, hands, note count, load notices,
byte size, content hash). A Vitest suite regenerates the index in memory and fails if the committed
file differs, if an item is missing, unlisted, unlicensed or no longer loads.

**Rationale**: FR-025 asks for a check that can fail; a generated artefact compared against the files
is the only version of that check which cannot rot. Deriving facts through the real loader means the
list can never disagree with what the app will show, and it makes every item pass the parser on every
CI run (FR-022, US5) - the same trick that made the real-score fixtures valuable.

**Alternatives considered**: a hand-maintained catalogue (drifts the first time anyone renames a file,
and then FR-025 checks nothing); enumerating the folder in the browser (impossible - no directory
listing over HTTP, and dozens of requests before the first paint); a server API (there is no server;
Principle VIII).

---

## R-4. What "offline" can honestly mean today

**Decision**: cache `index.json` and each fetched item in **Cache Storage**, reusing the
`soundfont-cache.ts` pattern (feature-detect `caches`, wrap every read and write in `try`/`catch`,
carry on without it - Chromium refuses Cache writes under `app://`). Items already opened also remain
in the existing IndexedDB `scores` store and open from the recents list with no network.

**Rationale**: the project has **no service worker** (`grep` over `src/`, `electron/`, `index.html`,
`vite.config.ts` finds none) and no web app manifest, so the *application shell itself* does not load
offline. Promising an offline library on top of a shell that cannot start offline would be a false
claim, and Principle VIII forbids building a PWA layer inside an unrelated feature.

**Alternatives considered**: adding a service worker here (a delivery-wide change with its own update
and cache-invalidation design - it deserves its own feature); bundling every score into the JS bundle
so it is "always there" (breaks SC-008 and the extensibility FR-016 asks for).

**Spec impact**: FR-014 and SC-010 overstate what is deliverable - owner decision **D-2**.

---

## R-5. Layering and the new port

**Decision**: a new port `LibraryCatalog` in `src/engine/ports.ts`:

```ts
interface LibraryCatalog {
  index(): Promise<CatalogResult<LibraryIndex>>;
  item(path: string): Promise<CatalogResult<ArrayBuffer>>;
}
```

with `src/engine/library/http-catalog.ts` as its `fetch` + Cache Storage adapter, and a fake in
`tests/fakes/`. `src/core/library/` holds the pure half: the index model and its validation, filters,
the level criteria and the fact derivation. `src/ui/elements/mx-library.ts` renders and emits an
`openlibraryitem` event that `session.ts` turns into the **existing** `loadBytes(fileName, bytes)`
call.

**Rationale**: Principle V - the core must run in Node with no `fetch` and no DOM, and every platform
capability sits behind a port. Reusing `loadBytes` is what makes FR-013 true by construction: a
library item and a dragged-in file travel the identical path, so Note IDs, the load report, Practice
and Play need no special case. `CatalogResult` mirrors the existing `StoreResult` shape so failure
handling in the UI is the one the app already has.

**Alternatives considered**: calling `fetch` straight from the custom element (breaks the port rule
and makes the UI untestable in Node); a second loader for library items (duplicates the riskiest code
in the app); putting the catalogue in the existing `ScoreStore` (that store is the user's own
recents - mixing read-only shipped content into it would blur FR-015).

---

## R-6. `.musicxml` or `.mxl` for bundled items

**Decision**: authored items are committed **uncompressed `.musicxml`**; items obtained from
OpenScore or the owner stay **byte-for-byte as received** (`.mxl`).

**Rationale**: the authored files are the ones we edit, review and diff - a zip container would make
every review opaque and every regeneration a binary churn. They are small (2-60 KB; the whole authored
shelf is well under 2 MB against a 10 MB budget), and HTTP `Content-Encoding` compresses them on the
wire anyway. For downloaded files the opposite argument wins: an unmodified copy is what the
provenance record claims, and `readMxl` already handles the container (it is exercised by the 18
real-score fixtures).

**Alternatives considered**: `.mxl` for everything (smaller, but unreviewable and it would force the
generator to produce zips); converting downloads to `.musicxml` (destroys "unmodified byte for byte",
which is the strongest provenance statement we can make).

---

## R-7. Generating the exercise families

**Decision**: each family is one **exercise definition** (`content/library/exercises/*.json`,
contract v1.0.0: metre, tempo, the chord degrees and their order, voicing and fingering per hand,
rhythm, bar count). `tools/library/build-exercises.ts` (`pnpm library:exercises`) transposes it to
each requested key through the pure code in `src/core/library/exercise/` and writes the `.musicxml` +
`.json` pair. Every generated file has a golden snapshot test; regenerating is expected to be a no-op
diff.

**Rationale**: FR-005 makes cross-key consistency a *requirement*. Twenty-four hand-written files are
consistent exactly once - until the first edit. Generation also makes the fingering rule, the key
spelling and the voicing decisions reviewable in one place, which is where the
`music-domain-expert` review belongs. It runs at build time, never in the app (Principle I, VIII).

**Alternatives considered**: generating in the browser on demand (runtime work for content that never
changes, and it would make every exercise invisible to the sweep test and to Verovio review);
hand-authoring all 24 (rejected above); MusicXML templating with string replacement (spelling in
remote keys is not a text substitution - see the expert's key-spelling rules in `data-model.md`).

A minimal writer (`src/core/musicxml/write.ts`) is needed because the project has a reader only. It is
kept to what the exercises use - `score-partwise`, parts, attributes, notes/chords, fingering - and is
covered by round-trip tests (write -> `readXml` -> `buildScore` gives the intended notes).

---

## R-8. Difficulty criteria a script can actually check

**Decision**: three levels, each defined by thresholds over derived `ItemFacts` (pitch range, hand
span, hands together/separate, shortest note value relative to the beat, tempo range, key-signature
accidentals, measure count and duration, notes per beat, and which notation is allowed). The exact
numbers are in `data-model.md` SS4, supplied by the `music-domain-expert` role. `checkLevel(facts,
level)` returns a per-criterion pass/fail, and the library check fails an item whose assigned level it
does not satisfy (FR-009).

**Rationale**: "Beginner" has to mean something checkable or the levels are decoration (spec US3).
Every criterion chosen is computable from the parsed Score; anything that is not (musical maturity,
expressive difficulty, how awkward a passage *feels*) is deliberately excluded from the machine check
and left to the expert review, and SC-006 keeps a human in the loop at 90% agreement.

**Alternatives considered**: an established syllabus (ABRSM/RCM grades) - better recognised, but the
official grade of a piece is not derivable from its notation, would have to be asserted per item, and
the owner asked for three levels; an ML difficulty estimator (a research project, and unexplainable -
Principle VI).

---

## R-9. Repertoire shortlist and how accuracy is assured

**Decision**: the shortlist in `data-model.md` SS5 favours **short** public-domain works (mostly under
40 bars, thin textures) precisely because we engrave them ourselves. Each authored piece passes three
gates before its task is ticked:

1. it loads with no error and no unrecorded notice, and its sweep row is committed (R-3);
2. a `music-domain-expert` review against the published text - pitches, rhythms, key and metre
   changes, repeats, and the fingering we add;
3. the owner hears it once in Listen mode (the quickstart's per-story script ends with this).

**Rationale**: hand-engraving is the one place this feature can put a wrong note on screen, which
Principle III treats as worse than no library at all. Short pieces bound the exposure, and the three
gates catch the two failure modes that matter (a mistyped pitch survives gate 1 but not gate 2; a
structurally wrong repeat survives gate 2 but not gate 3).

**Alternatives considered**: shipping long showpieces first (maximum wrong-note surface, minimum
practice value for a beginner); trusting an unverified download (R-1); deferring all repertoire until
a CC0 corpus appears (leaves the app with nothing to play, which is the problem this feature exists
to solve).

---

## R-10. Where the library appears in the UI

**Decision**: inside the existing **Scores** panel (`PanelId 'scores'`, menu group *Score*), above the
recents list: section tree -> filter chips (level, key, skill tag) -> item list -> item detail with
source and licence. No new panel id, no new menu entry. The empty state ("No score loaded...") gains a
second invitation that opens the same panel.

**Rationale**: feature 004 made every secondary tool a popover with `viewState.openPanel` as the
single source of truth and `closeForRun()` clearing it - so putting the shelf there inherits
non-modality, light dismiss, the Escape order and the "nothing but the Score during a run" guarantee
(Principle VI, SC-004 of feature 004) for free. It is also where a musician already looks for
"a score": the panel is literally called *Scores* and already holds recents.

**Alternatives considered**: a dedicated *Library* panel and menu entry (a second place to look for
the same thing, and one more entry in an overflow menu that feature 004 worked to keep short); a
full-screen library view (modal by nature - forbidden during a session, and it would fight the
score-first layout); a start screen before any Score is loaded (the app is deliberately score-first
and must keep working when a file is dropped on it).

---

## R-11. `facts.ts` reads the parsed XML document, not only the `Score` model (found during T009)

**Decision**: `src/core/library/facts.ts` takes the parsed `XmlDocument` (from `readXml`) alongside the
built `Score`, and reads `<key>`, `<time-modification>`, `<octave-shift>` and `<pedal>` from it
directly, in one document walk.

**Rationale**: the `Score` model (`src/core/score/model.ts`) has no key-signature field at all -
`build.ts` recognises `<key>` only to avoid an `unsupportedElement` notice and then discards it,
because key signature affects nothing about playback timing (Principle II: only the tempo map and
ticks matter there). The same is true for tuplets (no ratio is kept once ticks are computed), written
`<octave-shift>` (Correction B: the sounding pitch is already correct, so nothing needs the marking)
and `<pedal>` (not scheduled). Level criteria 9-11, 21 and 25-26 and the `keys`/`accidentals` facts
need exactly this information, so `facts.ts` reads it from the document the loader already parsed,
rather than widening `Score` - a type every other feature (grading, timeline, transport) also
constructs and relies on - for one consumer. `XmlDocument` from `@rgrove/parse-xml` is a data
structure, not a browser DOM, so this stays inside Principle V ("no DOM, no `fetch`, Node-testable");
`src/core/musicxml/build.ts` already parses the same structure in core.

**Alternatives considered**: adding `keySignatures: KeySignatureMark[]` (and similar) to `Score`,
mirroring `TempoMark` - rejected for now as a wider, riskier change touching a type four already-shipped
features depend on, for facts that only the library reads; revisit if a future feature also needs key
signature (e.g. Advice) and the duplication becomes real. Re-parsing the file a second time in
`tools/library/build-index.ts` instead of threading the doc through `facts.ts` - rejected, since the
generator already has the parsed document from `readXml` and passing it is free.
