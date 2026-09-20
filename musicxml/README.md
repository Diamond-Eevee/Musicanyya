# musicxml/

Practice scores you can open in the app (drag one onto the window, or use *Open*). These are **not** test
fixtures - the parser fixtures stay in `tests/fixtures/musicxml/`.

All files here are written for this project and contain no third-party material, so they need no entry in
`THIRD_PARTY_NOTICES.md`.

## chords/

| File | Content |
|---|---|
| `c-major-scale-and-chords.musicxml` | C major, 4/4, quarter = 72, grand staff, 9 measures. Section A: right hand plays the scale C D E F G A B C (German **H** = **B** in MusicXML) up and down while the left hand holds the chords. Section B: the hands swap - the left hand plays the same scale, the right hand holds the chords. Measure 9 is the closing tonic chord. |

Harmony under the scale is I - V - I / I - V - IV - V - I, so the chord changes support the scale degrees
instead of clashing with them. Every note carries a fingering (`<notations><technical><fingering>`), using the
standard one-octave C major fingerings: right hand 1 2 3 1 2 3 4 5 up, left hand 5 4 3 2 1 3 2 1 up.
