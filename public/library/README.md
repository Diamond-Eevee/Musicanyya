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

## Engraving Quality (FR-012)

The library demands fully engraved music that does not rely on the app's real-time layout fixes. Before writing the index, `planEngraving` checks every file. The file is rejected if it has:
1. **Missing or inconsistent beams**: any 8th note (or shorter) that is part of a beamable rhythm must have valid `<beam>` tags.
2. **Missing accidentals**: any altered pitch that needs a required or courtesy accidental must have an `<accidental>` tag.

If an item fails, `pnpm library:index` reports the exact measure, staff, voice, and pitch that requires fixing. To fix it, you do not need to hand-edit the XML; instead, run the engraving tool to complete the missing beams and accidentals automatically:

```bash
pnpm library:engrave
```
This tool edits the files in place, adding only the missing `beam` and `accidental` elements (this automated completion does not change the file's licence or copyright status). After engraving, run `pnpm library:index` again.

| Item | Reason |
|---|---|

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
