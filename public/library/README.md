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

## Engraving: beams and accidentals (feature 006, FR-012)

Library files must be fully engraved on disk: the app completes beams and accidentals only for scores a person
opens, never for library items. `pnpm library:index` checks every file with `planEngraving` in library mode and
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

The 24-key chord exercises and the chord-change drills are generated from
`content/library/exercises/*.json` by `pnpm library:exercises` - edit the definition, not the
generated `.musicxml` files, and regenerate.
