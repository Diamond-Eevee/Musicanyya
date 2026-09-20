# musicxml/

Practice scores you can open in the app (drag one onto the window, or use *Open*). These are **not** test
fixtures - the parser fixtures stay in `tests/fixtures/musicxml/`.

## Provenance

**Nothing here was downloaded.** Every file in this folder was written directly as MusicXML for this project - no
source file, no export from a notation program, no copied material - so there is no third-party licence to respect
and no entry is needed in `THIRD_PARTY_NOTICES.md`.

| File | Written | By | Checked with |
|---|---|---|---|
| `chords/c-major-scale-and-chords.musicxml` | 2026-09-20 | `claude-opus-5`, on request, to exercise both hands | `readXml` + `buildScore` (no notices, no skipped elements, every measure exactly full) and the project's Verovio worker (engraves to one page) |

The markup follows the MusicXML 4.0 partwise structure but is **not** schema-validated against `musicxml.xsd` in
this repository - the project's own loader and Verovio are what it was checked against. If you want a formal
validation step, the schema is in the W3C repository linked below.

Why hand-written rather than downloaded: an exercise this specific (one hand playing a scale while the other holds
the chords, then reversed) is not part of any official sample set, and pulling in someone else's file would add a
licence question that is the owner's to answer, not an agent's.

## Where official MusicXML files come from

Checked on 2026-09-20:

- **[github.com/w3c-cg/musicxml](https://github.com/w3c-cg/musicxml)** (branch `gh-pages`) - the MusicXML
  specification itself, maintained by the W3C Music Notation Community Group. `schema/` holds `musicxml.xsd` for
  validation; `tests/files/` holds the test corpus (the `41g-PartNoId.xml`-style names come from the long-standing
  Unofficial MusicXML Test Suite, now maintained there), with `tests/assertions.json` recording which files are
  *deliberately* invalid. Useful for parser coverage - much less useful as practice material, since the files are
  small notation probes, not music.

For actual repertoire, the usual routes are OpenScore (CC0 transcriptions of public-domain works), MuseScore's
score library and IMSLP. None of those was reachable from this session to confirm, and each carries its own
licence terms per score - so check the licence of anything added here, and record it in
`THIRD_PARTY_NOTICES.md` before committing it.

## chords/

| File | Content |
|---|---|
| `c-major-scale-and-chords.musicxml` | C major, 4/4, quarter = 72, grand staff, 9 measures. Section A: right hand plays the scale C D E F G A B C (German **H** = **B** in MusicXML) up and down while the left hand holds the chords. Section B: the hands swap - the left hand plays the same scale, the right hand holds the chords. Measure 9 is the closing tonic chord. |

Harmony under the scale is I - V - I / I - V - IV - V - I, so the chord changes support the scale degrees
instead of clashing with them. Every note carries a fingering (`<notations><technical><fingering>`), using the
standard one-octave C major fingerings: right hand 1 2 3 1 2 3 4 5 up, left hand 5 4 3 2 1 3 2 1 up.

This file is also the reference score for feature 002 (Practice mode): the held chord under moving notes is
exactly the case a wait-mode matcher gets wrong - see `specs/002-practice-wait-mode/quickstart.md`.
