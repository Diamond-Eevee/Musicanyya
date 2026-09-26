# The practice score library

This folder is the shelf the app reads (`src/engine/library/http-catalog.ts` fetches it; `mx-library`
renders it). Nothing here is hand-maintained beyond the score files and their sidecars - `index.json`
is generated and must never be edited by hand.

## Licence rule

Every item on the shelf carries a `provenance.licence` of `CC0-1.0` or `public-domain` - nothing else
is accepted (FR-017). There are two shapes:

- **`origin: "authored"`** - written for this project (an exercise, or our own engraving/arrangement of
  a public-domain work). Licence is always `CC0-1.0`. Requires `author` and `created`.
- **`origin: "downloaded"`** - obtained from an external CC0/public-domain source (e.g. OpenScore, or a
  file the owner verified themselves). Requires `source`, `obtained`, and an entry in
  `THIRD_PARTY_NOTICES.md` at the repository root.

See `contracts/library-index.md` in `specs/005-practice-score-library/` for the full schema.

## The sidecar requirement

Every `<name>.musicxml` (or `<name>.mxl`) needs a `<name>.json` beside it with the authored metadata:
title, kind, level, tags, provenance, and who reviewed the music (`reviewedBy`/`reviewedOn`). A score
file with no sidecar fails `tests/library/licence.test.ts` and is skipped with a notice at run time -
it is never silently dropped from the check.

## Rejected items

When a candidate score is turned away - wrong licence, fails to load, silent, over budget, wrongly
levelled - the reason is recorded here rather than just discarded, so the decision is not repeated
(FR-018).

| Item | Reason |
|---|---|
| repertoire/intermediate/schumann-op68-no10 (Schumann, Fröhlicher Landmann, Op. 68 No. 10) | Removed 2026-09-24 (feature 007, owner decision D-2): the only machine-readable source, Mutopia 659, is CC BY-SA 2.5, and the notes were derived from it; searched 2026-09-23. |

## Audit (feature 007)

Every item on the shelf has an audit record in `content/library/audit/` (same path as the item, `.json`), saying
what the item claims to be (the original, an arrangement, or an exercise), what it was checked against, and the
outcome. `pnpm library:fidelity` re-runs every record from the committed files and writes the readable report
`docs/library-audit.md`; `pnpm library:fidelity --check` fails when the report is stale, and
`tests/library/fidelity.test.ts` fails when an item has no record or a record no longer reproduces. The sources the
items are checked against or converted from live in `content/library/sources/`.

**A replaced item is converted, never hand-fixed.** When an item does not match its source, its MusicXML is
regenerated from the approved source with `pnpm library:convert-ly <source-id> <item-id>` (add `--replace` when the
current file was typed in by hand; the tool refuses to write unless the source's MIDI and the written file agree
with its reading of the source), then completed with `pnpm library:engrave` and `pnpm library:index` as below, and
its sidecar and audit record are updated. Editing the notes of a replaced item by hand breaks its
audit record.

## Engraving: beams and accidentals (feature 006, FR-012)

Library files must be fully engraved on disk: the app completes beams and accidentals on every open, and for a
library item that must add nothing. `pnpm library:index` checks every file with `planEngraving` in library mode and
refuses to write the index when a file has:

1. **Missing or inconsistent beams**: an eighth note or shorter that belongs in a beam group without a `<beam>`, or
   encoded beam data that does not open and close consistently.
2. **Missing accidentals**: a pitch that needs a required or courtesy sign without an `<accidental>`.

It names the file, bar, staff, voice and pitch to fix. `tests/library/engraving-guard.test.ts` holds the same line.
Hand-edits are not needed: the engraving tool completes the files in place, adding only the missing `<beam>` and
`<accidental>` elements and changing nothing else. Then regenerate the index:

```bash
pnpm library:engrave
pnpm library:index
```

Generated exercises (`pnpm library:exercises`) come out completed already.

## Regenerating the index

After adding, editing or removing anything under this folder:

```bash
pnpm library:index
```

This walks the tree, validates every sidecar, loads every score through the app's own parser, derives
the display facts and the level check, and rewrites `index.json`. Commit the regenerated file.
`tests/library/index.test.ts` fails if the committed file and a fresh regeneration disagree (FR-025).

## The shelf: keys, key changes, songs, repertoire (feature 011)

```text
learning/
  keys/<key>/                24 folders (C major, A minor, G major, ... circle of fifths, each major followed by its relative minor)
    introduction  beginner  intermediate  advanced     the four generated steps of that key
    <extra>                  C major only: three Advanced chord-loop extras (stepOrder 10, 20, 30)
    song-<name>              songs: a public-domain tune in the right hand, our block chords in the left
  key-changes/<from>-to-<to>/   18 folders (relative and parallel pairs); introduction, beginner, intermediate, and the
                                two same-tonic drills (major-and-minor, minor-and-major) as extras
repertoire/{beginner,intermediate,advanced}/    pieces
```

Every item under `learning/keys/` and `learning/key-changes/` has a `step` (`introduction`, `beginner`, `intermediate`,
`advanced` or `song`) and a `stepOrder` (0 for the main step, 10, 20 ... for extras and songs). `pnpm library:index`
refuses to write the index when a step is missing or misplaced, when two items share `(step, stepOrder)` in a folder, or
when the step-order check finds a later step that is not harder than the one before it (tempo, notes per beat, hand
independence and chord changes per bar must not fall, and at least one must rise).

- **Generated steps and key changes**: `content/library/exercises/step-*.json` (the four steps, 24 keys each) and
  `key-change-*.json` (18 pairs each) are read by `pnpm library:exercises`; edit the definition, never the generated
  `.musicxml`, and regenerate. The older chord-change drills are generated the same way.
- **Songs**: `content/library/songs/<name>.json` (a source id from `content/library/sources/`, the melody's staff, voice and
  bars, an optional transposition, and one chord per bar) are read by `pnpm library:songs`, which takes the melody from
  the approved public-domain source (cross-checked against the source's own MIDI), writes our left-hand block chords and
  prints the chord names above the melody. `--song <id>` builds one. Songs are `kind: piece` arrangements: the sidecar
  names the source (`provenance.basedOn`) and the departures (left hand ours, any transposition), and the panel shows
  "Arrangement for this app (CC0)" with the source's edition and link.
- **`supersedes`**: an item that replaced an old one lists the old item's id and SHA-256 (from `tools/library/successors.ts`),
  so the settings remembered for the old Score apply to the new one, and a saved folder filter follows its folder through
  the section's `formerIds`.
- Each generated or song item has an audit record (`content/library/audit/<item-id>.json`): exercises are checked by the
  independent theory check (`exercise-theory-v2`), songs by the melody comparison against their source and by
  `song-chords-v1`.
