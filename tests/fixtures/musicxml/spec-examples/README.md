# MusicXML specification tutorial examples

Five worked examples from the **MusicXML specification itself**, copied unmodified from the W3C Music
Notation Community Group's repository. They cover notation the other fixture folders do not reach at
all - guitar tablature, drum-kit percussion and chord symbols - as complete, publishable little scores
rather than as probes.

- Source: <https://github.com/w3c/musicxml> (branch `gh-pages`, `docs/src/data/examples/musicxml/`,
  downloaded 2026-09-22)
- Licence: the repository is a **W3C Community Group report**, published under the
  [W3C Software and Document License](https://www.w3.org/copyright/software-license/), which permits
  copying, modification and redistribution with the notice kept. The repository carries **no
  `LICENSE` file of its own**, so that is the licence for the CG report as a whole rather than a
  per-file statement - flagged here so the owner can drop this folder if they want every fixture
  covered by an explicit file-level licence. Recorded in `THIRD_PARTY_NOTICES.md`.

| File | What it covers |
|---|---|
| `tutorial-apres-un-reve.musicxml` | Fauré, *Après un rêve* - voice and piano, 4 measures, 102 notes; the specification's main worked example |
| `tutorial-chopin-prelude.musicxml` | Chopin, Prelude Op.28 no.20 - dense grand-staff chords in one measure, 27 notes |
| `tutorial-percussion.musicxml` | Drum kit: unpitched percussion, two parts, percussion clef and noteheads |
| `tutorial-tablature.musicxml` | Guitar **tablature**: a staff plus a TAB staff with string and fret numbers |
| `tutorial-chord-symbols.musicxml` | `<harmony>` **chord symbols** over a melody |

## What the app makes of them

Measured 2026-09-22. All five load and engrave to one page, with every Note ID reaching the SVG:

| File | Parts | Measures | Notes | Notices |
|---|---:|---:|---:|---|
| `tutorial-apres-un-reve` | 2 | 4 | 102 | - |
| `tutorial-chopin-prelude` | 1 | 1 | 27 | `defaultTempo` |
| `tutorial-chord-symbols` | 1 | 3 | 9 | `unsupportedElement` (harmony), `defaultTempo` |
| `tutorial-percussion` | 2 | 2 | 36 | `defaultTempo` |
| `tutorial-tablature` | 2 | 1 | 10 | - |

Two things worth knowing:

- **`<harmony>` is skipped by the time model** but Verovio still engraves the chord symbols from the
  render copy, so the printed page is complete. The same holds for `<figured-bass>`. Neither is listed
  in `SUPPORT_MATRIX` yet.
- **`tutorial-percussion`'s Cowbell part repeats its measure 1 with a `<measure-repeat>`** (the simile
  sign) while still encoding the four notes. Verovio drew the sign instead of them, so 4 of the 36 notes
  in the Score model had no `g.note` (found by 001 T169). Since 017 T021 the render copy leaves the sign
  out and the notes are engraved; `tests/e2e/real-scores.spec.ts` asserts every Note ID has its element.
