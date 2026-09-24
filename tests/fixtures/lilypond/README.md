# LilyPond Fixtures

Own-work LilyPond files for the fidelity audit's LilyPond subset reader (feature 007, contract
`specs/007-library-fidelity-audit/contracts/fidelity-tools.md` §3.1). Each file shows one construct and is a few bars
long; `tests/tools/lilypond/read.test.ts` states the expected reading of each by hand.

| File | Construct |
|---|---|
| `relative.ly`, `absolute.ly` | relative and absolute octave entry |
| `chords.ly` | chords, dotted durations, a chord's first note as the next reference |
| `ties.ly` | ties merged into one sounding note |
| `tuplets.ly` | `\tuplet` and `\times` |
| `grace.ly` | `\grace`, `\appoggiatura`, `\acciaccatura`, `\slashedGrace` |
| `volta.ly`, `unfold.ly` | `\repeat volta` + `\alternative`; `\repeat unfold` |
| `endings-mid-bar.ly` | a pickup inside the repeat, a first ending that completes it, and a second ending ended early with `\bar ""` and `\set Timing.measurePosition` (the form of Mutopia 931) |
| `partial.ly` | `\partial` pickup bar |
| `time-key-clef.ly` | `\time`, `\key`, `\clef`, including changes mid-piece |
| `ottava.ly` | `\ottava` (display only: the entered pitch sounds) |
| `pianostaff.ly` | two anonymous staves in a `\new PianoStaff` |
| `voices.ly` | `\new PianoStaff`, named staves, `<< \\ >>`, `\new Voice`, `\change Staff` |
| `variables.ly` | variable definitions and references |
| `rests.ly` | `r`, `R`, `s`, dots, durations carried over |
| `score-blocks.ly` | `\version`, `\header`, `\paper`, a layout `\score` and a MIDI `\score` with `\unfoldRepeats` |
| `marks.ly` | articulations, dynamics, slurs, beams, fingering, text, `\markup`, `\tempo`, sustain pedal |
| `bar-check-wrong.ly` | a bar check that is not on a bar line (must fail) |
| `unsupported-transpose.ly` | `\transpose` (must fail) |

**Origin**: own work. **Licence**: CC0 1.0 Universal.
