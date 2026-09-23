# Implementation Plan: Library Fidelity Audit

**Branch**: `007-library-fidelity-audit` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/007-library-fidelity-audit/spec.md`

## Summary

Every one of the 58 library items gets an audit record that says what it claims to be, what it was checked
against, how, and what came of it. The records come with a report the owner can read. The checks are **mechanical
and repeatable**. Public-domain sources (Mutopia `.ly` + `.mid`) are committed unchanged, with their hashes, under
`content/library/sources/`. A dev-time fidelity tool reads the item, the source's MIDI and the source's LilyPond
into one exact-rational note model. It compares bars, repeats, pitch, onset, duration, spelling and grace notes,
and fails when a result differs from the recorded one.

Each source is read two independent ways: LilyPond's own MIDI output, and our reader of the `.ly`. That makes the
LilyPond reader trustworthy enough to also serve as the **converter**. Hand-written items that differ from their
source are replaced by a conversion rather than corrected by hand (FR-007).

Exercises get a theory check written without the generator's code (FR-013). Every method must first catch a planted
error (FR-017). Arrangements gain a `departures` list and a melody-quote check. `reviewedBy` must then name the
audit that ran.

Phase 0 already found real problems before any comparison:

- **Schumann Op. 68 No. 10**: its only machine-readable source, Mutopia 659, is **CC BY-SA 2.5**, so it fails the
  licence rule the item claims to meet. This is an owner decision.
- **Satie Gymnopédie No. 1**: the item's own note says bars 33-37 are "our own close", yet the item is labelled
  as not an arrangement.
- **Burgmüller Op. 100 No. 2**: it moves one bar's octave for the level, yet it is not labelled an arrangement.
- **Bach BWV 846**: its "verification" was one bar checked by eye.

## Technical Context

**Language/Version**: TypeScript (strict), Node 22+ for the tools; no browser code changes
**Runtime Dependencies**: none new. No npm package is added: the MIDI reader, the LilyPond reader and the rational
arithmetic are written here (research R3, R4)
**Storage**: files only. Sources are in `content/library/sources/<id>/` (committed, hashed). Records are in
`content/library/audit/<item-id>.json`. The report is `docs/library-audit.md`. Library items stay in
`public/library/`
**Testing**: Vitest (the `tools` and `library` projects already registered in `vitest.config.ts`), including
planted-error tests and an architecture test for the theory check's independence; Playwright unchanged (the
existing library e2e must stay green)
**Shells / Delivery Targets**: browser and Electron, unchanged except for one engine adapter.
`HttpLibraryCatalog` becomes network-first for the index and checks a cached item's hash against the index before
using it (FR-024, research R16, contract `library-port-1.1.md`), so corrected items reach browsers that already
cached the old ones. The desktop shell's `app://` origin has no Cache Storage and already fetches every time
**Target Browsers**: unchanged
**Performance Goals**: `pnpm library:fidelity` runs all 58 items in under 30 s on the reference machine. The
`tests/library/fidelity.test.ts` re-run stays inside the existing `library` project's budget
**Real-time Paths Touched**: none
**Constraints**: content licence rule (CC0 / public domain / own work only, FR-006). Item ids are stable (FR-020).
Every changed item passes the existing library gates (FR-021). No UI change (spec Out of Scope). Each new source
needs the owner's approval before it is committed (spec assumption, AGENTS.md section 6)
**Scale/Scope**: 17 repertoire items (research R11: 10 have a Mutopia PD machine-readable source, 1 has only a
CC BY-SA source, and the folk/traditional tunes use a mix of Mutopia PD hymn/guitar sources and PD scans) + 41
exercises; the longest source is about 110 bars

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.* Re-checked after Phase 1: **pass**, no
violations.

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | New code in AudioWorklet/plugin callbacks? | [x] N/A. No RT code touched; all new code is dev-time Node tooling. No RT review task needed |
| II | One Clock, Measured Latency | Integer ticks in core? Tolerances named? | [x] Pass. The core is unchanged. The comparator uses exact rationals from integer ticks (`data-model.md` §1) and has **no tolerances**, so there are no magic numbers. Per-source facts (`midiOrder`, `midiNoteTracks`) are recorded data, not constants |
| III | Score Fidelity, Engraving & Note Identity | One Score model? Verovio? Graceful degradation? | [x] Pass, and this feature is Principle III applied to content: "a practice app that shows the wrong note ... is worse than none". Items are read through the app's own `readXml` + `buildScore`. Replaced items keep their ids; their Note IDs change legitimately because their notes change, so the identity golden is re-captured **before** engraving completion and the engraved file compared against it (the T087 procedure). Converted files pass `pnpm library:engrave` and the engraving guard |
| IV | Test-First, Deterministic Grading | Tests first? Node? Golden tests? | [x] Pass. Every reader, the comparator and the theory check are test-first (tests in `tests/tools/`). Planted-error tests prove each method (FR-017). The fidelity test re-runs every record deterministically. The one grading golden that depends on library content (`furEliseThemeGrade`, `tests/fixtures/library-identity.json`) is re-captured only if that item's notes change, with the reason logged (research R14) |
| V | Layered, Framework-Free | core free of DOM? No frameworks? | [x] Pass. The FR-024 cache fix stays in the engine adapter behind the existing `LibraryCatalog` port (an optional `expectedHash` argument; the fake is updated), and `session.ts` only passes the index hash. New code lives in `tools/` (Node, no DOM). The only `src/` changes are the additive `write.ts` extension (dev-only, already guarded out of the bundle by `tests/architecture/layers.test.ts`) and one optional validated field in `src/core/library/index-model.ts`. A new architecture assertion keeps `tools/library/fidelity/theory.ts` independent of `src/core/library/exercise/` |
| VI | Musician-First Feedback | - | [x] N/A. No UI change. Titles, subtitles and `limitations` (already shown) carry the honest labels |
| VII | Pedagogy as Data | - | [x] Pass. Audit records and source manifests are schema-validated JSON (contracts). Invalid ones fail the tool loudly: this is dev data, not runtime Advice, so failing is right here |
| VIII | Simplicity, Web-First | Web APIs before libraries? New deps justified? | [x] Pass. No new dependency (research R3, R4 reject `@tonejs/midi`, `midi-file` and python-ly). P1 (US1) delivers value alone: the originals are verified or replaced. The LilyPond reader is scoped to the constructs the audited sources use, and fails loudly on anything else |

