# Orchestra fixtures (feature 019)

Own work, **CC0**: written for this feature from one small template (a four-bar C major tune in 4/4 at 100 quarter
notes per minute, a two-staff piano part, and one extra part) and checked in as plain MusicXML. No third-party music.

An **Orchestra part** is a part in which every staff has `<staff-details print-object="no">` in force from its first
measure (specs/019-metronome-orchestra-volume/contracts/orchestra-score.md section 1). A **twin** (`<name>-twin`) is
the same file with exactly the Orchestra `<score-part>` and `<part>` elements cut out - from the start of the start
tag to the end of the end tag, the white space around them kept - which are the byte ranges the render copy removes.
Tests compare a fixture's printed notes, render copy, spans, Grades and facts with its twin's.

| Fixture | Behaviour | Twin |
|---|---|---|
| `piano-and-oboe` | Piano (P1, two staves) and an oboe (P2, GM 69, one staff) a third above the melody; its `<staff-details>` has no `number` (staff 1) | yes |
| `piano-and-two-staff-orchestra` | Piano and a two-staff harp (P2, GM 47) whose staves 1 and 2 are both hidden by `number` | yes |
| `orchestra-first` | The oboe is P1, the piano P2: the piano's Note IDs carry part index 1 here and 0 in the twin (nothing renumbers printed parts, orchestra-score.md section 2), so they are equal only with the part index mapped | yes |
| `partly-hidden` | A two-staff strings part (P2) with only staff 2 hidden: not an Orchestra part, `hiddenStaffIgnored`, printed | no |
| `hidden-later` | The oboe's staff is hidden from bar 2, not from the first measure: not an Orchestra part, `hiddenStaffIgnored` | no |
| `shown-again` | The oboe's staff is hidden in bar 1 and `print-object="yes"` in bar 3: not an Orchestra part, `hiddenStaffIgnored` | no |
| `all-hidden` | Both parts hidden: both are treated as printed, one `hiddenStaffIgnored` per part, so the score sheet is never empty | no |
| `orchestra-no-program` | An Orchestra part whose `<midi-instrument>` has no `<midi-program>`: `orchestraInstrumentMissing`, not played (never as a piano) | yes |
| `orchestra-same-program` | An Orchestra part that is itself a piano (GM 1): it must not share the printed piano's channel | yes |

The files were generated once by a throw-away script from the template and are edited by hand from here on; the
twins must be changed together with their fixture (a test compares them byte for byte through the render copy).
