# musicxml/

Practice scores you can open in the app (drag one onto the window, or use *Open*). These are **not** test
fixtures - the parser fixtures stay in `tests/fixtures/musicxml/`.

**`chords/c-major-scale-and-chords.musicxml` moved to
[`public/library/learning/chords/`](../public/library/learning/chords/c-major-scale-and-chords.musicxml)**
(feature 005, owner decision D-3): it is now part of the in-app practice score library, served to the
app directly rather than needing to be dragged in. Its sidecar
(`public/library/learning/chords/c-major-scale-and-chords.json`) carries the provenance table that used to
live below. `specs/002-practice-wait-mode/quickstart.md` points at the new path.

## Provenance

**Nothing here was downloaded.** Anything added to this folder should be written directly as MusicXML for this
project - no source file, no export from a notation program, no copied material - so there is no third-party
licence to respect and no entry is needed in `THIRD_PARTY_NOTICES.md`. As of 2026-09-22 this folder holds no
files of its own; see the pointer above for the one example it used to hold.

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
`THIRD_PARTY_NOTICES.md` before committing it. Repertoire the app ships with lives in
`public/library/repertoire/`, not here (see `specs/005-practice-score-library/research.md` R-1).