## Project Structure

### Documentation (this feature)

```text
specs/007-library-fidelity-audit/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # Phase 0: sources, methods, per-item inventory
|-- data-model.md        # reference score, sources, comparison, theory rules, records
|-- quickstart.md
|-- contracts/
|   |-- source-manifest.md      # content/library/sources/<id>/source.json v1.0.0
|   |-- audit-record.md         # content/library/audit/<item-id>.json v1.0.0 + report format
|   |-- fidelity-tools.md       # commands, module interfaces, LilyPond subset, self-tests v1.0.0
|   |-- library-index-1.1.md    # sidecar change 1.0.0 -> 1.1.0 (departures, reviewedBy meaning)
|   `-- library-port-1.1.md     # LibraryCatalog 1.0.0 -> 1.1.0 (network-first index, hash-checked item cache)
`-- tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
tools/library/fidelity/          # NEW, dev-time, Node only
|-- time.ts                      # exact QuarterTime rationals
|-- midi.ts                      # Standard MIDI File reader -> ReferenceScore
|-- from-musicxml.ts             # item -> ReferenceScore via src/core/musicxml readXml + buildScore
|-- compare.ts                   # aspects, alignment, differences, melody quote
|-- theory.ts                    # independent exercise check (no import of src/core/library/exercise)
|-- exercise-claims.ts           # per-family Roman-numeral claims, written from titles/descriptions
|-- sources.ts                   # source manifests: validate + re-hash
|-- records.ts                   # audit records: validate + re-run
|-- report.ts                    # docs/library-audit.md renderer
`-- cli.ts                       # pnpm library:fidelity
tools/library/lilypond/          # NEW, dev-time
|-- lex.ts, parse.ts, read.ts    # LilyPond subset -> LyScore -> ReferenceScore
|-- to-musicxml.ts               # converter via src/core/musicxml/write.ts
`-- cli.ts                       # pnpm library:convert-ly
src/core/musicxml/write.ts       # EXTENDED additively: repeats/endings, grace, tuplets, octave-shift, mid-piece
                                 #   clef/key/time, 16th/32nd, slurs, dynamics, pedal, tempo (dev-only, guarded)
src/core/library/index-model.ts  # accepts + validates optional `departures` (contract 1.1.0)
src/core/library/types.ts        # `departures?: string[]` on item meta
src/engine/ports.ts              # LibraryCatalog.item(file, expectedHash?) (contract library-port-1.1.md)
src/engine/library/http-catalog.ts  # network-first index; cached item used only when its hash matches (FR-024)
src/app/session.ts               # passes the index entry's hash when opening a library item
tests/fakes/fake-library-catalog.ts # accepts and records expectedHash
tests/engine/library/http-catalog.test.ts, tests/engine/session-library.test.ts  # EXTENDED (FR-024, SC-010)
content/library/sources/         # NEW: README.md + one folder per approved source (.ly, .mid, source.json)
content/library/audit/           # NEW: one record per item (58, mirrors public/library ids)
public/library/**                # replaced / relabelled items and sidecars; README rejected-items rows
docs/library-audit.md            # NEW, generated report
THIRD_PARTY_NOTICES.md           # new sources (converted-from and reference)
package.json                     # scripts library:fidelity, library:convert-ly
tests/tools/fidelity/            # NEW: time, midi, from-musicxml, compare, theory, planted, report
tests/tools/lilypond/            # NEW: one test per construct in contracts/fidelity-tools.md §3.1, cross-check
tests/library/fidelity.test.ts   # NEW: coverage, re-run, outcome/claim/reviewer rules, report freshness
tests/library/licence.test.ts    # EXTENDED: arrangement => departures; downloaded => notices (unchanged)
tests/architecture/layers.test.ts  # EXTENDED: fidelity/lilypond never imported by the app; theory independence
tests/fixtures/library-identity.json  # re-captured for replaced items only (research R14)
tests/fixtures/lilypond/         # NEW: tiny hand-written .ly fixtures, one construct each (CC0, own work)
```

