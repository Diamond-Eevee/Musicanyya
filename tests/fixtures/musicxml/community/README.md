# Community MusicXML Test Suite

The corpus notation software is tested against: **183 files** (182 `.musicxml` plus one `.mxl`),
copied unmodified from the **MusicXML Test Suite**, originally written for LilyPond's `musicxml2ly`
by Reinhold Kainhofer, forked with his blessing by Michael Scott Asato Cuthbert, and donated by him
in 2026 to the **W3C Music Notation Community Group**, which now uses it to validate the MusicXML
schemas.

- Source: <https://github.com/w3c-cg/musicxmlTestSuite> (branch `main`, downloaded 2026-09-22)
- Licence: **MIT**, Copyright (c) 2016-2026 Michael Scott Asato Cuthbert - full text in
  [`LICENSE.musicxmlTestSuite.txt`](LICENSE.musicxmlTestSuite.txt), also recorded in
  `THIRD_PARTY_NOTICES.md`

These are the community's *conformance* probes: small, deliberately awkward files, each isolating one
notation feature. They complement `../real/` (whole pieces of real music) - together they answer
"does every notation feature work?" and "does real music look right?".

## What the numbering means

| Range | Area |
|---|---|
| 01-03 | Pitches (incl. microtones, arrow accidentals, Turkish/Persian), rests, rhythm |
| 11-14 | Time signatures (incl. senza misura, single-number, alternating), clefs, key signatures (church modes, non-traditional, microtonal), staff details |
| 21-24 | Chords, noteheads, tuplets (nested, tremolo), grace notes (staff change, after-grace, simultaneous) |
| 31-34 | Directions, metronome marks, notations, articulations, arpeggios, spanners |
| 41-46 | Parts and staff groups, transposition, repeats, barlines, measures, pickup measures |
| 51-59 | Page layout, positioning, system breaks |
| 61-75 | Lyrics, figured bass, chord symbols, percussion, accordion |
| 90-99 | Compressed `.mxl`, unicode, lyrics edge cases, wavy lines |

Three files are **deliberately invalid** and are named `*.invalid.musicxml`
(`41g-PartNoId`, `74b-FiguredBass`, `75b-Accordion`). The app must either read them or refuse them
with a `MusicXmlLoadError` - never crash. That is Constitution III's "bad MusicXML never crashes",
and `tests/core/musicxml/community-suite.test.ts` asserts it over the whole corpus.

## What the app makes of the corpus

Measured 2026-09-22, after the two parser fixes this corpus prompted (see below):

- 183/183 load without an uncaught exception.
- 183/183 lay out to at least one page through the Verovio worker, with no Verovio error.
- 0 duplicate Note IDs across the corpus; every Note ID and Measure ID reaches the render copy.
- Every measure tiles end to end - no gap, no overlap, no negative tick.
- Notices raised are snapshotted in `tests/core/musicxml/__snapshots__/community-suite.test.ts.snap`,
  so a newly unsupported element shows up as a snapshot diff rather than as silence.

### Two bugs this corpus found

| File | Bug |
|---|---|
| `11b-TimeSignatures-NoTime.musicxml` | `<backup>` with a duration larger than the measure drove the cursor to a **negative tick**, and every later measure with it. `<backup>` is now clamped to the start of its own measure and reports `cursorClamped`. |
| `46e-PickupMeasure-SecondVoiceStartsLater.musicxml` | When a measure's **last voice ended before its longest voice**, the next measure started early and **overlapped** it - silently misplacing every measure after it. The measure cursor now advances to the end of the longest voice. |

Neither showed up in the ten whole pieces in `../real/`, because encoders normally pad every voice
with rests to the end of the bar. That is the point of keeping both kinds of fixture.

## Updating

Re-download from the repository above and replace the folder wholesale; the files are used as-is and
none of them is edited. `tests/core/musicxml/community-suite.test.ts` asserts the file count, so a
changed corpus fails loudly. `pnpm tsx tests/tools/probe-real-scores.ts <dir>` sweeps a directory and
prints per-file notices, page counts and timings.
