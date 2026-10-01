# Contract: orchestration definition, generator and checker

**Version**: `1.0.0` (new, feature 019). Dev-time only (nothing here ships as runtime code). Owners:
`content/library/orchestra/*.json`, `tools/library/orchestra/` (new), `tools/library/fidelity/orchestra.ts` (new).
Decisions: research R-16.

## 1. File

`content/library/orchestra/<item-slug>.json`, UTF-8 without BOM; schema in data-model section 6.2. Example:

```json
{
  "version": 1,
  "itemId": "repertoire/advanced/grieg-morning-mood",
  "reviewedBy": "music-domain-expert",
  "reviewedOn": "2026-10-xx",
  "instruments": [
    { "id": "orch-flute", "name": "Flute", "program": 74, "dynamics": 50, "range": { "low": 60, "high": 96 } },
    { "id": "orch-oboe", "name": "Oboe", "program": 69, "dynamics": 50, "range": { "low": 58, "high": 91 } },
    { "id": "orch-strings", "name": "Strings", "program": 49, "dynamics": 40, "range": { "low": 28, "high": 91 } }
  ],
  "passages": [
    { "instrument": "orch-flute", "bars": { "from": 1, "to": 4 }, "doubles": { "staff": 1, "pick": "top" }, "octaves": [0], "fitRange": true },
    { "instrument": "orch-strings", "bars": { "from": 21, "to": 29 }, "doubles": { "staff": 1, "pick": "top" }, "octaves": [0, -1], "fitRange": true },
    { "instrument": "orch-strings", "bars": { "from": 1, "to": 20 }, "doubles": { "staff": 2, "pick": "all" }, "minQuarters": 1.5, "octaves": [0], "fitRange": true }
  ]
}
```

(The bar map itself is authored in the implementation, from the piano transcription and Grieg's orchestration, and
reviewed by the `music-domain-expert`.)

## 2. Generator - `pnpm library:orchestra <item-id> [--check]`

1. Reads the item's MusicXML; removes any existing Orchestra parts (idempotent).
2. Reads the piano part with the core parser (`buildScore`) and, per passage, takes the sounding notes of `doubles.staff`
   (per onset: the top, the lowest or all of them), dropping grace notes, ornamented (trilled) notes and notes shorter
   than `minQuarters`.
3. For each passage, writes the doubled notes into that instrument's part: same onsets (a rolled chord at its written
   onset); durations as written, tie chains merged, never extended; one note per entry of `octaves`, moved by whole
   octaves into `range` when `fitRange`; loudness written as `<sound dynamics="..."/>`
   at the start of each passage (the passage's `dynamics`, else the instrument's - the form the parser already turns
   into velocity, `Part.soundDynamics`); rests elsewhere so every bar is complete.
4. Appends one `<score-part>` (with `<midi-instrument>` program) and one `<part>` per instrument, each staff marked
   `<staff-details print-object="no"/>` in bar 1 (orchestra-score contract section 1), using the dev-only writer
   (`src/core/musicxml/write.ts`, extended additively).
5. Writes the file only if every check in section 3 passes; `--check` writes nothing and exits 1 on any difference
   from the committed file (used by the regeneration test).

## 3. Checker - `checkOrchestra(score, definition)` (fidelity tools 1.14.0)

Returns findings; the item is accepted only with none:

| Rule | Check |
|---|---|
| O1 structure | Same bar count and bar lengths in every Orchestra part as in the piano part. |
| O2 doubling | Every Orchestra note's pitch class sounds in the piano at the note's onset (a piano note that starts at or before it and ends after it). |
| O3 range | Every Orchestra note lies inside its instrument's `range`. |
| O4 regeneration | The committed Orchestra parts equal a fresh generation from the definition. |
| O5 hidden | Every Orchestra part is detected as one by the app's own parser (orchestra-score section 1). |

`pnpm library:fidelity` runs O1-O5 for every item that has a definition and records them in the item's audit record
(a check with `method: "theory"`, rule set `orchestra-v1`; audit-record 1.4.0).