**Structure Decision**: all audit logic is dev tooling in `tools/`, next to the existing library tools
(`build-index`, `engrave`, `identity`), and runs in Node like them. It does not belong in `src/core`: the app never
compares a Score against a source, and keeping it out of `src/` keeps the shipped bundle and the layer rules
unchanged. The one shared piece is the MusicXML writer, which already lives in `src/core/musicxml/write.ts` as
dev-only code. It is extended there rather than duplicated, so converted pieces and generated exercises come from
one writer. The existing exercise goldens are the guard that exercise output does not change.

## Complexity Tracking

No constitution violation. Two additions need a reason:

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Own LilyPond-subset reader and converter (`tools/library/lilypond/`) | FR-007 requires replacing differing items by a **conversion** of the source. FR-005 requires comparing repeats and bar structure, which the MIDI does not carry. The Für Elise conversion was a one-off script outside the repository, so it cannot be re-run (FR-016) | python-ly `ly musicxml`: GPL, Python toolchain, documented as incomplete (no repeats/voltas output). Installing LilyPond to unfold MIDI: a GPL toolchain on every agent's machine, and it still gives no MusicXML. Hand-correcting items: FR-007 forbids it and it repeats the Für Elise failure mode. MIDI-only: no bars, repeats or spelling (research R4) |
| Committed third-party source files (`content/library/sources/`) | FR-016 and SC-003: re-running a check must reproduce the result offline and deterministically. Downloads change or vanish | Re-downloading at test time is network-dependent and not reproducible. Recording only URLs cannot prove the result (research R1). Files are small (Mutopia `.ly` + `.mid` are about 5-60 KB each) and public domain. Each needs owner approval |

