# Theory-check fixtures (feature 007)

Four hand-written MusicXML 4.0 files for `tests/tools/fidelity/theory.test.ts` and the exercise part of
`tests/tools/fidelity/planted.test.ts`. They are the correct answers the independent exercise theory check
(`tools/library/fidelity/theory.ts`, `specs/007-library-fidelity-audit/data-model.md` §5) must accept, and the
starting point for its planted errors. Every pitch was typed from the music theory it names, not computed, so the
fixtures cannot share a bug with the check or with the exercise generator.

## Provenance and licence

All four are **original work**, written for this feature, released under **CC0 1.0** (public-domain dedication - no
attribution required, no conditions), like the rest of this app's own test fixtures. None is derived from a
third-party score.

## Files

Two staves, both hands playing the same shape an octave apart, one whole-note chord per measure, `<words>` labels
above the right hand, `<key>` with `<fifths>` and `<mode>`.

| Fixture | Content | What it pins |
|---|---|---|
| `g-sharp-minor-i-iv-v.musicxml` | G-sharp minor: i (G♯ B D♯), iv (C♯ E G♯), V (D♯ F𝄪 A♯), i | the harmonic-minor V in a key with five sharps: the leading tone F-double-sharp (MIDI 67 = G) must stay an F |
| `e-flat-minor-iv.musicxml` | E-flat minor: iv (A♭ C♭ E♭) | a flat-key minor chord with a flattened third: C♭5 sounds as MIDI 71 (B) but must stay spelled C♭, never B |
| `c-major-tonic-inversions.musicxml` | C major: I⁶ (E G C), I⁶⁴ (G C E) | the inversion is read from the lowest sounding note of each hand |
| `c-major-ii-v-i.musicxml` | C major: ii (D F A), V (G B D), I (C E G) | a plain major-key progression with minor ii, and the `<words>` labels "Dm", "G", "C" |