## Phase 0: Research (`research.md`)

Done. It covers:

- R1 source storage
- R2 two independent readings per source
- R3 the MIDI reader
- R4 the LilyPond reader/converter
- R5 comparison semantics against LilyPond MIDI (grace notes, ties, ottava, folded repeats)
- R6 repeats and played order
- R7 melody quotes in arrangements
- R8 the theory check's independence
- R9 records, report and `reviewedBy`
- R10 the replace-first rule and level handling
- R11 the per-item source inventory, verified on the Mutopia piece pages on 2026-09-23
- R12 planted errors
- R13 the writer extension
- R14 goldens that depend on library content
- R15 folk/traditional tune versions and edition decisions (with the music-domain-expert's findings)
- R16 delivering corrected items to browsers that cached the old ones (added after analyze A1)

## Phase 1: Design

Done. The outputs are `data-model.md`, `contracts/` (4 files), `quickstart.md`, and the Active Technologies / Recent
Changes entries in `docs/agents/reference.md`. The Constitution Check was re-run after design: pass.

## Owner decisions (ask once, at the start of implement)

| # | Decision | Facts | Recommendation | What each answer leads to |
|---|---|---|---|---|
| D-1 | Approve the sources in research R11 table A (Mutopia public-domain `.ly` + `.mid`, committed unchanged under `content/library/sources/`, listed in `THIRD_PARTY_NOTICES.md`) | Each Mutopia piece page states "Copyright: Public Domain". All the files together are well under 1 MB | Approve all of table A in one go | **Yes**: US1 proceeds for all of them. **Per-source no**: that item has no machine-readable source; it gets a visual check against a PD scan, or is removed (FR-009) |
| D-2 | Schumann Op. 68 No. 10 (`repertoire/intermediate/schumann-op68-no10`) | Its sidecar says its notes were "extracted programmatically from Mutopia's rendered MIDI". Mutopia 659 is **CC BY-SA 2.5**, not PD/CC0. No other machine-readable Op. 68 No. 10 is on Mutopia (searched 2026-09-23) | **Remove** it (FR-009; rejected-items row: "only machine-readable source is CC BY-SA 2.5; item derived from it"). Report the Intermediate gap (FR-022). A clean replacement is new content, which is out of scope | **Remove**: Intermediate may drop below 5 (see D-3), and the gap is reported, not filled. **Keep**: the owner accepts that note data taken from a CC BY-SA file is not a licence problem for a PD work. The item is then checked mechanically against 659, and its provenance says so honestly. **Re-engrave from a PD scan**: an own-work transcription checked visually; allowed, but it is new hand-written music (the failure mode this feature addresses) |
| D-3 | Level minimums after the audit (FR-022) | Removal (D-2) or a faithful replacement that computes to a different level (Burgmüller No. 2's written leap, R10) can leave Intermediate below 5 | Accept that the gap is **reported** in the audit report and in the hand-off, and filled by a later feature | The spec already requires this; the owner only confirms that a temporary shortfall is acceptable on `main` |
| D-4 | Show `departures` in the app (follow-up, not this feature) | The field is shipped in `index.json` but not displayed; UI changes are out of scope | Record it as a follow-up for the next UI feature | No effect on this feature |

## Open questions (not blocking)

- **Recents keep the old copy** (analyze A2, spec Clarifications). `IndexedDbScoreStore` stores the bytes a
  musician opened, keyed by content hash. Reopening a replaced item from Recents shows the old version, and progress
  saved against it does not carry over. Updating Recents is a follow-up feature; the audit report notes it for each
  replaced item.

- Mary Had a Little Lamb and Jingle Bells (modern refrain) have no machine-readable PD source on Mutopia. R15
  names the PD printings to compare against visually. If the implementer cannot locate a named PD printing of the
  familiar version, that item is an owner decision at that point (FR-009/FR-011), not a silent removal.
